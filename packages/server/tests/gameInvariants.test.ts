import { describe, test, expect } from 'bun:test';
import {
	CURRENT_RULES_VERSION,
	cardsToString,
	createDeck,
	getLegalPlays,
	getLegalPlaysPhase1,
	makeInitialState,
	type Card,
	type GameState,
	type Player
} from 'shared';
import type { DbGamePlayer, DbMove } from '../src/db.js';
import { replayGame } from '../src/gameReplay.js';
import {
	applyChance,
	applyClearTrick,
	applyDecline,
	applyJoin,
	applyPickUp,
	applyPlayCards,
	applySprinkle,
	applyStartGame,
	canSprinkle
} from '../src/gameLogic.js';

// Plays whole random games through the real apply* functions and checks the
// rules after every move, so a new way to break them fails here even if nobody
// thought of it. A failure names the seed and move; rerun it with that seed.
// `the checks can see the old bugs` keeps these checks honest.

const GAMES = 1500;

function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Rand = ReturnType<typeof rng>;
const pick = <T>(rand: Rand, items: T[]): T => items[Math.floor(rand() * items.length)];

function shuffled<T>(rand: Rand, items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

const seated = (p: Player) => p.inviteStatus === 'accepted' && !p.hasLeft;

function allCards(state: GameState): Card[] {
	return [
		...state.deck,
		...state.tablePile.flat(),
		...state.discardPile,
		...(state.hiddenTrumpStorage && state.phase === 1 ? [state.hiddenTrumpStorage.card] : []),
		...state.players.flatMap((p) => [...p.hand, ...p.reserveStack])
	];
}

// Cards are counted once per owner, except that a winner's trick is on the
// table and in their reserve until it clears.
function cardsAreAccountedFor(state: GameState): boolean {
	if (state.trickWinnerId !== null) return true;
	const ids = allCards(state).map((c) => c.id);
	return ids.length === 52 && new Set(ids).size === 52;
}

// Returns the name of every rule the state breaks.
function brokenRules(state: GameState, phaseBefore: number): string[] {
	const broken: string[] = [];
	const active = state.players[state.activePlayerIdx];

	if (phaseBefore === 2 && state.phase === 1) broken.push('phase went backwards');

	if (state.status === 'ended') {
		if (state.phase === 1 && state.players.some((p) => p.isSkitgubbe)) {
			broken.push('skitgubbe decided in phase 1');
		}
		return broken;
	}
	if (state.status !== 'playing') return broken;

	if (state.phase === 1) {
		if (state.players.some((p) => p.isDone)) broken.push('escaped in phase 1');

		const clear =
			state.tablePile.length === 0 && state.trickWinnerId === null && !state.tieBreakerActive;
		if (
			clear &&
			state.deck.length === 0 &&
			state.players.some((p) => seated(p) && !p.hand.length)
		) {
			broken.push('clear table, someone out of cards, still phase 1');
		}

		const inRound = state.players.filter((p) => !p.hasLeft && !p.isDone).length;
		if (!state.tieBreakerActive && state.trickWinnerId === null) {
			if (state.tablePile.length > inRound) {
				broken.push('more plays on the table than players');
			}
			if (state.tablePile.length === inRound) {
				broken.push('finished round left unresolved');
			}
		}
	}

	if (state.phase === 2) {
		if (!state.trumpCard) broken.push('phase 2 without trump');
		if (state.players.some((p) => p.isDone && p.hand.length > 0)) {
			broken.push('out of the game while holding cards');
		}
		if (phaseBefore === 1) {
			const holder = state.players.find((p) => p.id === state.hiddenTrumpStorage?.playerId);
			if (holder && seated(holder) && active?.id !== holder.id) {
				broken.push('trump holder does not start phase 2');
			}
		}
	}

	if (state.trickWinnerId === null) {
		const pending = active?.inviteStatus === 'pending';
		const canMove =
			state.phase === 1
				? !!active?.hand.length || state.deck.length > 1
				: !!active?.hand.length || state.tablePile.length > 0;
		if (!active || active.hasLeft || active.isDone || (!pending && !canMove)) {
			broken.push('player on turn cannot move');
		}
	}

	if (!state.players.some((p) => p.hasLeft) && !cardsAreAccountedFor(state)) {
		broken.push('cards lost or duplicated');
	}

	return broken;
}

interface Result {
	broken: Set<string>;
	state: GameState;
	replayed: GameState;
	moves: DbMove[];
	finished: boolean;
}

function playGame(seed: number, rulesVersion: number): Result {
	const rand = rng(seed);
	const playerCount = 2 + Math.floor(rand() * 5);
	const invites = rand() < 0.4;
	const leaves = rand() < 0.4;

	const dbPlayers = Array.from({ length: playerCount }, (_, i) => ({
		game_id: 'fuzz',
		profile_id: `p${i}`,
		role: i === 0 ? 'host' : 'player',
		is_ready: 1,
		invite_status: invites && i > 0 && rand() < 0.5 ? 'pending' : 'accepted',
		turn_order: i,
		name: `P${i}`,
		color: '#000'
	})) as DbGamePlayer[];

	const deck = shuffled(rand, createDeck());
	const moves: DbMove[] = [];
	const log = (playerId: string, type: DbMove['move_type'], cards?: Card[]) =>
		moves.push({
			seq: moves.length,
			player_id: playerId,
			move_type: type,
			cards: cards ? cardsToString(cards) : null
		} as DbMove);

	const players: Player[] = dbPlayers.map((p) => ({
		id: p.profile_id,
		name: p.name!,
		color: '#000',
		hand: [],
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost: p.role === 'host',
		inviteStatus: p.invite_status
	}));
	const state = makeInitialState(players, { status: 'waiting', seq: 0, logs: [], rulesVersion });
	applyStartGame(state, deck);
	log('p0', 'S');

	const broken = new Set<string>();

	function sprinkle(): boolean {
		const onTurn = state.players[state.activePlayerIdx];
		const order = [...(onTurn ? [onTurn] : []), ...shuffled(rand, state.players)];
		for (const p of order) {
			for (const card of shuffled(rand, p.hand)) {
				const same = p.hand.filter((c) => c.value === card.value);
				const cards = rand() < 0.5 ? same : [card];
				const ids = cards.map((c) => c.id);
				if (canSprinkle(state, p.id, ids).ok) {
					log(p.id, 'R', cards);
					applySprinkle(state, p.id, ids);
					return true;
				}
			}
		}
		return false;
	}

	function step(): boolean {
		const active = state.players[state.activePlayerIdx];
		const waitingInvitee = state.players.find((p) => p.inviteStatus === 'pending');

		// The transition edge cases live at the end of the deck, so push harder there.
		const endOfDeck = state.phase === 1 && state.deck.length === 0;

		if (state.phase === 1 && rand() < (state.tieBreakerActive ? 0.6 : 0.15) && sprinkle()) {
			return true;
		}

		if (state.trickWinnerId !== null) {
			log(state.trickWinnerId, 'T');
			applyClearTrick(state);
			return true;
		}

		if (leaves && rand() < (endOfDeck ? 0.1 : 0.01)) {
			const leaver = pick(rand, state.players.filter(seated));
			log(leaver.id, 'L');
			applyDecline(state, leaver.id);
			return true;
		}

		if (waitingInvitee && (active === waitingInvitee || rand() < 0.1)) {
			if (rand() < 0.5) {
				log(waitingInvitee.id, 'A');
				applyJoin(state, waitingInvitee.id, waitingInvitee.name, waitingInvitee.color);
			} else {
				log(waitingInvitee.id, 'L');
				applyDecline(state, waitingInvitee.id);
			}
			return true;
		}

		if (!active) return false;

		if (state.phase === 1 && state.deck.length > 1 && rand() < 0.1) {
			const card = state.deck[state.deck.length - 1];
			log(active.id, 'C', [card]);
			applyChance(state, active.id, card);
			return true;
		}

		const options =
			state.phase === 1
				? getLegalPlaysPhase1(active.hand)
				: getLegalPlays(active.hand, state.tablePile, state.trumpCard!.suitName);
		const mayPickUp = state.phase === 2 && state.tablePile.length > 0;
		if (options.length > 0 && (!mayPickUp || rand() < 0.9)) {
			const cards = pick(rand, options);
			log(active.id, 'P', cards);
			applyPlayCards(
				state,
				active.id,
				cards.map((c) => c.id)
			);
			return true;
		}

		if (mayPickUp) {
			log(active.id, 'U');
			applyPickUp(state, active.id);
			return true;
		}
		return false;
	}

	let finished = false;
	for (let i = 0; i < 20_000; i++) {
		if (state.status !== 'playing') {
			finished = true;
			break;
		}
		const phaseBefore = state.phase;
		// A round's last play can start a tie-breaker a tied player can't take part in.
		const playersLeftToPlay =
			state.players.filter((p) => !p.hasLeft && !p.isDone).length - state.tablePile.length;
		const midRound =
			state.tablePile.length > 0 && state.trickWinnerId === null && playersLeftToPlay > 1;
		const inTieBreaker = state.tieBreakerActive;
		const moved = step();
		for (const rule of brokenRules(state, phaseBefore)) broken.add(rule);
		const lastMove = moves[moves.length - 1].move_type;
		if (phaseBefore === 1 && state.phase === 2 && midRound && !inTieBreaker && lastMove !== 'L') {
			broken.add('phase 2 started with a round in progress');
		}
		if (!moved) {
			broken.add('game stopped with no move left');
			break;
		}
	}

	const replayed = replayGame('fuzz', dbPlayers, deck, moves, undefined, rulesVersion);
	return { broken, state, replayed, moves, finished };
}

const snapshot = (s: GameState) => ({
	status: s.status,
	phase: s.phase,
	activePlayerIdx: s.activePlayerIdx,
	trumpCard: s.trumpCard,
	tablePile: s.tablePile,
	discardPile: s.discardPile,
	players: s.players
});

describe('every random game keeps the rules', () => {
	test(`${GAMES} games under the current rules`, () => {
		let reachedPhase2 = 0;
		let finished = 0;
		for (let seed = 1; seed <= GAMES; seed++) {
			const result = playGame(seed, CURRENT_RULES_VERSION);
			expect({ seed, broken: [...result.broken] }).toEqual({ seed, broken: [] });
			expect(snapshot(result.replayed)).toEqual(snapshot(result.state));
			if (result.state.phase === 2) reachedPhase2++;
			if (result.finished) finished++;
		}
		// Guards against the games quietly stopping before anything interesting.
		expect(reachedPhase2).toBeGreaterThan(GAMES * 0.8);
		expect(finished).toBeGreaterThan(GAMES * 0.9);
	}, 120_000);

	test('the checks can see the old bugs', () => {
		const found = new Set<string>();
		for (let seed = 1; seed <= GAMES; seed++) {
			for (const rule of playGame(seed, 1).broken) found.add(rule);
		}
		expect([...found]).toEqual(
			expect.arrayContaining([
				'clear table, someone out of cards, still phase 1',
				'escaped in phase 1',
				'more plays on the table than players',
				'finished round left unresolved',
				'player on turn cannot move'
			])
		);
	}, 120_000);
});
