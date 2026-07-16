import { GameRoom } from './gameRoom.js';

// Single owner of the in-memory room map. Rooms must always be created via
// getOrCreate and removed via evict, so a removed room is always disposed
// (all its timers cancelled) before a replacement can be created.
class RoomManager {
	private rooms = new Map<string, GameRoom>();

	get(roomId: string): GameRoom | undefined {
		return this.rooms.get(roomId);
	}

	getOrCreate(roomId: string): GameRoom {
		let room = this.rooms.get(roomId);
		if (!room) {
			room = new GameRoom(roomId);
			this.rooms.set(roomId, room);
		}
		return room;
	}

	evict(roomId: string) {
		const room = this.rooms.get(roomId);
		if (room) {
			room.dispose();
			this.rooms.delete(roomId);
		}
	}
}

export const rooms = new RoomManager();
