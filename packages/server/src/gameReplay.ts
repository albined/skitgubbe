import type { GameState, Card, Player } from 'shared';
import { cardsFromString } from 'shared';
import type { DbGamePlayer, DbMove } from './db.js';
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

export function replayGame(
	roomId: string,
	dbPlayers: DbGamePlayer[],
	initialDeck: Card[],
	moves: DbMove[]
): GameState {
	// 1. Initialize empty state with players registered in dbPlayers
	const players: Player[] = dbPlayers.map(p => {
		const hasJoinMove = moves.some(m => m.player_id === p.profile_id && m.move_type === 'A');
		return {
			id: p.profile_id,
			name: p.name || 'Unknown',
			color: p.color || '#3b82f6',
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
		logs: [`Room ${roomId} initialized for replay.`],
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: null
	};

	// 2. Play through all moves sequentially
	for (const move of moves) {
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
				applyPlayCards(state, playerId, cardList.map(c => c.id));
				break;

			case 'U': // Pick Up Pile
				applyPickUp(state, playerId);
				break;

			case 'C': // Chance Card
				if (cardList.length > 0) {
					applyChance(state, playerId, cardList[0]);
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
				break;
			}

			case 'L': // Leave / Decline
				applyDecline(state, playerId);
				break;
		}
	}

	return state;
}
