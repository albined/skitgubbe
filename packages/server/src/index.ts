import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import type { ServerWebSocket } from 'bun';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { dbOps } from './db.js';
import { initWebPush } from './vapid.js';
import { rooms } from './rooms.js';
import { JWT_SECRET } from './utils/jwt.js';
import { profilesApp } from './routes/profiles.js';
import { gamesApp } from './routes/games.js';
import { statisticsApp } from './routes/statistics.js';
import { pushApp } from './routes/push.js';
import { SERVER_VERSION } from './version.js';

const app = new Hono<{ Variables: { profileId: string } }>();

// Public and database-independent: native clients use this before accepting a server.
app.get('/api/app-info', (c) =>
	c.json({
		product: 'skitgubbe',
		api_version: 1,
		server_version: SERVER_VERSION
	})
);

// Initialize web push configuration
initWebPush();

// Warning if PUBLIC_ALLOW_DEV_SETTINGS is true in production
if (process.env.PUBLIC_ALLOW_DEV_SETTINGS === 'true' && process.env.NODE_ENV === 'production') {
	console.warn('WARNING: PUBLIC_ALLOW_DEV_SETTINGS is set to true in production!');
}

// Mount sub-apps
app.route('/api/profiles', profilesApp);
app.route('/api/games', gamesApp);
app.route('/api/push', pushApp);
app.route('/', statisticsApp);

const { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();

// WebSocket upgrade route
app.get(
	'/api/room/:roomId/ws',
	async (c, next) => {
		const roomId = c.req.param('roomId');
		if (!roomId) {
			return c.text('Missing roomId', 400);
		}
		const game = dbOps.getGame(roomId);
		if (!game) {
			return c.text('Room not found', 404);
		}
		await next();
	},
	upgradeWebSocket(async (c) => {
		// roomId presence and game existence were already validated by the
		// middleware above, in the same synchronous request — no re-query.
		const roomId = c.req.param('roomId');

		if (!roomId) {
			return {};
		}

		// The WS path is otherwise unauthenticated: verify the session cookie at
		// upgrade time and bind the identity to the verified profileId. Without
		// this, a client's `join` could assert any playerId — seeing another
		// player's hand, playing their turns, and kicking their socket — with no
		// sign-in-log trace, which defeats the honor model's audit trail.
		const token = getCookie(c, 'skitgubbe_session');
		let profileId: string | null = null;
		if (token) {
			try {
				const payload = await verify(token, JWT_SECRET, 'HS256');
				profileId = (payload.profileId as string) || null;
			} catch {
				profileId = null;
			}
		}
		if (!profileId || !dbOps.getProfileById(profileId)) {
			// Complete the upgrade only to immediately reject the connection.
			return {
				onOpen(_event, ws) {
					ws.close(1008, 'Unauthorized');
				}
			};
		}
		const authedProfileId = profileId;

		const room = rooms.getOrCreate(roomId);

		return {
			onOpen(event, ws) {
				room.addClient(ws, authedProfileId);
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
							rooms.evict(roomId);
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

export { app };

export default {
	port: 3000,
	fetch: app.fetch,
	websocket
};
