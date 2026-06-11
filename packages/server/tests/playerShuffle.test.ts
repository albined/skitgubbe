import { describe, test, expect, afterAll } from 'bun:test';
import { dbOps } from '../src/db.js';
import { GameRoom } from '../src/gameRoom.js';

describe('Player Shuffling and Turn Order', () => {
	const createdProfileIds: string[] = [];
	const createdGameIds: string[] = [];

	afterAll(() => {
		for (const gameId of createdGameIds) {
			dbOps.deleteGame(gameId);
		}
		for (const profileId of createdProfileIds) {
			dbOps.deleteProfile(profileId);
		}
	});

	test('shuffles players and places global skitgubbe at the end', () => {
		const p1Id = 'p1_' + Math.random().toString(36).substring(2, 9);
		const p2Id = 'p2_' + Math.random().toString(36).substring(2, 9);
		const p3Id = 'p3_' + Math.random().toString(36).substring(2, 9);
		const gameId = 'game_' + Math.random().toString(36).substring(2, 9);
		const historyGameId = 'game_' + Math.random().toString(36).substring(2, 9);

		createdProfileIds.push(p1Id, p2Id, p3Id);
		createdGameIds.push(gameId, historyGameId);

		// 1. Create profiles
		dbOps.createProfile(p1Id, 'Alice', '#ff0000');
		dbOps.createProfile(p2Id, 'Bob', '#00ff00');
		dbOps.createProfile(p3Id, 'Charlie', '#0000ff');

		// 2. Create game and invite players
		dbOps.createGame(gameId, p1Id, 'Test Game', [p2Id, p3Id]);

		// 3. Make them join/accept
		dbOps.joinGame(gameId, p2Id);
		dbOps.joinGame(gameId, p3Id);

		// 4. Set Charlie as the global skitgubbe by adding to history
		// Create another mock game to register Charlie in history
		dbOps.createGame(historyGameId, p1Id, 'History Game', [p2Id, p3Id]);
		dbOps.joinGame(historyGameId, p2Id);
		dbOps.joinGame(historyGameId, p3Id);
		
		// Record game results with Charlie as skitgubbe
		const mockState = {
			players: [
				{ id: p1Id, inviteStatus: 'accepted', isSkitgubbe: false },
				{ id: p2Id, inviteStatus: 'accepted', isSkitgubbe: false },
				{ id: p3Id, inviteStatus: 'accepted', isSkitgubbe: true }
			]
		};
		dbOps.recordGameResults(historyGameId, mockState);

		// Verify Charlie is the current global skitgubbe
		const globalSkitgubbe = dbOps.getCurrentGlobalSkitgubbe();
		expect(globalSkitgubbe?.id).toBe(p3Id);

		// 5. Start the game through GameRoom
		const room = new GameRoom(gameId);
		
		// Mock the host's websocket
		let sentMessages: any[] = [];
		const mockWs = {
			raw: {},
			send: (msg: string) => {
				sentMessages.push(JSON.parse(msg));
			},
			close: () => {}
		};

		// Host joins
		room.handleMessage(mockWs, JSON.stringify({
			type: 'join',
			playerId: p1Id,
			name: 'Alice',
			color: '#ff0000'
		}));

		// Bob and Charlie join (mocking their sockets too)
		const mockWs2 = { raw: {}, send: () => {}, close: () => {} };
		const mockWs3 = { raw: {}, send: () => {}, close: () => {} };
		room.handleMessage(mockWs2, JSON.stringify({ type: 'join', playerId: p2Id, name: 'Bob', color: '#00ff00' }));
		room.handleMessage(mockWs3, JSON.stringify({ type: 'join', playerId: p3Id, name: 'Charlie', color: '#0000ff' }));

		// Reset sent messages
		sentMessages = [];

		// Host starts the game
		room.state.status = 'waiting';

		room.handleMessage(mockWs, JSON.stringify({
			type: 'startGame'
		}));

		// Verify game status is playing
		expect(room.state.status as string).toBe('playing');

		// Retrieve players list from DB and state
		const playersFromDb = dbOps.getGamePlayers(gameId);
		expect(playersFromDb.length).toBe(3);

		// The last player in turn order must be Charlie (p3)
		const lastPlayerDb = playersFromDb[2];
		expect(lastPlayerDb.profile_id).toBe(p3Id);

		// In-memory state players should match the DB order
		expect(room.state.players[2].id).toBe(p3Id);

		// The turn order indices must be 0, 1, 2
		expect(playersFromDb[0].turn_order).toBe(0);
		expect(playersFromDb[1].turn_order).toBe(1);
		expect(playersFromDb[2].turn_order).toBe(2);
	});
});
