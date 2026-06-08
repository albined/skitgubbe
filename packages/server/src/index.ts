import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { GameRoom } from './gameRoom.js';
import { dbOps } from './db.js';

const app = new Hono<{ Variables: { profileId: string } }>();
const JWT_SECRET = process.env.JWT_SECRET || 'skitgubbe-super-secret-key-12345';

const { upgradeWebSocket, websocket } = createBunWebSocket();

const rooms = new Map<string, GameRoom>();

// Auth Middleware helper
async function authMiddleware(c: any, next: any) {
	const token = getCookie(c, 'skitgubbe_session');
	if (!token) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	try {
		const payload = await verify(token, JWT_SECRET, 'HS256');
		c.set('profileId', payload.profileId as string);
		await next();
	} catch (e) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
}

// REST API Routes

// List all profiles
app.get('/api/profiles', (c) => {
	const profiles = dbOps.getAllProfiles();
	return c.json(profiles);
});

function generateProfileId(): string {
	let id = '';
	while (id.length < 8) {
		id += Math.random().toString(36).substring(2);
	}
	return id.substring(0, 8).toUpperCase();
}

// Create profile
app.post('/api/profiles', async (c) => {
	try {
		const { name, color } = await c.req.json();
		if (!name || !color) {
			return c.json({ error: 'Name and color are required' }, 400);
		}
		const id = generateProfileId();
		const profile = dbOps.createProfile(id, name, color);
		return c.json(profile);
	} catch (e) {
		return c.json({ error: 'Failed to create profile' }, 500);
	}
});

// Select profile (login via JWT)
app.post('/api/profiles/:id/select', async (c) => {
	const id = c.req.param('id');
	const profile = dbOps.getProfileById(id);
	if (!profile) {
		return c.json({ error: 'Profile not found' }, 404);
	}
	// Sign JWT valid for 30 days
	const token = await sign(
		{
			profileId: profile.id,
			exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
		},
		JWT_SECRET,
		'HS256'
	);
	
	setCookie(c, 'skitgubbe_session', token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'Lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});

	// Log access
	const userAgent = c.req.header('user-agent') || 'Unknown Device';
	const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'Unknown IP';
	dbOps.logProfileAccess(profile.id, userAgent, ipAddress);

	return c.json({ success: true, profile });
});

// Logout profile
app.post('/api/profiles/logout', (c) => {
	deleteCookie(c, 'skitgubbe_session', { path: '/' });
	return c.json({ success: true });
});

// Get current profile info
app.get('/api/profiles/me', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const profile = dbOps.getProfileById(profileId);
	if (!profile) {
		return c.json({ error: 'Profile not found' }, 404);
	}
	return c.json(profile);
});

// Get profile access logs
app.get('/api/profiles/me/logs', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const logs = dbOps.getProfileAccessLogs(profileId);
	return c.json(logs);
});

// Update profile
app.put('/api/profiles/me', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { name, color } = await c.req.json();
		if (!name || !color) {
			return c.json({ error: 'Name and color are required' }, 400);
		}
		dbOps.updateProfile(profileId, name, color);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to update profile' }, 500);
	}
});

// Update profile avatar
app.put('/api/profiles/me/avatar', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { avatar_config } = await c.req.json();
		if (avatar_config === undefined) {
			return c.json({ error: 'avatar_config is required' }, 400);
		}
		const configStr = JSON.stringify(avatar_config);
		if (configStr.length > 20000) {
			return c.json({ error: 'avatar_config payload too large' }, 400);
		}
		dbOps.updateProfileAvatar(profileId, configStr);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to update avatar' }, 500);
	}
});

// Get the current global skitgubbe
app.get('/api/skitgubbe/current', authMiddleware, (c) => {
	const current = dbOps.getCurrentGlobalSkitgubbe();
	return c.json(current);
});

// Get the skitgubbe coronation history log
app.get('/api/skitgubbe/history', authMiddleware, (c) => {
	const history = dbOps.getSkitgubbeHistory();
	return c.json(history);
});

// Get all players statistics
app.get('/api/statistics', authMiddleware, (c) => {
	const stats = dbOps.getAllPlayerStats();
	return c.json(stats);
});

// Get detailed stats breakdown for a player
app.get('/api/statistics/:profileId', authMiddleware, (c) => {
	const profileId = c.req.param('profileId');
	const stats = dbOps.getPlayerStatsBreakdown(profileId);
	return c.json(stats);
});

// Get games involving current profile
app.get('/api/games', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const games = dbOps.getGamesForProfile(profileId);
	return c.json(games);
});

// Create new game room in DB
app.post('/api/games/create', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	const roomId = Math.random().toString(36).substring(2, 8);
	try {
		const { name, invitedProfileIds } = await c.req.json();
		const finalName = (name && name.trim()) ? name.trim().substring(0, 20) : roomId.toUpperCase();
		dbOps.createGame(roomId, profileId, finalName, invitedProfileIds || []);
	} catch (e) {
		dbOps.createGame(roomId, profileId, roomId.toUpperCase(), []);
	}
	return c.json({ roomId });
});

// Get details of specific game room (used for lobby screen)
app.get('/api/games/:roomId', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
	const game = dbOps.getGame(roomId);
	if (!game) {
		return c.json({ error: 'Game not found' }, 404);
	}
	const players = dbOps.getGamePlayers(roomId);
	return c.json({ game, players });
});

// Join an existing game room
app.post('/api/games/:roomId/join', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
	const profileId = c.get('profileId');
	const game = dbOps.getGame(roomId);
	if (!game) {
		return c.json({ error: 'Game not found' }, 404);
	}
	if (game.status !== 'waiting') {
		return c.json({ error: 'Game already in progress' }, 400);
	}
	const players = dbOps.getGamePlayers(roomId);
	if (players.length >= 6) {
		return c.json({ error: 'Room lobby is full' }, 400);
	}
	dbOps.joinGame(roomId, profileId);
	return c.json({ success: true });
});

// Accept invitation
app.post('/api/games/:roomId/accept', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
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
app.post('/api/games/:roomId/decline', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
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
app.post('/api/games/:roomId/ready', authMiddleware, async (c) => {
	const roomId = c.req.param('roomId');
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
app.post('/api/games/:roomId/leave', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
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
app.post('/api/games/:roomId/start', authMiddleware, (c) => {
	const roomId = c.req.param('roomId');
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

// WebSocket upgrade route (original)
app.get(
	'/api/room/:roomId/ws',
	upgradeWebSocket((c) => {
		const roomId = c.req.param('roomId');
		if (!roomId) {
			return {};
		}

		const game = dbOps.getGame(roomId);
		if (!game) {
			return {};
		}

		let room = rooms.get(roomId);
		if (!room) {
			room = new GameRoom(roomId);
			rooms.set(roomId, room);
		}

		return {
			onOpen(event, ws) {
				room.addClient(ws);
			},
			onMessage(event, ws) {
				room.handleMessage(ws, event.data.toString());
			},
			onClose(event, ws) {
				room.removeClient(ws);
				// If no clients left, schedule cleanup in 30 seconds
				if (room.clients.size === 0) {
					room.scheduleCleanup(() => {
						if (room.clients.size === 0) {
							rooms.delete(roomId);
							console.log(`Log: Room ${roomId} cleaned up due to inactivity.`);
						}
					}, 30000);
				}
			}
		};
	})
);

// Fallback message
app.get('/', (c) => {
	return c.text('Skitgubbe Hono Backend is running!');
});

export default {
	port: 3000,
	fetch: app.fetch,
	websocket
};
