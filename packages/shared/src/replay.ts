import type { GameState } from './types.js';
import { cardsFromString, cardsToString } from './cardCodec.js';

// How game_moves.move_type records a move (folded by packages/server/src/gameReplay.ts).
export type MoveType = 'S' | 'P' | 'U' | 'C' | 'R' | 'A' | 'L' | 'T';

// Who played in a replayed game; frames refer to them by id.
export interface ReplayPerson {
	id: string;
	name: string;
	color: string;
	avatar_config?: string | null;
}

// One player's part of a frame. Flags are left out while false.
export interface ReplayFramePlayer {
	id: string;
	hand: string;
	reserveStack: string;
	isDone?: true;
	isSkitgubbe?: true;
	hasLeft?: true;
	isSweetgubbe?: true;
	isTrumfman?: true;
	isConstipated?: true;
	isMegaConstipated?: true;
}

// The table of a finished game after one saved move, every card face up.
// Card lists use the game_moves.cards encoding (cardsToString), which keeps a
// whole game to a few hundred kilobytes.
export interface ReplayFrame {
	move: { type: MoveType; playerId: string; at: string } | null; // null before the first move
	status: GameState['status'];
	phase: GameState['phase'];
	activePlayerIdx: number;
	trickWinnerId: string | null;
	deck: string;
	discardPile: string;
	trumpCard: string;
	hiddenTrump: { playerId: string; card: string } | null;
	tablePile: string[];
	tablePilePlayers: string[];
	players: ReplayFramePlayer[];
	log: string[]; // the lines this move added to the game log
}

export function encodeReplayFrame(
	state: GameState,
	move: ReplayFrame['move'],
	log: string[]
): ReplayFrame {
	return {
		move,
		status: state.status,
		phase: state.phase,
		activePlayerIdx: state.activePlayerIdx,
		trickWinnerId: state.trickWinnerId,
		deck: cardsToString(state.deck),
		discardPile: cardsToString(state.discardPile),
		trumpCard: state.trumpCard ? cardsToString([state.trumpCard]) : '',
		hiddenTrump: state.hiddenTrumpStorage
			? {
					playerId: state.hiddenTrumpStorage.playerId,
					card: cardsToString([state.hiddenTrumpStorage.card])
				}
			: null,
		tablePile: state.tablePile.map(cardsToString),
		tablePilePlayers: [...state.tablePilePlayers],
		players: state.players.map((p) => ({
			id: p.id,
			hand: cardsToString(p.hand),
			reserveStack: cardsToString(p.reserveStack),
			isDone: p.isDone || undefined,
			isSkitgubbe: p.isSkitgubbe || undefined,
			hasLeft: p.hasLeft || undefined,
			isSweetgubbe: p.isSweetgubbe || undefined,
			isTrumfman: p.isTrumfman || undefined,
			isConstipated: p.isConstipated || undefined,
			isMegaConstipated: p.isMegaConstipated || undefined
		})),
		log
	};
}

export function decodeReplayFrame(frame: ReplayFrame, people: ReplayPerson[]): GameState {
	return {
		status: frame.status,
		phase: frame.phase,
		activePlayerIdx: frame.activePlayerIdx,
		players: frame.players.map((p) => {
			const person = people.find((x) => x.id === p.id);
			return {
				id: p.id,
				name: person?.name ?? '',
				color: person?.color ?? '#3b82f6',
				avatarConfig: person?.avatar_config ?? undefined,
				hand: cardsFromString(p.hand),
				reserveStack: cardsFromString(p.reserveStack),
				isDone: !!p.isDone,
				isSkitgubbe: !!p.isSkitgubbe,
				isHost: false,
				inviteStatus: 'accepted',
				hasLeft: !!p.hasLeft,
				isSweetgubbe: !!p.isSweetgubbe,
				isTrumfman: !!p.isTrumfman,
				isConstipated: !!p.isConstipated,
				isMegaConstipated: !!p.isMegaConstipated
			};
		}),
		deck: cardsFromString(frame.deck),
		tablePile: frame.tablePile.map(cardsFromString),
		tablePilePlayers: [...frame.tablePilePlayers],
		discardPile: cardsFromString(frame.discardPile),
		trumpCard: frame.trumpCard ? cardsFromString(frame.trumpCard)[0] : null,
		hiddenTrumpStorage: frame.hiddenTrump
			? { playerId: frame.hiddenTrump.playerId, card: cardsFromString(frame.hiddenTrump.card)[0] }
			: null,
		logs: frame.log,
		tieBreakerActive: false,
		tiedPlayerIds: [],
		tieBreakerStartPileSize: 0,
		trickWinnerId: frame.trickWinnerId,
		seq: 0
	};
}
