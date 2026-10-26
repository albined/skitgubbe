import type { Player } from './types.js';

// Trumfman and Sweetgubbe are held per player across games: earned the moment
// a game reaches phase 2, lost when a later-decided game finishes without it.
// Any number of players can hold one; a player holds at most one of the two.
export type LuckTitle = 'trumfman' | 'sweetgubbe';

export type RoomTitle = 'skitgubbe' | LuckTitle | null;

export interface PlayerTitles {
	skitgubbeId: string | null;
	luck: Record<string, LuckTitle>;
}

type TitledPlayer = Pick<Player, 'id' | 'isSkitgubbe' | 'isTrumfman' | 'isSweetgubbe'>;

// The title a player got within one game, as replays show it. Skitgubbe
// outranks the luck titles.
export function gameTitle(player: TitledPlayer | undefined): RoomTitle {
	if (player?.isSkitgubbe) return 'skitgubbe';
	if (player?.isTrumfman) return 'trumfman';
	if (player?.isSweetgubbe) return 'sweetgubbe';
	return null;
}

// The one title a player shows in a room. A finished game keeps showing its
// own outcome; any other game shows the global titles, where skitgubbe hides
// a luck title until the hat passes to someone else.
export function roomTitle(
	state: { status: string; players: TitledPlayer[] },
	playerId: string,
	titles: PlayerTitles | null
): RoomTitle {
	if (state.status === 'ended' && state.players.some((p) => p.isSkitgubbe)) {
		return gameTitle(state.players.find((p) => p.id === playerId));
	}
	if (titles?.skitgubbeId === playerId) return 'skitgubbe';
	return titles?.luck[playerId] ?? null;
}
