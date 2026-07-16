import { describe, test, expect } from 'bun:test';
import type { GameState, Card, Player } from 'shared';
import {
	applyStartGame,
	applyPlayCards,
	applyJoin,
	applyDecline,
	applyClearTrick
} from '../src/gameLogic.js';

// --- Small builders -------------------------------------------------------

const SUIT_CHARS: Record<string, string> = {
	spades: '♠',
	hearts: '♥',
	diamonds: '♦',
	clubs: '♣'
};

let cardUid = 0;
function c(value: string, suitName: keyof typeof SUIT_CHARS = 'spades'): Card {
	return {
		id: `${suitName}-${value}-${cardUid++}`,
		value,
		suit: SUIT_CHARS[suitName],
		suitName,
		color: suitName === 'hearts' || suitName === 'diamonds' ? 'red' : 'black'
	} as Card;
}

function player(id: string, opts: Partial<Player> = {}): Player {
	return {
		id,
		name: id,
		color: '#3b82f6',
		hand: [],
		reserveStack: [],
		isDone: false,
		isSkitgubbe: false,
		isHost: false,
		inviteStatus: 'accepted',
		...opts
	};
}

function makeState(players: Player[], opts: Partial<GameState> = {}): GameState {
	return {
		status: 'playing',
		phase: 1,
		activePlayerIdx: 0,
		players,
		deck: [],
		tablePile: [],
		tablePilePlayers: [],
		discardPile: [],
		trumpCard: null,
		hiddenTrumpStorage: null,
		logs: [],
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null,
		...opts
	};
}

function active(state: GameState): Player {
	return state.players[state.activePlayerIdx];
}

// Plays the first card of the active player's hand.
function playTopCard(state: GameState): Card {
	const p = active(state);
	const card = p.hand[0];
	applyPlayCards(state, p.id, [card.id]);
	return card;
}

// --- P-5: decline mid-phase-1 keeps the turn order valid -------------------

describe('P-5: decline mid-phase-1', () => {
	test('turn order stays valid after an accepted player leaves', () => {
		const state = makeState([player('a'), player('b'), player('c')]);
		state.players.forEach(p => (p.hand = [c('5'), c('7'), c('9')]));
		state.deck = [c('2'), c('3'), c('4'), c('6'), c('8'), c('10')];

		// a plays, turn moves to b
		playTopCard(state);
		expect(active(state).id).toBe('b');

		// b leaves mid-round
		applyDecline(state, 'b');
		expect(state.status).toBe('playing');
		expect(state.players.find(p => p.id === 'b')!.hasLeft).toBe(true);
		// turn moved off the departed player to a still-active one
		expect(active(state).id).toBe('c');
		// b's staged batch (none) and cards are gone
		expect(state.tablePilePlayers).not.toContain('b');

		// c plays — with a and c both played the round resolves (no wedge)
		playTopCard(state);
		expect(state.status).toBe('playing');
		expect(active(state).hasLeft).toBeFalsy();
	});

	test('trick winner leaving while the trick is pending does not wedge the turn', () => {
		const state = makeState([player('a'), player('b'), player('c')]);
		state.players.forEach(p => (p.hand = [c('5'), c('7'), c('9')]));
		// Big deck so no phase transition
		state.deck = Array.from({ length: 10 }, (_, i) => c('3', i % 2 ? 'hearts' : 'clubs'));

		// Craft a resolved round: a wins with the K
		state.players[0].hand = [c('K'), c('5'), c('7')];
		playTopCard(state); // a plays K
		playTopCard(state); // b plays
		playTopCard(state); // c plays -> round resolves, a wins
		expect(state.trickWinnerId).toBe('a');
		expect(active(state).id).toBe('a');

		// a leaves before the trick-cleanup timer fires
		applyDecline(state, 'a');
		// the timer's applyClearTrick must move the turn off the departed winner
		applyClearTrick(state);
		expect(state.trickWinnerId).toBeNull();
		expect(active(state).hasLeft).toBeFalsy();
	});
});

// --- P-5: pending-invitee accept flow --------------------------------------

describe('P-5: pending invitee accept', () => {
	function inviteState(): GameState {
		const state = makeState([
			player('inv', { inviteStatus: 'pending' }),
			player('a'),
			player('b')
		]);
		const deck = Array.from({ length: 20 }, (_, i) =>
			c(String(2 + (i % 9)), i % 2 ? 'hearts' : 'clubs')
		);
		applyStartGame(state, deck);
		return state;
	}

	test('invitee holds the turn, gets ≤3 cards on accept, and can play', () => {
		const state = inviteState();
		// Pending invitee at idx 0 holds the turn and got no cards at start
		expect(active(state).id).toBe('inv');
		expect(state.players[0].hand.length).toBe(0);

		applyJoin(state, 'inv', 'inv', '#fff');
		const inv = state.players[0];
		expect(inv.inviteStatus).toBe('accepted');
		expect(inv.hand.length).toBe(3);
		// still their turn
		expect(active(state).id).toBe('inv');

		// and they can play
		applyPlayCards(state, 'inv', [inv.hand[0].id]);
		expect(state.tablePilePlayers).toContain('inv');
		expect(active(state).id).not.toBe('inv');
	});

	test('empty-deck accept: invitee with 0 dealt cards escapes and the turn moves on', () => {
		const state = inviteState();
		state.deck = []; // deck ran out before they accepted
		// keep other hands non-empty so no phase transition interferes
		expect(active(state).id).toBe('inv');

		applyJoin(state, 'inv', 'inv', '#fff');
		const inv = state.players[0];
		expect(inv.inviteStatus).toBe('accepted');
		expect(inv.hand.length).toBe(0);
		// The game must not wait forever on a player who can never act:
		expect(inv.isDone).toBe(true);
		expect(active(state).id).not.toBe('inv');
		expect(state.status).toBe('playing');
	});
});

// --- P-6: tie-breaker state on decline --------------------------------------

describe('P-6: tie-breaker survives a tied player declining', () => {
	// A 4-player game mid-tie-breaker: a and b tied; c and d played lower cards.
	function tieState(): GameState {
		const state = makeState([player('a'), player('b'), player('c'), player('d')]);
		state.players.forEach(p => (p.hand = [c('5'), c('6'), c('7')]));
		state.deck = Array.from({ length: 12 }, (_, i) => c('3', i % 2 ? 'hearts' : 'diamonds'));
		state.tablePile = [[c('K')], [c('K', 'hearts')], [c('4')], [c('2')]];
		state.tablePilePlayers = ['a', 'b', 'c', 'd'];
		state.tieBreakerActive = true;
		state.tiedPlayerIds = ['a', 'b'];
		state.tieBreakerStartPileSize = 4;
		state.activePlayerIdx = 0; // a's turn to play a tie-breaker card
		return state;
	}

	test('non-active tied player declines → tie resolves immediately for the other', () => {
		const state = tieState();
		applyDecline(state, 'b');

		expect(state.tieBreakerActive).toBe(false);
		expect(state.tiedPlayerIds).toEqual([]);
		// a wins the remaining pile without playing against nobody
		expect(state.trickWinnerId).toBe('a');
		expect(active(state).id).toBe('a');
		// b's batch was removed; a took the remaining 3 batches
		expect(state.players[0].reserveStack.length).toBe(3);

		applyClearTrick(state);
		expect(state.trickWinnerId).toBeNull();
		expect(active(state).id).toBe('a');
	});

	test('active tied player declines → the other tied player wins, turn is valid', () => {
		const state = tieState();
		applyDecline(state, 'a'); // a was active

		expect(state.tieBreakerActive).toBe(false);
		expect(state.trickWinnerId).toBe('b');
		expect(active(state).id).toBe('b');

		applyClearTrick(state);
		expect(active(state).hasLeft).toBeFalsy();
	});

	test('three-way tie: leaver mid-sub-round keeps the slice math correct', () => {
		const state = makeState([player('a'), player('b'), player('c')]);
		state.players.forEach(p => (p.hand = [c('5'), c('6'), c('7')]));
		state.deck = Array.from({ length: 12 }, (_, i) => c('3', i % 2 ? 'hearts' : 'diamonds'));
		// Round of 3 all tied on K; a already played their tie-breaker card (9)
		state.tablePile = [[c('K')], [c('K', 'hearts')], [c('K', 'clubs')], [c('9')]];
		state.tablePilePlayers = ['a', 'b', 'c', 'a'];
		state.tieBreakerActive = true;
		state.tiedPlayerIds = ['a', 'b', 'c'];
		state.tieBreakerStartPileSize = 3;
		state.activePlayerIdx = 1; // b to play

		// c declines before playing their tie card
		applyDecline(state, 'c');
		expect(state.tieBreakerActive).toBe(true);
		expect(state.tiedPlayerIds).toEqual(['a', 'b']);
		// c's round batch (before the sub-round) shifted the start offset,
		// a's tie-breaker play must still count as 1 sub-round play
		expect(state.tablePile.length - state.tieBreakerStartPileSize).toBe(1);

		// b plays a lower tie card → a must win with the 9
		const b = state.players.find(p => p.id === 'b')!;
		b.hand = [c('2', 'hearts'), ...b.hand.slice(1)];
		applyPlayCards(state, 'b', [b.hand[0].id]);

		expect(state.trickWinnerId).toBe('a');
		expect(state.tieBreakerActive).toBe(false);
	});

	test('all tied players leave → pile returns to owners, round restarts cleanly', () => {
		const state = tieState();
		applyDecline(state, 'a');
		// after a leaves, b is sole tied → trick pending for b; clear it first
		applyClearTrick(state);
		expect(state.tieBreakerActive).toBe(false);
		expect(state.status).toBe('playing');
		// c and d still in the game with a valid turn
		expect(active(state).hasLeft).toBeFalsy();
	});

	test('both tied players leave back-to-back before resolution', () => {
		const state = makeState([player('a'), player('b'), player('c'), player('d')]);
		state.players.forEach(p => (p.hand = [c('5'), c('6'), c('7')]));
		state.deck = Array.from({ length: 12 }, (_, i) => c('3', i % 2 ? 'hearts' : 'diamonds'));
		state.tablePile = [[c('K')], [c('K', 'hearts')], [c('4')], [c('2')]];
		state.tablePilePlayers = ['a', 'b', 'c', 'd'];
		state.tieBreakerActive = true;
		state.tiedPlayerIds = ['a', 'b'];
		state.tieBreakerStartPileSize = 4;
		state.activePlayerIdx = 0;

		applyDecline(state, 'a'); // degenerate: b wins pending trick
		applyClearTrick(state); // clear b's win
		applyDecline(state, 'b'); // now b leaves too

		expect(state.status).toBe('playing');
		expect(state.tieBreakerActive).toBe(false);
		expect(state.tiedPlayerIds).toEqual([]);
		// c and d play on; the turn is on someone who can act
		expect(active(state).hasLeft).toBeFalsy();
	});
});

// --- P-5: phase-2 burn with a player escaping mid-trick (pin test) ----------

describe('P-5: phase-2 escape mid-trick pin', () => {
	test('escaped player\'s staged batch still counts toward flipping the trick', () => {
		const state = makeState([player('a'), player('b'), player('c')], {
			phase: 2,
			trumpCard: c('A', 'hearts')
		});
		state.players[0].hand = [c('5')]; // a's last card — playing it escapes
		state.players[1].hand = [c('6'), c('7')];
		state.players[2].hand = [c('8'), c('9')];

		// a plays their last card and escapes mid-trick
		applyPlayCards(state, 'a', [state.players[0].hand[0].id]);
		expect(state.players[0].isDone).toBe(true);
		expect(state.status).toBe('playing');
		expect(active(state).id).toBe('b');

		playTopCard(state); // b
		playTopCard(state); // c — all three staged → trick flips
		expect(state.trickWinnerId).toBe('c');

		const staged = state.tablePile.flat().length;
		applyClearTrick(state);
		// burn: staged cards go to the discard pile
		expect(state.discardPile.length).toBe(staged);
		expect(state.tablePile.length).toBe(0);
		// game continues between b and c
		expect(state.status).toBe('playing');
		expect(active(state).isDone).toBe(false);
	});
});
