import { Hono } from 'hono';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { rooms } from '../rooms.js';

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
	const game = dbOps.getGame(roomId);
	if (!game) {
		return c.json({ error: 'Game not found' }, 404);
	}
	if (game.status !== 'waiting') {
		return c.json({ error: 'Game already in progress' }, 400);
	}
	const players = dbOps.getGamePlayers(roomId);
	if (players.length >= 10) {
		return c.json({ error: 'Room lobby is full' }, 400);
	}
	dbOps.joinGame(roomId, profileId);
	return c.json({ success: true });
});

// Accept invitation
gamesApp.post('/:roomId/accept', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');
	dbOps.joinGame(roomId, profileId);

	// Sync in-memory GameRoom
	const room = rooms.get(roomId);
	if (room) {
		room.handleAccept(profileId);
	}
	return c.json({ success: true });
});

// Decline invitation
gamesApp.post('/:roomId/decline', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');
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
	dbOps.removePlayerFromGame(roomId, profileId);

	// Sync in-memory GameRoom
	const room = rooms.get(roomId);
	if (room) {
		room.handleDecline(profileId);
	}
	return c.json({ success: true });
});

// Start the game room
gamesApp.post('/:roomId/start', authMiddleware, (c) => {
	const roomId = c.req.param('roomId')!;
	const profileId = c.get('profileId');
	const game = dbOps.getGame(roomId);
	if (!game) {
		return c.json({ error: 'Game not found' }, 404);
	}
	const players = dbOps.getGamePlayers(roomId);
	const caller = players.find((p) => p.profile_id === profileId);
	if (!caller || caller.role !== 'host') {
		return c.json({ error: 'Only the host can start the game' }, 403);
	}
	const notReady = players.filter((p) => !p.is_ready);
	if (notReady.length > 0) {
		return c.json({ error: 'Not all players are ready' }, 400);
	}
	if (players.length < 2) {
		return c.json({ error: 'Need at least 2 players to start' }, 400);
	}

	dbOps.updateGameStatus(roomId, 'playing', profileId);
	return c.json({ success: true });
});

export { gamesApp };
