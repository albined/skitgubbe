import { encodeReplayFrame, type Card, type ReplayFrame } from 'shared';
import type { DbGamePlayer, DbMove } from './db-types.js';
import { replayGame } from './gameReplay.js';

// The lines a move appended to the game log. The log keeps only its last 80
// lines (logState in gameLogic.ts), so lines may also have dropped off the front.
export function logLinesAdded(prev: string[], next: string[]): string[] {
	for (let dropped = 0; dropped <= prev.length; dropped++) {
		const kept = prev.length - dropped;
		if (kept > next.length) continue;
		let same = true;
		for (let i = 0; i < kept && same; i++) same = next[i] === prev[dropped + i];
		if (same) return next.slice(kept);
	}
	return next.slice();
}

// Every position of a game, from before the first move to after the last, for
// watching a finished game back. Cards are face up, so never send this for a
// game that is still being played.
export function replayFrames(
	roomId: string,
	dbPlayers: DbGamePlayer[],
	initialDeck: Card[],
	moves: DbMove[]
): ReplayFrame[] {
	const frames: ReplayFrame[] = [];
	let prevLogs: string[] = [];
	replayGame(roomId, dbPlayers, initialDeck, moves, (state) => {
		const move = state.seq > 0 ? moves[state.seq - 1] : null;
		frames.push(
			encodeReplayFrame(
				state,
				move && { type: move.move_type, playerId: move.player_id, at: move.created_at },
				logLinesAdded(prevLogs, state.logs)
			)
		);
		prevLogs = state.logs.slice();
	});
	return frames;
}
