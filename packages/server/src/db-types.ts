import type { ApiProfile } from 'shared';

// A profiles row is served verbatim by /api/profiles — the wire DTO in
// packages/shared is the single source of truth for its shape.
export type DbProfile = ApiProfile;

export interface DbProfileAccessLog {
	id: number;
	profile_id: string;
	device_info: string | null;
	ip_address: string | null;
	location: string | null;
	accessed_at: string;
}

export interface DbGame {
	id: string;
	name: string;
	status: 'waiting' | 'playing' | 'ended';
	active_player_id: string | null;
	initial_deck: string | null;
	created_at: string;
	updated_at: string;
}

export interface DbGamePlayer {
	game_id: string;
	profile_id: string;
	role: 'host' | 'player';
	is_ready: number;
	invite_status: 'pending' | 'accepted';
	turn_order: number;
	is_archived?: number;
	name?: string; // joined from profiles
	color?: string; // joined from profiles
	avatar_config?: string | null; // joined from profiles
}

export interface DbMove {
	id: number;
	game_id: string;
	seq: number;
	player_id: string;
	move_type: 'S' | 'P' | 'U' | 'C' | 'R' | 'A' | 'L' | 'T';
	cards: string | null;
	created_at: string;
}

export interface DbChat {
	id: number;
	game_id: string;
	player_id: string;
	message: string | null;
	emote: string | null;
	seq: number;
	created_at: string;
}

export interface DbNativePushRegistration {
	installation_id: string;
	profile_id: string;
	token: string;
	platform: 'android';
	secret: string | null;
	created_at: string;
	updated_at: string;
}
