import { dbOps } from '../db.js';

export interface ValidationResult {
	success: boolean;
	error?: string;
	code?: number;
}

export function validateJoin(roomId: string, profileId: string): ValidationResult {
	const game = dbOps.getGame(roomId);
	if (!game) {
		return { success: false, error: 'Game not found', code: 404 };
	}
	if (game.status !== 'waiting') {
		return { success: false, error: 'Game already in progress', code: 400 };
	}
	const players = dbOps.getGamePlayers(roomId);
	const existing = players.find((p) => p.profile_id === profileId);
	if (existing && existing.invite_status === 'accepted') {
		return { success: true }; // Already joined/accepted
	}
	if (players.length >= 10) {
		return { success: false, error: 'Room lobby is full', code: 400 };
	}
	return { success: true };
}

export function validateAccept(roomId: string, profileId: string): ValidationResult {
	const game = dbOps.getGame(roomId);
	if (!game) {
		return { success: false, error: 'Game not found', code: 404 };
	}
	if (game.status !== 'waiting') {
		return { success: false, error: 'Game already in progress', code: 400 };
	}
	const players = dbOps.getGamePlayers(roomId);
	const existing = players.find((p) => p.profile_id === profileId);
	if (!existing) {
		return { success: false, error: 'You are not invited to this game', code: 403 };
	}
	if (existing.invite_status === 'accepted') {
		return { success: true }; // Already accepted
	}
	if (players.length >= 10) {
		return { success: false, error: 'Room lobby is full', code: 400 };
	}
	return { success: true };
}

export function validateDeclineOrLeave(roomId: string, profileId: string): ValidationResult {
	const game = dbOps.getGame(roomId);
	if (!game) {
		return { success: false, error: 'Game not found', code: 404 };
	}
	const players = dbOps.getGamePlayers(roomId);
	const existing = players.find((p) => p.profile_id === profileId);
	if (!existing) {
		return { success: false, error: 'You are not part of this game', code: 403 };
	}
	return { success: true };
}
