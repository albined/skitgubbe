import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { GameRoom } from './gameRoom.js';

const app = new Hono();

const { upgradeWebSocket, websocket } = createBunWebSocket();

const rooms = new Map<string, GameRoom>();

// WebSocket upgrade route
app.get(
	'/api/room/:roomId/ws',
	upgradeWebSocket((c) => {
		const roomId = c.req.param('roomId');
		if (!roomId) {
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
