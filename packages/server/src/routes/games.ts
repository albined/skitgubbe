import { Hono } from 'hono';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { rooms } from '../rooms.js';
import { validateJoin, validateAccept, validateDeclineOrLeave } from '../utils/gameValidation.js';

const gamesApp = new Hono<{ Variables: { profileId: string } }>();

// Get games involving current profile
gamesApp.get('/', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const games = dbOps.getGamesForProfile(profileId);
	return c.json(games);
});

// Get archived games involving current profile
gamesApp.get('/archived', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const games = dbOps.getArchivedGamesForProfile(profileId);
	return c.json(games);
});

// Batch archive games for current profile
gamesApp.post('/archive', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { gameIds } = await c.req.json();
		if (!gameIds || !Array.isArray(gameIds)) {
			return c.json({ error: 'gameIds must be an array' }, 400);
		}
		dbOps.archiveGames(profileId, gameIds);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to archive games' }, 500);
	}
});

// Batch unarchive games for current profile
gamesApp.post('/unarchive', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { gameIds } = await c.req.json();
		if (!gameIds || !Array.isArray(gameIds)) {
			return c.json({ error: 'gameIds must be an array' }, 400);
		}
		dbOps.unarchiveGames(profileId, gameIds);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to unarchive games' }, 500);
	}
});

// Create new game room in DB
gamesApp.post('/create', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	const roomId = Math.random().toString(36).substring(2, 8);
	try {
		const { name, invitedProfileIds } = await c.req.json();
		const filteredInvites = (invitedProfileIds || []).filter((id: string) => id !== profileId);
		if (filteredInvites.length === 0) {
			return c.json({ error: 'You must invite at least one other player to create a game.' }, 400);
		}
		const finalName = (name && name.trim()) ? name.trim().substring(0, 20) : roomId.toUpperCase();
		dbOps.createGame(roomId, profileId, finalName, filteredInvites);
		return c.json({ roomId });
	} catch (e) {
		return c.json({ error: 'Invalid request payload or failed to create game.' }, 400);
	}
});

// Get details of specific game room (used for lobby screen)
gamesApp.get('/:roomId', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const game = dbOps.getGame(roomId);
	if (!game) {
		return c.json({ error: 'Game not found' }, 404);
	}
	const players = dbOps.getGamePlayers(roomId);
	return c.json({ game, players });
});

// Join an existing game room
gamesApp.post('/:roomId/join', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');
	
	const val = validateJoin(roomId, profileId);
	if (!val.success) {
		return c.json({ error: val.error }, val.code as any);
	}

	dbOps.joinGame(roomId, profileId);
	return c.json({ success: true });
});

// Accept invitation
gamesApp.post('/:roomId/accept', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');

	const val = validateAccept(roomId, profileId);
	if (!val.success) {
		return c.json({ error: val.error }, val.code as any);
	}

	// Persist accept in DB
	dbOps.joinGame(roomId, profileId);

	// Sync in-memory GameRoom if it's already loaded
	const room = rooms.get(roomId);
	if (room) {
		// handleAccept saves the 'A' move and applies the state transition
		room.handleAccept(profileId);
	} else {
		// Room not in memory yet — save the 'A' move so the replay engine
		// knows this player accepted when they first connect via WebSocket.
		const seq = dbOps.getNextMoveSeq(roomId);
		dbOps.saveMove(roomId, seq, profileId, 'A');
	}
	return c.json({ success: true });
});

// Decline invitation
gamesApp.post('/:roomId/decline', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');

	const val = validateDeclineOrLeave(roomId, profileId);
	if (!val.success) {
		return c.json({ error: val.error }, val.code as any);
	}

	dbOps.removePlayerFromGame(roomId, profileId);

	// Sync in-memory GameRoom
	const room = rooms.get(roomId);
	if (room) {
		room.handleDecline(profileId);
	}
	return c.json({ success: true });
});

// Toggle player ready state in a lobby
gamesApp.post('/:roomId/ready', authMiddleware, async (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');
	try {
		const { isReady } = await c.req.json();
		dbOps.setPlayerReady(roomId, profileId, isReady);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to update ready state' }, 500);
	}
});

// Leave a game lobby
gamesApp.post('/:roomId/leave', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');

	const val = validateDeclineOrLeave(roomId, profileId);
	if (!val.success) {
		return c.json({ error: val.error }, val.code as any);
	}

	dbOps.removePlayerFromGame(roomId, profileId);

	// Sync in-memory GameRoom
	const room = rooms.get(roomId);
	if (room) {
		room.handleDecline(profileId);
	}
	return c.json({ success: true });
});

export { gamesApp };
