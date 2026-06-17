import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { GameRoom } from './gameRoom.js';
import { dbOps } from './db.js';
import { initWebPush } from './vapid.js';
import { rooms } from './rooms.js';
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

export { app };

export default {
	port: 3000,
	fetch: app.fetch,
	websocket
};
