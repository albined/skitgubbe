import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { GameRoom } from './gameRoom.js';
import { dbOps } from './db.js';
import { initWebPush } from './vapid.js';
import { rooms } from './rooms.js';
import { JWT_SECRET } from './utils/jwt.js';
import { profilesApp } from './routes/profiles.js';
import { gamesApp } from './routes/games.js';
import { statisticsApp } from './routes/statistics.js';
import { pushApp } from './routes/push.js';

const app = new Hono<{ Variables: { profileId: string } }>();

// Initialize web push configuration
initWebPush();

// Mount sub-apps
app.route('/api/profiles', profilesApp);
app.route('/api/games', gamesApp);
app.route('/api/push', pushApp);
app.route('/', statisticsApp);

const { upgradeWebSocket, websocket } = createBunWebSocket();

// WebSocket upgrade route
app.get(
	'/api/room/:roomId/ws',
	upgradeWebSocket(async (c) => {
		const roomId = c.req.param('roomId');

		if (!roomId) {
			return {};
		}

		const game = dbOps.getGame(roomId);
		if (!game) {
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

		let room = rooms.get(roomId);
		if (!room) {
			room = new GameRoom(roomId);
			rooms.set(roomId, room);
		}

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

export { app };

export default {
	port: 3000,
	fetch: app.fetch,
	websocket
};
