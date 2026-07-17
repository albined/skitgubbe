// Wire DTOs for the REST API, shared by the Hono routes (producers, see
// packages/server/src/db.ts and routes/) and the SvelteKit client state
// (consumers). Field names mirror the SQL result columns — change a query or
// a consumer and the build breaks on drift, which is the point.

export interface ApiProfile {
	id: string;
	name: string;
	color: string;
	created_at: string;
	avatar_config?: string | null;
}

// GET /api/profiles/me/logs
export interface ApiAccessLog {
	id: number;
	profile_id: string;
	device_info: string | null;
	ip_address: string | null;
	location: string | null;
	accessed_at: string;
	device_display: string;
	location_display: string;
}

// GET /api/games (one row per game the profile is in)
export interface ApiGameSummary {
	id: string;
	name: string | null;
	status: 'waiting' | 'playing' | 'ended';
	active_player_id: string | null;
	updated_at: string;
	active_player_name: string | null;
	active_player_color: string | null;
	role: 'host' | 'player';
	invite_status: 'pending' | 'accepted';
	is_archived: number;
	is_my_turn: number;
}

// GET /api/games/archived
export interface ApiArchivedGame extends ApiGameSummary {
	loser_name: string | null;
	loser_color: string | null;
	loser_avatar_config: string | null;
}

// GET /api/skitgubbe/current
export interface ApiCurrentSkitgubbe {
	acquired_at: string;
	id: string;
	name: string;
	color: string;
	avatar_config: string | null;
}

// GET /api/skitgubbe/history
export interface ApiSkitgubbeHistoryEntry {
	id: number;
	acquired_at: string;
	profile_id: string;
	profile_name: string;
	profile_color: string;
	profile_avatar: string | null;
	game_name: string | null;
}

// GET /api/statistics
export interface ApiPlayerStats {
	id: string;
	name: string;
	color: string;
	avatar_config: string | null;
	games: number;
	skitgubbe: number;
	sweetgubbe: number;
	trumfman: number;
	constipated: number;
	mega_constipated: number;
}

export interface ApiStatsCounts {
	games: number;
	skitgubbe: number;
	sweetgubbe: number;
	trumfman: number;
	constipated: number;
	mega_constipated: number;
}

// GET /api/statistics/:profileId
export interface ApiPlayerStatsBreakdown {
	last10: ApiStatsCounts;
	last50: ApiStatsCounts;
	all: ApiStatsCounts;
}
