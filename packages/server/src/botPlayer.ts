import type { GameState, Player } from 'shared';
import { getLegalPlays, getValueNumeric } from 'shared';
import { dbOps } from './db.js';
import { applyPlayCards, applyChance, applyPickUp } from './gameLogic.js';

export interface BotGameContext {
	roomId: string;
	state: GameState;
	syncGameStatusToDb(): void;
	scheduleTrickCleanupTimeout(winnerId: string): void;
	broadcastState(): void;
	checkAndTriggerBotMove(): void;
}

export function checkAndTriggerBotMove(context: BotGameContext) {
	if (context.state.status !== 'playing' || context.state.trickWinnerId !== null) return;

	const activePlayer = context.state.players[context.state.activePlayerIdx];
	if (!activePlayer || !activePlayer.isBot || activePlayer.isDone) return;

	setTimeout(() => {
		if (context.state.status !== 'playing' || context.state.trickWinnerId !== null) return;
		const currentActive = context.state.players[context.state.activePlayerIdx];
		if (!currentActive || !currentActive.isBot || currentActive.isDone) return;

		executeBotTurn(context, currentActive);
	}, 1000);
}

export function executeBotTurn(context: BotGameContext, botPlayer: Player) {
	const playerId = botPlayer.id;
	const { roomId, state } = context;

	if (state.phase === 1) {
		if (botPlayer.hand.length > 0) {
			// Play the lowest value card(s) from hand
			const sortedHand = [...botPlayer.hand].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
			const lowestVal = sortedHand[0].value;
			const cardsToPlay = sortedHand.filter(c => c.value === lowestVal);
			const cardIds = cardsToPlay.map(c => c.id);

			const seq = dbOps.getNextMoveSeq(roomId);
			dbOps.saveMove(roomId, seq, playerId, 'P', cardsToPlay);
			applyPlayCards(state, playerId, cardIds);

			context.syncGameStatusToDb();
			if (state.trickWinnerId !== null) {
				context.scheduleTrickCleanupTimeout(state.trickWinnerId);
			}
			context.broadcastState();
			context.checkAndTriggerBotMove();
		} else if (state.deck.length > 0) {
			const chancedCard = state.deck[state.deck.length - 1];
			const seq = dbOps.getNextMoveSeq(roomId);
			dbOps.saveMove(roomId, seq, playerId, 'C', [chancedCard]);
			applyChance(state, playerId, chancedCard);

			context.syncGameStatusToDb();
			if (state.trickWinnerId !== null) {
				context.scheduleTrickCleanupTimeout(state.trickWinnerId);
			}
			context.broadcastState();
			context.checkAndTriggerBotMove();
		}
	} else {
		// Phase 2
		const trumpSuit = state.trumpCard ? state.trumpCard.suitName : null;
		const legalPlays = getLegalPlays(botPlayer.hand, state.tablePile, trumpSuit);

		if (legalPlays.length > 0) {
			// Select a play with the lowest value cards
			legalPlays.sort((a, b) => getValueNumeric(a[0]) - getValueNumeric(b[0]));
			const chosenPlay = legalPlays[0];
			const cardIds = chosenPlay.map(c => c.id);

			const seq = dbOps.getNextMoveSeq(roomId);
			dbOps.saveMove(roomId, seq, playerId, 'P', chosenPlay);
			applyPlayCards(state, playerId, cardIds);

			context.syncGameStatusToDb();
			if (state.trickWinnerId !== null) {
				context.scheduleTrickCleanupTimeout(state.trickWinnerId);
			}
			context.broadcastState();
			context.checkAndTriggerBotMove();
		} else {
			// Pick up pile
			const seq = dbOps.getNextMoveSeq(roomId);
			dbOps.saveMove(roomId, seq, playerId, 'U');
			applyPickUp(state, playerId);

			context.syncGameStatusToDb();
			context.broadcastState();
			context.checkAndTriggerBotMove();
		}
	}
}
