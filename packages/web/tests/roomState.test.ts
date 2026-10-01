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
	let transitionsRes = compileModule(pureTransitionsJs, {
		filename: 'cardTransitions.svelte.js',
		dev: true
	});
	fs.writeFileSync(COMPILED_TRANSITIONS, transitionsRes.js.code, 'utf8');

	// Compile CardDragState
	let dragSrc = fs.readFileSync(path.join(STATE_DIR, 'cardDragState.svelte.ts'), 'utf8');
	let pureDragJs = transpiler.transformSync(dragSrc);
	let dragRes = compileModule(pureDragJs, { filename: 'cardDragState.svelte.js', dev: true });
	fs.writeFileSync(COMPILED_DRAG, dragRes.js.code, 'utf8');

	// Compile RoomState
	let roomSrc = fs.readFileSync(path.join(STATE_DIR, 'roomState.svelte.ts'), 'utf8');
	// Replace relative imports to use the compiled files
	roomSrc = roomSrc.replace(
		"import { env } from '$env/dynamic/public';",
		'const env = { PUBLIC_ALLOW_DEV_SETTINGS: "true" };'
	);
	roomSrc = roomSrc.replace(
		"import { CardTransitions } from './cardTransitions.svelte';",
		"import { CardTransitions } from './cardTransitions.test-compiled.js';"
	);
	roomSrc = roomSrc.replace(
		"import { RoomChatState, MAX_CHAT_MESSAGES } from './roomChatState.svelte';",
		"import { RoomChatState, MAX_CHAT_MESSAGES } from './roomChatState.test-compiled.js';"
	);
	roomSrc = 'const myEffect = () => {};\n' + roomSrc;
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
	test('ending waits for the poster landing before triggering the impact', async () => {
		const room = new RoomState('ending');
		const timers: Array<() => void> = [];
		room.trackTimeout = (callback: () => void) => timers.push(callback);
		const ending = room.runEndGameAnimation({ hand: [{ id: 'c-1' }, { id: 'c-2' }] });

		expect(room.endGameStage).toBe('paused');
		timers.shift()!();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(room.endGameStage).toBe('table_clear');
		timers.shift()!();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(room.endGameStage).toBe('cards_reveal');
		room.handlePosterLanded();
		expect(room.shakeActive).toBe(false);
		timers.shift()!();
		await ending;
		expect(room.endGameStage).toBe('poster_slam');
		expect(room.shakeActive).toBe(false);
		expect(timers).toHaveLength(0);

		room.handlePosterLanded();
		expect(room.shakeActive).toBe(true);
		timers.shift()!();
		expect(room.shakeActive).toBe(false);
		room.destroy();
	});

	test('cancelling the ending during cleanup prevents the reveal', async () => {
		const room = new RoomState('ending-cancelled');
		const timers: Array<() => void> = [];
		room.trackTimeout = (callback: () => void) => timers.push(callback);
		const ending = room.runEndGameAnimation({ hand: [{ id: 'c-1' }] });
		timers.shift()!();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(room.endGameStage).toBe('table_clear');
		room.endGameStage = 'none';
		timers.shift()!();
		await ending;
		room.handlePosterLanded();
		expect(room.endGameStage).toBe('none');
		expect(room.shakeActive).toBe(false);
		expect(timers).toHaveLength(0);
		room.destroy();
	});

	test('RoomState checkDropValidity and isPlayableGroup selection rules', () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';

		// Set up a mock gameState in phase 1
		room.gameState = {
			status: 'playing',
			phase: 1,
			activePlayerIdx: 0,
			players: [
				{
					id: 'player1',
					name: 'Albin',
					color: '#10b981',
					hand: [],
					isDone: false,
					isSkitgubbe: false
				},
				{
					id: 'player2',
					name: 'Bob',
					color: '#3b82f6',
					hand: [],
					isDone: false,
					isSkitgubbe: false
				}
			],
			tablePile: [[{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' }]],
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

	test('RoomState replay-queue dedup by seq', async () => {
		const room = new RoomState('room123');
		room.playerId = 'player1';
		room.playerName = 'Albin';
		room.playerColor = '#10b981';

		await room.connectWebSocket();
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
			players: [{ id: 'player1', hand: makeHand(12), isDone: false, isSkitgubbe: false }],
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
		room.sendWsMessage = (msg: any) => {
			lastSentMsg = msg;
		};

		// Scenario A: selectedCardIds contains 's-5'. We double click 's-6'.
		// Play 's-5' + 's-6' on 's-4' is valid play.
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-6';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick(
			{ preventDefault: () => {}, stopPropagation: () => {} } as any,
			1,
			's-6'
		);
		expect(lastSentMsg).toEqual({
			type: 'playCards',
			cardIds: ['s-6', 's-5'],
			debugForce: undefined
		});
		expect(room.selectedCardIds).toEqual([]); // Cleared on play

		// Scenario B: selectedCardIds contains 's-5'. We double click 's-7'.
		// Play 's-5' + 's-7' on 's-4' is NOT a valid play (non-sequential run).
		// But single card 's-7' on 's-4' is valid!
		// It should play 's-7' only and keep 's-5' selected.
		lastSentMsg = null;
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-7';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick(
			{ preventDefault: () => {}, stopPropagation: () => {} } as any,
			2,
			's-7'
		);
		expect(lastSentMsg).toEqual({ type: 'playCards', cardIds: ['s-7'], debugForce: undefined });
		expect(room.selectedCardIds).toEqual(['s-5']); // 's-5' remains selected

		// Scenario C: selectedCardIds contains 's-5'. We double click 's-5' again, but now table is 's-8'.
		// Neither 's-5' + 's-5' nor single 's-5' is valid (table is s-8).
		// It should fall back to toggling selection of 's-5' (which deselects it).
		lastSentMsg = null;
		room.gameState.tablePile = [
			[{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' }]
		];
		room.selectedCardIds = ['s-5'];
		drag.lastClickedCardId = 's-5';
		drag.lastClickTime = Date.now();

		drag.handleCardElementClick(
			{ preventDefault: () => {}, stopPropagation: () => {} } as any,
			0,
			's-5'
		);
		expect(lastSentMsg).toBeNull();
		expect(room.selectedCardIds).toEqual([]); // Toggled to deselect
	});

	test('Step 6: sprinkle controls during pending trickWinnerId in Phase 1', () => {
		const room = new RoomState('room_pending');
		room.playerId = 'player1';
		room.yourPlayerId = 'player1';

		const card8 = { id: 'h-8', suit: '♥', value: '8', suitName: 'hearts', color: 'red' };
		const card9 = { id: 's-9', suit: '♠', value: '9', suitName: 'spades', color: 'black' };

		room.gameState = {
			status: 'playing',
			phase: 1,
			activePlayerIdx: 0,
			players: [
				{
					id: 'player1',
					name: 'Albin',
					color: '#10b981',
					hand: [card8, card9],
					isDone: false,
					isSkitgubbe: false,
					inviteStatus: 'accepted'
				},
				{
					id: 'player2',
					name: 'Bob',
					color: '#3b82f6',
					hand: [],
					isDone: false,
					isSkitgubbe: false,
					inviteStatus: 'accepted'
				}
			],
			tablePile: [[{ id: 's-8', suit: '♠', value: '8', suitName: 'spades', color: 'black' }]],
			tablePilePlayers: ['player1'],
			trickWinnerId: 'player2', // Trick winner is pending!
			deck: [],
			discardPile: [],
			seq: 1
		} as any;

		// 1. isHumanTurn must be FALSE while trickWinnerId is pending
		expect(room.isHumanTurn).toBe(false);

		// 2. Normal 'play' cannot be returned during pending trick
		expect(room.checkDropValidity([card9])).toBeNull();

		// 3. Drop validity returns 'sprinkle' for matching own table batch
		expect(room.checkDropValidity([card8])).toBe('sprinkle');

		// 4. isStroValid is TRUE when matching card is selected, even though trickWinnerId is pending
		room.selectedCardIds = ['h-8'];
		expect(room.isStroValid).toBe(true);

		// 5. isStroValid is FALSE for non-matching card
		room.selectedCardIds = ['s-9'];
		expect(room.isStroValid).toBe(false);
	});
});

describe('Phase 2 card collection', () => {
	const card = (id: string) => ({ id, suit: '♠', value: '8', suitName: 'spades', color: 'black' });
	const rect = (left: number, top: number, width = 80, height = 112) => ({
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height
	});
	const element = (bounds: ReturnType<typeof rect>, hand = false) => ({
		getBoundingClientRect: () => bounds,
		classList: { contains: (name: string) => hand && name === 'hand-card', add() {}, remove() {} }
	});

	function fixture() {
		const room = new RoomState('phase-change');
		room.playerId = 'self';
		room.yourPlayerId = 'self';
		const reserve = Array.from({ length: 25 }, (_, index) => card(`reserve-${index}`));
		const players = [
			{ id: 'self', hand: [card('held')], reserveStack: reserve, inviteStatus: 'accepted' },
			{ id: 'other', hand: [], reserveStack: [], inviteStatus: 'accepted' },
			{ id: 'active', hand: [], reserveStack: [], inviteStatus: 'accepted' }
		];
		const previous = {
			phase: 1,
			status: 'playing',
			activePlayerIdx: 2,
			players,
			tablePile: [[card('returned')], [card('opponent-table')]],
			tablePilePlayers: ['self', 'other'],
			trickWinnerId: null
		};
		const next = {
			...previous,
			phase: 2,
			tablePile: [],
			tablePilePlayers: [],
			players: [
				{ ...players[0], hand: [card('held'), ...reserve, card('returned')], reserveStack: [] },
				{ ...players[1], hand: [{ ...card('hidden-other-0'), value: '?' }] },
				players[2]
			]
		};
		room.gameState = previous;
		const originalDocument = globalThis.document;
		const targets: string[] = [];
		globalThis.document = {
			...originalDocument,
			querySelectorAll: () => [
				{ ...element(rect(300, 200)), getAttribute: () => 'returned' },
				{ ...element(rect(400, 200)), getAttribute: () => 'opponent-table' }
			],
			querySelector: (selector: string) => {
				targets.push(selector);
				if (selector === '[data-player-id="other"]') {
					return { querySelector: () => element(rect(700, 20, 20, 28)) };
				}
				if (selector === '[data-player-id="self"]') {
					return { querySelector: () => element(rect(100, 20, 20, 28)) };
				}
				return null;
			}
		} as any;
		return {
			room,
			next,
			targets,
			restore() {
				globalThis.document = originalDocument;
				room.destroy();
			}
		};
	}

	test('table cards start immediately and a large reserve finishes within 800 ms', () => {
		const f = fixture();
		try {
			f.room.transitions.onStateReceived(f.next, 'self');
			f.room.gameState = f.next;
			const transitions = f.next.players[0].hand
				.slice(1)
				.map((c: any) =>
					f.room.transitions.cardIn(element(rect(200, 500), true), { id: c.id, playerId: 'self' })
				);
			const returned = transitions.at(-1)!;
			expect(returned.delay).toBe(0);
			expect(returned.css(0)).toContain('translate3d(100px, -300px, 0px)');
			expect(transitions.every((t: any) => t.delay + t.duration <= 800)).toBe(true);
			expect(transitions[1].delay).toBeGreaterThan(0);
			expect(
				f.room.transitions.cardOut(element(rect(300, 200)), { id: 'returned' }).css(1)
			).toContain('opacity: 0');
		} finally {
			f.restore();
		}
	});

	test('masked opponents receive their own table cards instead of the active player receiving everything', () => {
		const f = fixture();
		try {
			f.room.transitions.onStateReceived(f.next, 'self');
			f.room.gameState = f.next;
			const outro = f.room.transitions.cardOut(element(rect(400, 200)), { id: 'opponent-table' });
			expect(f.targets).toContain('[data-player-id="other"]');
			expect(f.targets).not.toContain('[data-player-id="active"]');
			expect(outro.delay ?? 0).toBe(0);
			expect(outro.duration).toBe(600);
			expect(outro.css(1)).toContain('translate3d(0px, 0px, 0px)');
			expect(outro.css(0)).toContain('translate3d(270px, -222px, 0px)');
		} finally {
			f.restore();
		}
	});

	test('completed tricks go to their winner during a replay phase change', () => {
		const f = fixture();
		try {
			f.room.gameState.trickWinnerId = 'other';
			f.next.players[0].hand = [card('held')];
			// Replay uses the same snapshot method before replacing gameState.
			f.room.transitions.captureCardRects(f.next);
			f.room.gameState = f.next;
			for (const id of ['returned', 'opponent-table']) {
				const outro = f.room.transitions.cardOut(element(rect(300, 200)), { id });
				expect(outro.duration).toBe(600);
			}
			expect(f.targets.filter((s) => s === '[data-player-id="other"]')).toHaveLength(2);
			expect(f.targets).not.toContain('[data-player-id="self"]');
		} finally {
			f.restore();
		}
	});

	test('ordinary phase 2 pickups move together instead of queuing behind each other', () => {
		const f = fixture();
		try {
			f.room.gameState.phase = 2;
			f.room.gameState.tablePile = [Array.from({ length: 10 }, (_, i) => card(`pickup-${i}`))];
			f.next.players[0].hand = [card('held'), ...f.room.gameState.tablePile[0]];
			f.room.transitions.onStateReceived(f.next, 'self');
			f.room.gameState = f.next;
			for (let i = 0; i < 10; i++) {
				const intro = f.room.transitions.cardIn(element(rect(200, 500), true), {
					id: `pickup-${i}`,
					playerId: 'self'
				});
				expect(intro.delay).toBe(0);
				expect(intro.duration).toBe(600);
			}
		} finally {
			f.restore();
		}
	});

	test('normal draws keep their stagger after collection, and reconnects do not replay it', () => {
		const f = fixture();
		try {
			f.room.transitions.onStateReceived(f.next, 'self');
			f.room.gameState = f.next;
			const update = structuredClone(f.next);
			update.players[0].hand.push(card('draw-1'), card('draw-2'), card('draw-3'));
			f.room.transitions.onStateReceived(update, 'self');
			f.room.gameState = update;
			const draw = f.room.transitions.cardIn(element(rect(200, 500), true), {
				id: 'draw-3',
				playerId: 'self'
			});
			expect(draw.delay).toBe(300);
			expect(draw.duration).toBe(450);
			expect(f.room.transitions.phase2TableOwners.size).toBe(0);
			f.room.gameState = null;
			f.room.transitions.onStateReceived(update, 'self');
			expect(f.room.transitions.handCollectionDelays.size).toBe(0);
		} finally {
			f.restore();
		}
	});
});

describe('Animation interruption and accessibility', () => {
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
	function roomWithHand(count = 1) {
		const room = new RoomState('animation-safety');
		room.playerId = 'self';
		room.gameState = {
			status: 'playing',
			phase: 2,
			activePlayerIdx: 0,
			trickWinnerId: null,
			players: [
				{
					id: 'self',
					color: '#10b981',
					hand: Array.from({ length: count }, (_, i) => ({
						id: `card-${i}`,
						value: '8',
						suitName: 'spades',
						suit: '♠',
						color: 'black'
					})),
					isDone: false,
					isSkitgubbe: false
				}
			],
			tablePile: [],
			tablePilePlayers: []
		};
		return room;
	}

	test('a cancelled ending cannot advance a newer ending or stop its shake', async () => {
		const room = roomWithHand();
		const timers: Array<() => void> = [];
		room.trackTimeout = (cb: () => void) => timers.push(cb);
		const oldEnding = room.runEndGameAnimation(room.localPlayer);
		room.cancelEndGameAnimation();
		const newEnding = room.runEndGameAnimation(room.localPlayer);
		timers.shift()!();
		await oldEnding;
		expect(room.endGameStage).toBe('paused');
		for (let i = 0; i < 3; i++) {
			timers.shift()!();
			await flush();
		}
		await newEnding;
		expect(room.endGameStage).toBe('poster_slam');
		room.handlePosterLanded();
		const oldShake = timers.shift()!;
		room.cancelEndGameAnimation();
		const finalEnding = room.runEndGameAnimation(room.localPlayer);
		for (let i = 0; i < 3; i++) {
			timers.shift()!();
			await flush();
		}
		await finalEnding;
		room.handlePosterLanded();
		oldShake();
		expect(room.shakeActive).toBe(true);
		timers.shift()!();
		expect(room.shakeActive).toBe(false);
		room.destroy();
	});

	test('pointer cancellation releases capture and resets the drag without playing', () => {
		const room = roomWithHand();
		const drag = new CardDragState(room);
		let captured: number | null = null;
		let sent = 0;
		room.sendWsMessage = () => sent++;
		const target = {
			setPointerCapture: (id: number) => {
				captured = id;
			},
			hasPointerCapture: (id: number) => captured === id,
			releasePointerCapture: () => {
				captured = null;
			}
		};
		drag.handleCardPointerDown(
			{ button: 0, pointerId: 7, currentTarget: target, clientX: 100, clientY: 500 },
			'card-0',
			0
		);
		drag.handlePointerMove({ pointerId: 7, clientX: 150, clientY: 300 });
		expect(drag.isDragging).toBe(true);
		expect(captured).toBe(7);
		drag.cancelDrag({ pointerId: 8 });
		expect(drag.isDragging).toBe(true);
		drag.cancelDrag({ pointerId: 7 });
		expect(captured).toBeNull();
		expect(drag.isDragging).toBe(false);
		expect(drag.dragOffset).toEqual({ x: 0, y: 0 });
		expect(drag.cardsBeingDragged).toEqual([]);
		drag.handlePointerUp({ pointerId: 7, clientX: 150, clientY: 300 });
		expect(sent).toBe(0);
		room.destroy();
	});

	test('replay reveal blocks interaction until completion and old fallbacks cannot unlock a new reveal', () => {
		const room = roomWithHand(30);
		const timers: Array<() => void> = [];
		room.trackTimeout = (cb: () => void) => timers.push(cb);
		room.isReplaying = true;
		room.revealHandAfterReplay();
		expect(room.isRevealingHand).toBe(true);
		expect(room.isHumanTurn).toBe(false);
		room.handleCardClick(0, 'card-0');
		expect(room.selectedCardIds).toEqual([]);
		const drag = new CardDragState(room);
		drag.handleCardPointerDown({ button: 0, clientX: 0, clientY: 0 }, 'card-0', 0);
		expect(drag.activeDraggedCardId).toBeNull();
		room.finishHandReveal();
		expect(room.isHumanTurn).toBe(true);
		room.revealHandAfterReplay();
		timers.shift()!();
		expect(room.isRevealingHand).toBe(true);
		timers.shift()!();
		expect(room.isRevealingHand).toBe(false);
		room.destroy();
	});

	test('the final escape celebrates once, but replay and already-ended initial loads do not', () => {
		const room = roomWithHand();
		const colors: string[] = [];
		room.confettiRef = {
			fire: async (color: string) => {
				colors.push(color);
			}
		};
		room.updateEscapeCelebrations();
		room.gameState.status = 'ended';
		room.gameState.players[0].isDone = true;
		room.updateEscapeCelebrations();
		room.updateEscapeCelebrations();
		expect(colors).toEqual(['#10b981']);
		room.isFirstStateUpdate = true;
		room.updateEscapeCelebrations();
		expect(colors).toHaveLength(1);
		room.gameState.players[0].isDone = false;
		room.updateEscapeCelebrations();
		room.isReplaying = true;
		room.gameState.players[0].isDone = true;
		room.updateEscapeCelebrations();
		room.isReplaying = false;
		room.updateEscapeCelebrations();
		expect(colors).toHaveLength(1);
		room.destroy();
	});

	test('the final burst is brown only for the local Skitgubbe and fires once', () => {
		for (const viewer of ['self', 'winner', 'spectator']) {
			const room = roomWithHand();
			room.playerId = viewer;
			room.gameState.players.push(
				{ id: 'winner', color: '#123456', hand: [], isDone: false, isSkitgubbe: false },
				{ id: 'other', color: '#abcdef', hand: [], isDone: false, isSkitgubbe: false }
			);
			const bursts: unknown[][] = [];
			room.confettiRef = {
				fire: async (...args: unknown[]) => {
					bursts.push(args);
				}
			};
			room.updateEscapeCelebrations();
			room.gameState.status = 'ended';
			room.gameState.players[0].isSkitgubbe = true;
			room.gameState.players[1].isDone = true;
			room.gameState.players[2].isDone = true;
			room.updateEscapeCelebrations();
			room.updateEscapeCelebrations();
			expect(bursts).toEqual(
				viewer === 'self' ? [[undefined, 'skitgubbe']] : [['#123456'], ['#abcdef']]
			);
			// Even an inconsistent done flag must never celebrate the loser as an escape.
			room.gameState.players[0].isDone = true;
			room.updateEscapeCelebrations();
			expect(bursts).toHaveLength(viewer === 'self' ? 1 : 2);
			room.destroy();
		}
	});

	test('reduced motion shows results immediately, skips travel, and suppresses celebrations', async () => {
		const room = roomWithHand();
		room.handleMotionPreferenceChange({ matches: true });
		const timers: Array<() => void> = [];
		room.trackTimeout = (cb: () => void) => timers.push(cb);
		await room.runEndGameAnimation(room.localPlayer);
		expect(room.endGameStage).toBe('poster_slam');
		room.handlePosterLanded();
		expect(room.shakeActive).toBe(false);
		expect(timers).toHaveLength(0);
		expect(room.transitions.cardIn({}, { id: 'card-0' }).duration).toBe(0);
		expect(room.transitions.cardOut({}, { id: 'card-0' }).duration).toBe(0);
		room.revealHandAfterReplay();
		expect(room.isRevealingHand).toBe(false);
		let bursts = 0;
		room.confettiRef = {
			fire: async () => {
				bursts++;
			}
		};
		room.updateEscapeCelebrations();
		room.gameState.players[0].isDone = true;
		room.updateEscapeCelebrations();
		expect(bursts).toBe(0);
		room.destroy();
	});
});
