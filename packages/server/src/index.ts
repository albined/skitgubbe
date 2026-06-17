import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { GameRoom } from './gameRoom.js';
import { dbOps } from './db.js';
import { initWebPush, getVapidKeys } from './vapid.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = new Hono<{ Variables: { profileId: string } }>();

function getJwtSecret(): string {
	if (process.env.JWT_SECRET) {
		return process.env.JWT_SECRET;
	}

	// Try loading from database directory (persistent keys in Docker volume)
	const isTest = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
	const dbPath = process.env.DATABASE_PATH || (isTest ? ':memory:' : 'skitgubbe.db');

	// Do not persist secret to disk during tests or memory-only mode
	if (isTest || dbPath === ':memory:') {
		return crypto.randomBytes(32).toString('hex');
	}

	const keysDir = path.dirname(dbPath);
	const secretPath = path.join(keysDir, 'jwt_secret.txt');

	try {
		if (fs.existsSync(secretPath)) {
			const content = fs.readFileSync(secretPath, 'utf8').trim();
			if (content) return content;
		}
	} catch (e) {
		console.warn('Warning: Failed to read persistent JWT secret from file:', e);
	}

	// Fallback: generate and persist new secret
	console.warn(`JWT_SECRET not set in environment. Generating persistent secret at: ${secretPath}`);
	const generated = crypto.randomBytes(32).toString('hex');
	try {
		fs.mkdirSync(keysDir, { recursive: true });
		fs.writeFileSync(secretPath, generated, 'utf8');
	} catch (e) {
		console.error('Error: Failed to save generated JWT secret to file:', e);
	}

	return generated;
}

const JWT_SECRET = getJwtSecret();

// Initialize web push configuration
initWebPush();

function isPrivateIp(ip: string): boolean {
	if (!ip) return true;
	const firstIp = ip.split(',')[0].trim();
	
	if (firstIp === '127.0.0.1' || firstIp === '::1' || firstIp.toLowerCase() === 'localhost') return true;
	
	const parts = firstIp.split('.').map(Number);
	if (parts.length === 4 && !parts.some(isNaN)) {
		if (parts[0] === 10) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
	}
	
	const lower = firstIp.toLowerCase();
	if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
		return true;
	}
	
	return false;
}

async function getIpLocation(ip: string): Promise<string> {
	if (!ip || ip === 'Unknown IP') return 'Okänd plats';
	const firstIp = ip.split(',')[0].trim();
	if (isPrivateIp(firstIp)) {
		return 'Lokalt nätverk';
	}
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);
		
		const res = await fetch(`https://freeipapi.com/api/json/${firstIp}`, {
			signal: controller.signal
		});
		clearTimeout(timeoutId);
		
		if (res.ok) {
			const data = await res.json() as any;
			const city = data.cityName;
			const country = data.countryName;
			const countryCode = data.countryCode;
			
			if (city && city !== '-' && city !== 'Unknown') {
				return `${city} (${countryCode || country})`;
			} else if (country && country !== '-' && country !== 'Unknown') {
				return country;
			}
		}
	} catch (e) {
		console.error(`Failed to geolocate IP ${firstIp}:`, e);
	}
	return 'Okänd plats';
}

interface ParsedAgent {
	os: string;
	browser: string;
	device: string;
}

function parseUserAgent(ua: string): ParsedAgent {
	if (!ua) {
		return { os: 'Okänd', browser: 'Okänd', device: 'Okänd' };
	}

	let os = 'Okänd OS';
	let browser = 'Okänd webbläsare';
	let device = 'Dator';

	const uaLower = ua.toLowerCase();

	if (uaLower.includes('iphone')) {
		device = 'iPhone';
		os = 'iOS';
	} else if (uaLower.includes('ipad')) {
		device = 'iPad';
		os = 'iOS';
	} else if (uaLower.includes('android')) {
		device = 'Android';
		os = 'Android';
		
		const androidMatch = ua.match(/\(([^)]+)\)/);
		if (androidMatch && androidMatch[1]) {
			const tokens = androidMatch[1].split(';').map(t => t.trim());
			const modelToken = tokens.find(token => {
				const lowerToken = token.toLowerCase();
				return !lowerToken.includes('linux') &&
					   !lowerToken.includes('android') &&
					   lowerToken !== 'k' &&
					   lowerToken !== 'wv' &&
					   !lowerToken.includes('build/');
			});
			if (modelToken) {
				device = modelToken;
			}
		}
	} else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
		os = 'macOS';
		device = 'Mac';
	} else if (uaLower.includes('windows nt')) {
		os = 'Windows';
		device = 'Windows Dator';
	} else if (uaLower.includes('linux')) {
		os = 'Linux';
		device = 'Linux Dator';
	}

	if (uaLower.includes('edg/')) {
		browser = 'Edge';
	} else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
		browser = 'Opera';
	} else if (uaLower.includes('chrome') || uaLower.includes('crios')) {
		browser = 'Chrome';
	} else if (uaLower.includes('firefox') || uaLower.includes('fxios')) {
		browser = 'Firefox';
	} else if (uaLower.includes('safari')) {
		browser = 'Safari';
	}

	return { os, browser, device };
}

function formatDeviceString(ua: string): string {
	const parsed = parseUserAgent(ua);
	if (parsed.os === 'Okänd' && parsed.browser === 'Okänd') {
		return ua || 'Okänd enhet';
	}
	
	let osName = parsed.os;
	let browserName = parsed.browser;
	let deviceName = parsed.device;
	
	if (deviceName === 'Windows Dator') deviceName = 'Windows-dator';
	if (deviceName === 'Linux Dator') deviceName = 'Linux-dator';
	
	if (deviceName === 'iPhone' || deviceName === 'iPad' || deviceName === 'Mac') {
		return `${deviceName} (${browserName})`;
	}
	
	if (deviceName === 'Android') {
		return `Android-enhet (${browserName})`;
	}
	
	if (parsed.device !== 'Dator' && parsed.device !== 'Windows Dator' && parsed.device !== 'Linux Dator') {
		return `${deviceName} (${browserName} på ${osName})`;
	}
	
	return `${deviceName} (${browserName})`;
}

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
	
	getIpLocation(ipAddress)
		.then((location) => {
			dbOps.logProfileAccess(profile.id, userAgent, ipAddress, location);
		})
		.catch((err) => {
			console.error('Failed to log profile access location:', err);
			dbOps.logProfileAccess(profile.id, userAgent, ipAddress, 'Okänd plats');
		});

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
	
	const formattedLogs = logs.map((log) => {
		const deviceDisplay = formatDeviceString(log.device_info || '');
		let locationDisplay = log.location;
		if (!locationDisplay) {
			if (log.ip_address && isPrivateIp(log.ip_address)) {
				locationDisplay = 'Lokalt nätverk';
			} else {
				locationDisplay = log.ip_address || 'Okänd plats';
			}
		}
		return {
			...log,
			device_display: deviceDisplay,
			location_display: locationDisplay
		};
	});
	
	return c.json(formattedLogs);
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

// Get archived games involving current profile
app.get('/api/games/archived', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const games = dbOps.getArchivedGamesForProfile(profileId);
	return c.json(games);
});

// Batch archive games for current profile
app.post('/api/games/archive', authMiddleware, async (c) => {
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
app.post('/api/games/unarchive', authMiddleware, async (c) => {
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
app.post('/api/games/create', authMiddleware, async (c) => {
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
	if (players.length >= 10) {
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
		
		// Temporary diagnostic logging
		console.log(`[WS Handshake] Connecting to room: ${roomId}`);
		console.log(`[WS Handshake] Request Headers:`, JSON.stringify(c.req.header(), null, 2));
		console.log(`[WS Handshake] Cookie header raw:`, c.req.header('cookie'));

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

// GET dynamic VAPID public key for frontend subscriptions
app.get('/api/push/vapid-public-key', (c) => {
	const keys = getVapidKeys();
	return c.json({ publicKey: keys.publicKey });
});

function isValidEndpoint(endpoint: string): boolean {
	if (endpoint.length > 1024) return false;
	try {
		const url = new URL(endpoint);
		if (url.protocol === 'https:') return true;
		if (url.protocol === 'http:') {
			return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || process.env.NODE_ENV !== 'production';
		}
		return false;
	} catch {
		return false;
	}
}

// POST register a new push subscription
// TODO(security): Implement anti-CSRF token verification on this state-changing endpoint if cookie-based authentication becomes exposed in general.
app.post('/api/push/subscribe', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const sub = await c.req.json();
		if (
			!sub ||
			typeof sub.endpoint !== 'string' ||
			!isValidEndpoint(sub.endpoint) ||
			!sub.keys ||
			typeof sub.keys.p256dh !== 'string' ||
			typeof sub.keys.auth !== 'string'
		) {
			return c.json({ error: 'Invalid subscription payload' }, 400);
		}
		
		dbOps.addPushSubscription(profileId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to register subscription' }, 500);
	}
});

// POST unsubscribe a push subscription
// TODO(security): Implement anti-CSRF token verification on this state-changing endpoint if cookie-based authentication becomes exposed in general.
app.post('/api/push/unsubscribe', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { endpoint } = await c.req.json();
		if (typeof endpoint !== 'string' || !isValidEndpoint(endpoint)) {
			return c.json({ error: 'Endpoint is required and must be a valid URL string' }, 400);
		}
		dbOps.deletePushSubscription(endpoint, profileId);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to delete subscription' }, 500);
	}
});

export { app };

export default {
	port: 3000,
	fetch: app.fetch,
	websocket
};
