import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { compileModule } from 'svelte/compiler';

const STATE_DIR = path.join(__dirname, '../src/lib/state');
const COMPILED_CHAT = path.join(__dirname, 'roomChatState.test-compiled.js');
const COMPILED_TRANSITIONS = path.join(__dirname, 'cardTransitions.test-compiled.js');
const COMPILED_DRAG = path.join(__dirname, 'cardDragState.test-compiled.js');
const COMPILED_ROOM = path.join(__dirname, 'roomState.test-compiled.js');

let RoomState: any;
let CardDragState: any;
let RoomChatState: any;

beforeAll(async () => {
	// Compile RoomChatState
	let chatSrc = fs.readFileSync(path.join(STATE_DIR, 'roomChatState.svelte.ts'), 'utf8');
	let transpiler = new Bun.Transpiler({ loader: 'ts' });
	let pureChatJs = transpiler.transformSync(chatSrc);
	let chatRes = compileModule(pureChatJs, { filename: 'roomChatState.svelte.js', dev: true });
	fs.writeFileSync(COMPILED_CHAT, chatRes.js.code, 'utf8');

	// Compile CardTransitions
	let transitionsSrc = fs.readFileSync(path.join(STATE_DIR, 'cardTransitions.svelte.ts'), 'utf8');
	let pureTransitionsJs = transpiler.transformSync(transitionsSrc);
	let transitionsRes = compileModule(pureTransitionsJs, { filename: 'cardTransitions.svelte.js', dev: true });
	fs.writeFileSync(COMPILED_TRANSITIONS, transitionsRes.js.code, 'utf8');

	// Compile CardDragState
	let dragSrc = fs.readFileSync(path.join(STATE_DIR, 'cardDragState.svelte.ts'), 'utf8');
	let pureDragJs = transpiler.transformSync(dragSrc);
	let dragRes = compileModule(pureDragJs, { filename: 'cardDragState.svelte.js', dev: true });
	fs.writeFileSync(COMPILED_DRAG, dragRes.js.code, 'utf8');

	// Compile RoomState
	let roomSrc = fs.readFileSync(path.join(STATE_DIR, 'roomState.svelte.ts'), 'utf8');
	// Replace relative imports to use the compiled files
	roomSrc = roomSrc.replace("import { env } from '$env/dynamic/public';", 'const env = { PUBLIC_ALLOW_DEV_SETTINGS: "true" };');
	roomSrc = roomSrc.replace("import { CardTransitions } from './cardTransitions.svelte';", "import { CardTransitions } from './cardTransitions.test-compiled.js';");
	roomSrc = roomSrc.replace("import { RoomChatState, MAX_CHAT_MESSAGES } from './roomChatState.svelte';", "import { RoomChatState, MAX_CHAT_MESSAGES } from './roomChatState.test-compiled.js';");
	roomSrc = "const myEffect = () => {};\n" + roomSrc;
	roomSrc = roomSrc.replace(/\$effect\b/g, 'myEffect');

	let pureRoomJs = transpiler.transformSync(roomSrc);
	let roomRes = compileModule(pureRoomJs, { filename: 'roomState.svelte.js', dev: true });
	fs.writeFileSync(COMPILED_ROOM, roomRes.js.code, 'utf8');

	// Set up browser mocks
	globalThis.window = {
		setTimeout: (cb: any, delay: number) => setTimeout(cb, delay),
		clearTimeout: (id: any) => clearTimeout(id),
		location: { href: '' },
		addEventListener: () => {},
		removeEventListener: () => {}
	} as any;
	globalThis.sessionStorage = {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {}
	} as any;
	globalThis.localStorage = {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {}
	} as any;
	globalThis.document = {
		hidden: false,
		addEventListener: () => {},
		removeEventListener: () => {},
		querySelector: (selector: string) => {
			if (selector === '.board-game-zone') {
				return {
					getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 500 })
				} as any;
			}
			return null;
		}
	} as any;
	class MockWebSocket {
		send = () => {};
		close = () => {};
	}
	globalThis.WebSocket = MockWebSocket as any;

	// Load modules
	const roomMod = await import('./roomState.test-compiled.js');
	RoomState = roomMod.RoomState;
	const dragMod = await import('./cardDragState.test-compiled.js');
	CardDragState = dragMod.CardDragState;
	const chatMod = await import('./roomChatState.test-compiled.js');
	RoomChatState = chatMod.RoomChatState;
});

afterAll(() => {
	// Clean up
	[COMPILED_CHAT, COMPILED_TRANSITIONS, COMPILED_DRAG, COMPILED_ROOM].forEach((p) => {
		if (fs.existsSync(p)) fs.unlinkSync(p);
	});
});

describe('RoomState Controller Tests', () => {
	test('RoomState checkDropValidity and isPlayableGroup selection rules', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';

		// Set up a mock gameState in phase 1
		room.gameState = {
			status: 'playing',
			phase: 1,
			activePlayerIdx: 0,
			players: [
				{ id: 'player1', name: 'Albin', color: '#10b981', hand: [], isDone: false, isSkitgubbe: false },
				{ id: 'player2', name: 'Bob', color: '#3b82f6', hand: [], isDone: false, isSkitgubbe: false }
			],
			tablePile: [
				[{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' }]
			],
			tablePilePlayers: ['player1'],
			deck: [],
			discardPile: [],
			seq: 1
		} as any;

		room.trumpSuit = 'hearts';

		// If it's human's turn
		room.yourPlayerId = 'player1';

		// In phase 1, is human turn: playing a valid set (e.g. two 8s)
		const card1 = { id: 'h-8', suit: '♥', value: '8', suitName: 'hearts', color: 'red' };
		const card2 = { id: 'c-8', suit: '♣', value: '8', suitName: 'clubs', color: 'black' };

		room.gameState.players[0].hand = [card1, card2];

		// Validity of play
		expect(room.checkDropValidity([card1, card2])).toBe('play');
		expect(room.isPlayableGroup([card1, card2])).toBe(true);

		// Test sprinkle: if not human's turn, but phase 1 and table matches value
		room.gameState.activePlayerIdx = 1; // It is player2's turn, player1 is not active (isHumanTurn is false)
		room.playerId = 'player1';
		expect(room.checkDropValidity([card1])).toBe('sprinkle');
		expect(room.isPlayableGroup([card1])).toBe(true);

		// If nothing matches or invalid
		const cardInvalid = { id: 's-9', suit: '♠', value: '9', suitName: 'spades', color: 'black' };
		expect(room.checkDropValidity([cardInvalid])).toBeNull();
		expect(room.isPlayableGroup([cardInvalid])).toBe(false);

		// Reset to player1 turn for selection rules
		room.gameState.activePlayerIdx = 0;
		// toggleSelect behavior
		room.selectedCardIds = [];
		room.toggleSelect('h-8');
		expect(room.selectedCardIds).toContain('h-8');

		room.toggleSelect('h-8');
		expect(room.selectedCardIds).not.toContain('h-8');
	});

	test('RoomState unreadChatCount', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.maxChatId = 2;

		room.chatState.chatMessages = [
			{ id: 1, playerId: 'player2', name: 'Bob', message: 'Hello', timestamp: Date.now() },
			{ id: 2, playerId: 'player2', name: 'Bob', message: 'World', timestamp: Date.now() }
		];
		room.chatState.lastSeenChatId = 1;

		expect(room.unreadChatCount).toBe(1);

		room.markChatsAsRead();
		expect(room.unreadChatCount).toBe(0);
		expect(room.chatState.lastSeenChatId).toBe(2);
	});

	test('RoomState replay-queue dedup by seq', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.playerName = 'Albin';
		room.playerColor = '#10b981';

		room.connectWebSocket();
		expect(room.socket).toBeDefined();

		const initialStates = [
			{ seq: 1, players: [] },
			{ seq: 2, players: [] }
		];
		room.socket.onmessage({
			data: JSON.stringify({
				type: 'replay',
				yourPlayerId: 'player1',
				states: initialStates
			})
		} as any);

		expect(room.isReplaying).toBe(true);
		expect(room.replayQueue.length).toBe(2);

		// StateUpdate with higher seq should be queued
		room.socket.onmessage({
			data: JSON.stringify({
				type: 'stateUpdate',
				yourPlayerId: 'player1',
				state: { seq: 3, players: [] }
			})
		} as any);
		expect(room.replayQueue.length).toBe(3);

		// StateUpdate with lower/equal seq should be ignored
		room.socket.onmessage({
			data: JSON.stringify({
				type: 'stateUpdate',
				yourPlayerId: 'player1',
				state: { seq: 2, players: [] }
			})
		} as any);
		expect(room.replayQueue.length).toBe(3);

		room.destroy();
	});

	test('RoomState handleCardClick fan-window math', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';

		const makeHand = (size: number) => {
			const hand = [];
			for (let i = 0; i < size; i++) {
				hand.push({ id: `c-${i}`, suit: '♠', value: 'A', suitName: 'spades', color: 'black' });
			}
			return hand;
		};

		room.gameState = {
			status: 'playing',
			phase: 1,
			activePlayerIdx: 0,
			players: [
				{ id: 'player1', hand: makeHand(12), isDone: false, isSkitgubbe: false }
			],
			tablePile: [],
			tablePilePlayers: [],
			deck: [],
			seq: 1
		} as any;

		room.yourPlayerId = 'player1';

		// Clicking a card when hand is <= 15 selects it immediately
		room.handleCardClick(5, 'c-5');
		expect(room.selectedCardIds).toContain('c-5');

		// Set hand to 18 cards (> 15)
		room.gameState.players[0].hand = makeHand(18);
		room.selectedCardIds = [];
		room.fanCenterIdx = -1;

		// First click sets fanCenterIdx
		room.handleCardClick(10, 'c-10');
		expect(room.fanCenterIdx).toBe(10);
		expect(room.selectedCardIds).toEqual([]);

		// Click inside the fan window selects
		room.handleCardClick(9, 'c-9');
		expect(room.selectedCardIds).toContain('c-9');

		// Click outside fan window updates fanCenterIdx instead of selecting
		room.handleCardClick(5, 'c-5');
		expect(room.fanCenterIdx).toBe(5);
		expect(room.selectedCardIds).not.toContain('c-5');
	});
});

describe('CardDragState State Machine Tests', () => {
	test('CardDragState drag threshold (8 px)', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.yourPlayerId = 'player1';

		const card = { id: 'c-1', suit: '♠', value: '5', suitName: 'spades', color: 'black' };
		room.gameState = {
			status: 'playing',
			phase: 2,
			activePlayerIdx: 0,
			players: [{ id: 'player1', hand: [card], isDone: false, isSkitgubbe: false }],
			tablePile: []
		} as any;

		const drag = new CardDragState(room);

		drag.handleCardPointerDown({ button: 0, clientX: 100, clientY: 100 } as any, 'c-1', 0);
		expect(drag.dragStartPos).toEqual({ x: 100, y: 100 });
		expect(drag.isDragging).toBe(false);

		// Move below 8px threshold
		drag.handlePointerMove({ clientX: 105, clientY: 100 } as any);
		expect(drag.isDragging).toBe(false);

		// Move above 8px threshold
		drag.handlePointerMove({ clientX: 110, clientY: 100 } as any);
		expect(drag.isDragging).toBe(true);
		expect(drag.dragOffset).toEqual({ x: 10, y: 0 });
	});

	test('CardDragState run detection vs lastReleasedRunCardIds', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.yourPlayerId = 'player1';
		room.trumpSuit = 'hearts';

		const hand = [
			{ id: 's-5', suit: '♠', value: '5', suitName: 'spades', color: 'black' },
			{ id: 's-6', suit: '♠', value: '6', suitName: 'spades', color: 'black' },
			{ id: 's-7', suit: '♠', value: '7', suitName: 'spades', color: 'black' }
		];
		room.gameState = {
			status: 'playing',
			phase: 2,
			activePlayerIdx: 0,
			players: [{ id: 'player1', hand, isDone: false, isSkitgubbe: false }]
		} as any;

		const drag = new CardDragState(room);

		// 1. Initial pointer down on s-6: drags the run
		drag.lastReleasedRunCardIds = [];
		drag.handleCardPointerDown({ button: 0, clientX: 100, clientY: 100 } as any, 's-6', 1);
		expect(drag.isDraggingRunDefault).toBe(true);
		expect(drag.cardsBeingDragged).toEqual(['s-5', 's-6', 's-7']);

		// 2. pointer up records released run
		drag.handlePointerUp({ clientX: 100, clientY: 100 } as any);
		expect(drag.lastReleasedRunCardIds).toEqual(['s-5', 's-6', 's-7']);

		// 3. pointer down again: does not drag the run
		drag.handleCardPointerDown({ button: 0, clientX: 100, clientY: 100 } as any, 's-6', 1);
		expect(drag.isDraggingRunDefault).toBe(false);
		expect(drag.cardsBeingDragged).toEqual(['s-6']);
	});

	test('CardDragState double-click-to-play fallback ordering', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.yourPlayerId = 'player1';
		room.trumpSuit = 'hearts';

		const hand = [
			{ id: 's-5', suit: '♠', value: '5', suitName: 'spades', color: 'black' },
			{ id: 's-6', suit: '♠', value: '6', suitName: 'spades', color: 'black' },
			{ id: 's-7', suit: '♠', value: '7', suitName: 'spades', color: 'black' }
		];
		room.gameState = {
			status: 'playing',
			phase: 2,
			activePlayerIdx: 0,
			players: [{ id: 'player1', hand, isDone: false, isSkitgubbe: false }],
			tablePile: [[{ id: 's-4', suit: '♠', value: '4', suitName: 'spades', color: 'black' }]]
		} as any;

		const drag = new CardDragState(room);
		let lastSentMsg: any = null;
		room.sendWsMessage = (msg: any) => { lastSentMsg = msg; };

		// Scenario A: selectedCardIds contains 's-5'. We double click 's-6'.
		// Play 's-5' + 's-6' on 's-4' is valid play.
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-6';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick({ preventDefault: () => {}, stopPropagation: () => {} } as any, 1, 's-6');
		expect(lastSentMsg).toEqual({ type: 'playCards', cardIds: ['s-6', 's-5'], debugForce: undefined });
		expect(room.selectedCardIds).toEqual([]); // Cleared on play

		// Scenario B: selectedCardIds contains 's-5'. We double click 's-7'.
		// Play 's-5' + 's-7' on 's-4' is NOT a valid play (non-sequential run).
		// But single card 's-7' on 's-4' is valid!
		// It should play 's-7' only and keep 's-5' selected.
		lastSentMsg = null;
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-7';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick({ preventDefault: () => {}, stopPropagation: () => {} } as any, 2, 's-7');
		expect(lastSentMsg).toEqual({ type: 'playCards', cardIds: ['s-7'], debugForce: undefined });
		expect(room.selectedCardIds).toEqual(['s-5']); // 's-5' remains selected

		// Scenario C: selectedCardIds contains 's-5'. We double click 's-5' again, but now table is 's-8'.
		// Neither 's-5' + 's-5' nor single 's-5' is valid (table is s-8).
		// It should fall back to toggling selection of 's-5' (which deselects it).
		lastSentMsg = null;
		room.gameState.tablePile = [[{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' }]];
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-5';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick({ preventDefault: () => {}, stopPropagation: () => {} } as any, 0, 's-5');
		expect(lastSentMsg).toBeNull();
		expect(room.selectedCardIds).toEqual([]); // Toggled to deselect
	});
});
