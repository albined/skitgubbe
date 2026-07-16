import { Hono } from 'hono';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { rooms } from '../rooms.js';
import { GameRoom } from '../gameRoom.js';
import { validateAccept, validateDeclineOrLeave } from '../utils/gameValidation.js';
import { sendInviteNotification } from '../notifications.js';

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
		const invites = invitedProfileIds || [];
		if (!Array.isArray(invites)) {
			return c.json({ error: 'Invalid request payload or failed to create game.' }, 400);
		}
		for (const id of invites) {
			if (!dbOps.getProfileById(id)) {
				return c.json({ error: 'Invited profile does not exist.' }, 400);
			}
		}
		const filteredInvites = invites.filter((id: string) => id !== profileId);
		if (filteredInvites.length === 0) {
			return c.json({ error: 'You must invite at least one other player to create a game.' }, 400);
		}
		const finalName = (name && name.trim()) ? name.trim().substring(0, 20) : roomId.toUpperCase();
		dbOps.createGame(roomId, profileId, finalName, filteredInvites);

		// Send invite notifications to each invited player asynchronously
		for (const inviteeId of filteredInvites) {
			sendInviteNotification(roomId, profileId, inviteeId, finalName).catch((err) => {
				console.error(`Failed to send invite notification to ${inviteeId}:`, err);
			});
		}

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
	const profileId = c.get('profileId');
	const isPlayer = players.some((p) => p.profile_id === profileId);
	if (!isPlayer) {
		return c.json({ error: 'Forbidden' }, 403);
	}
	return c.json({ game, players });
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

	// Always load/initialize GameRoom in memory to ensure proper replay and state transition
	let room = rooms.get(roomId);
	if (!room) {
		room = new GameRoom(roomId);
		rooms.set(roomId, room);
	}

	room.handleDecline(profileId);
	dbOps.removePlayerFromGame(roomId, profileId);

	return c.json({ success: true });
});


export { gamesApp };
