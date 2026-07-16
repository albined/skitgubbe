import type { GameState, Card, Player } from 'shared';
import { cardsFromString } from 'shared';
import type { DbGamePlayer, DbMove } from './db-types.js';
import {
	applyStartGame,
	applyPlayCards,
	applyPickUp,
	applyChance,
	applySprinkle,
	applyJoin,
	applyDecline,
	applyClearTrick
} from './gameLogic.js';

// Rebuilds a game's state by folding its move log. This is the ONE place
// that maps persisted move types onto apply* transitions — both crash
// recovery (GameRoom construction) and the reconnect replay protocol
// (getSanitizedStatesRange) go through here.
//
// `onState`, when given, is invoked with the state at every sequence number:
// once for the initial state (seq 0) and once after each applied move
// (seq i+1). The same mutable state object is passed each time — snapshot it
// if you need to keep it.
export function replayGame(
	roomId: string,
	dbPlayers: DbGamePlayer[],
	initialDeck: Card[],
	moves: DbMove[],
	onState?: (state: GameState) => void
): GameState {
	// 1. Initialize empty state with players registered in dbPlayers
	const players: Player[] = dbPlayers.map(p => {
		const hasJoinMove = moves.some(m => m.player_id === p.profile_id && m.move_type === 'A');
		return {
			id: p.profile_id,
			name: p.name || 'Unknown',
			color: p.color || '#3b82f6',
			avatarConfig: p.avatar_config || undefined,
			hand: [],
			reserveStack: [],
			isDone: false,
			isSkitgubbe: false,
			isHost: p.role === 'host',
			inviteStatus: hasJoinMove ? 'pending' : (p.invite_status as 'pending' | 'accepted')
		};
	});

	const state: GameState = {
		status: 'waiting',
		phase: 1,
		activePlayerIdx: 0,
		players,
		deck: [],
		tablePile: [],
		tablePilePlayers: [],
		discardPile: [],
		trumpCard: null,
		hiddenTrumpStorage: null,
		// User-visible in pre-start rooms — Swedish (diagnostics stay English)
		logs: ['Rummet är skapat. Väntar på att spelet ska starta.'],
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null,
		lastChanceCardId: null,
		seq: 0
	};

	onState?.(state);

	// 2. Play through all moves sequentially
	for (let i = 0; i < moves.length; i++) {
		const move = moves[i];

		// Rule: If there is a pending trick winner before applying a new user action,
		// we must clear it first (since in live play this happens via timeout).
		if (state.trickWinnerId !== null) {
			applyClearTrick(state);
		}

		const playerId = move.player_id;
		const cardList = move.cards ? cardsFromString(move.cards) : [];

		switch (move.move_type) {
			case 'S': // Start Game
				applyStartGame(state, initialDeck);
				break;

			case 'P': // Play Cards
				applyPlayCards(state, playerId, cardList.map(c => c.id), true);
				break;

			case 'U': // Pick Up Pile
				applyPickUp(state, playerId, true);
				break;

			case 'C': // Chance Card
				if (cardList.length > 0) {
					applyChance(state, playerId, cardList[0], true);
				}
				break;

			case 'R': // Sprinkle
				applySprinkle(state, playerId, cardList.map(c => c.id));
				break;

			case 'A': { // Accept / Join
				const dbPlayer = dbPlayers.find(p => p.profile_id === playerId);
				const name = dbPlayer?.name || 'Unknown';
				const color = dbPlayer?.color || '#3b82f6';
				applyJoin(state, playerId, name, color);
				const joined = state.players.find(p => p.id === playerId);
				if (joined && dbPlayer?.avatar_config) {
					joined.avatarConfig = dbPlayer.avatar_config;
				}
				break;
			}

			case 'L': // Leave / Decline
				applyDecline(state, playerId);
				break;

			case 'T': // Clear Trick
				applyClearTrick(state);
				break;
		}

		state.seq = i + 1;
		onState?.(state);
	}

	return state;
}
