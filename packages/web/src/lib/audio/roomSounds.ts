import type { SanitizedGameState } from 'shared';
import type { PlayOptions, SoundId } from './sfx';

export interface SoundCue extends PlayOptions {
	id: SoundId;
}

// Other players' card sounds sit behind your own.
const OPPONENT_DB = -6;
// When a played card visually lands: the flights take 450 ms (yours) and 600 ms
// (opponents') with an ease-out, so they arrive well before they finish.
const LANDING = { local: 0.2, opponent: 0.28 };
// Matches the 150 ms stagger of cards dealt into your hand (CardTransitions).
const DRAW_STAGGER = 0.15;

// The same key TablePile uses for a batch, so Strö (a batch growing) is told
// apart from a new play.
function batchKey(state: SanitizedGameState, index: number): string {
	return `${state.tablePilePlayers[index]}-${state.tablePile[index][0]?.id ?? ''}`;
}

// Mirrors RoomState.isHumanTurn: the turn is yours and nothing is pending.
function canAct(state: SanitizedGameState, localId: string): boolean {
	const local = state.players.find((p) => p.id === localId);
	return (
		state.status === 'playing' &&
		state.players[state.activePlayerIdx]?.id === localId &&
		!state.trickWinnerId &&
		!!local &&
		!local.isDone &&
		!local.isSkitgubbe
	);
}

function escapeCues(
	prev: SanitizedGameState,
	next: SanitizedGameState,
	localId: string,
	delay: number
): SoundCue[] {
	return next.players
		.filter((player) => {
			const before = prev.players.find((p) => p.id === player.id);
			return player.isDone && !player.isSkitgubbe && before && !before.isDone;
		})
		.map(
			(player): SoundCue => ({ id: player.id === localId ? 'escape_you' : 'escape_other', delay })
		);
}

/**
 * The sounds for one live state update, worked out from what changed. The
 * Skitgubbe ending, chat, selection and dragging are cued where they happen
 * instead (RoomState, CardDragState).
 */
export function cuesForStateChange(
	prev: SanitizedGameState | null,
	next: SanitizedGameState,
	localId: string
): SoundCue[] {
	if (!prev || !localId) return [];
	const gainFor = (playerId: string | undefined) => (playerId === localId ? 0 : OPPONENT_DB);

	// Phase 2 begins: one chapter-break sound rather than every card moving at once.
	if (prev.phase === 1 && next.phase === 2) {
		const cues: SoundCue[] = [{ id: 'phase2_start' }, ...escapeCues(prev, next, localId, 1.0)];
		if (canAct(next, localId)) cues.push({ id: 'your_turn', delay: 1.2 });
		return cues;
	}

	const cues: SoundCue[] = [];

	// Plays landing on the table, Chansa, and Strö (a batch growing).
	const before = new Map(prev.tablePile.map((batch, i) => [batchKey(prev, i), batch.length]));
	next.tablePile.forEach((batch, i) => {
		const owner = next.tablePilePlayers[i];
		const delay = owner === localId ? LANDING.local : LANDING.opponent;
		const count = before.get(batchKey(next, i));
		if (count === undefined) {
			const chanced = batch.length === 1 && batch[0].id === next.lastChanceCardId;
			cues.push(
				chanced
					? { id: 'chance', gainDb: gainFor(owner) }
					: { id: 'card_play', delay, gainDb: gainFor(owner) }
			);
		} else if (batch.length > count) {
			cues.push({ id: 'card_play', delay, gainDb: gainFor(owner) });
		}
	});

	// The table clears: a won Phase 1 trick flies to its winner, a Phase 2 table burns.
	if (prev.trickWinnerId && prev.tablePile.length > 0 && next.tablePile.length === 0) {
		cues.push({ id: prev.phase === 2 ? 'burn' : 'trick_take' });
	}

	// Phase 1: replacement cards dealt into your hand from the deck.
	if (prev.phase === 1 && next.phase === 1) {
		const had = new Set(prev.players.find((p) => p.id === localId)?.hand.map((c) => c.id));
		const drawn = next.players.find((p) => p.id === localId)?.hand.filter((c) => !had.has(c.id));
		drawn?.forEach((_, i) => cues.push({ id: 'card_draw', delay: 0.1 + i * DRAW_STAGGER }));
	}

	// Plocka: the oldest Phase 2 batch moves into the hand of whoever was to play.
	if (prev.phase === 2 && !prev.trickWinnerId && prev.tablePile.length > 0) {
		const oldest = batchKey(prev, 0);
		const pickerId = prev.players[prev.activePlayerIdx]?.id;
		const handSize = (state: SanitizedGameState) =>
			state.players.find((p) => p.id === pickerId)?.hand.length ?? 0;
		const pickedUp =
			next.tablePile.length === prev.tablePile.length - 1 &&
			!next.tablePile.some((_, i) => batchKey(next, i) === oldest) &&
			handSize(next) - handSize(prev) === prev.tablePile[0].length;
		if (pickedUp) cues.push({ id: 'card_draw', gainDb: gainFor(pickerId) });
	}

	const landed = cues.length > 0;
	cues.push(...escapeCues(prev, next, localId, landed ? 0.3 : 0));
	if (canAct(next, localId) && !canAct(prev, localId)) {
		cues.push({ id: 'your_turn', delay: landed ? 0.5 : 0 });
	}
	return cues;
}
