import { describe, test, expect } from 'bun:test';
import type { DbGamePlayer, DbMove } from '../src/db.js';
import { replayGame } from '../src/gameReplay.js';
import { applyDecline } from '../src/gameLogic.js';
import { createDeck, shuffle, cardToInt, type GameState } from 'shared';

describe('Skitgubbe Replay Engine', () => {
	const dbPlayers: DbGamePlayer[] = [
		{
			game_id: 'test',
			profile_id: 'p1',
			role: 'host',
			is_ready: 1,
			invite_status: 'accepted',
			turn_order: 0,
			name: 'Alice',
			color: '#ff0000'
		},
		{
			game_id: 'test',
			profile_id: 'p2',
			role: 'player',
			is_ready: 1,
			invite_status: 'accepted',
			turn_order: 1,
			name: 'Bob',
			color: '#00ff00'
		}
	];

	test('replays start game correctly', () => {
		const initialDeck = shuffle(createDeck());
		const moves: DbMove[] = [
			{
				id: 1,
				game_id: 'test',
				seq: 0,
				player_id: 'p1',
				move_type: 'S',
				cards: null,
				created_at: new Date().toISOString()
			}
		];

		const state = replayGame('test', dbPlayers, initialDeck, moves);

		expect(state.status).toBe('playing');
		expect(state.phase).toBe(1);
		expect(state.deck.length).toBe(46); // 52 - 6 dealt cards (3 each to Alice & Bob)
		expect(state.players[0].hand.length).toBe(3);
		expect(state.players[1].hand.length).toBe(3);
		expect(state.activePlayerIdx).toBe(0); // Alice leads
	});

	test('replays moves sequentially and transitions phase', () => {
		const initialDeck = createDeck(); // Not shuffled so we know exactly what is drawn
		// Top of the deck:
		// clubs-A = 51, clubs-K = 50, clubs-Q = 49, clubs-J = 48, clubs-10 = 47, clubs-9 = 46, clubs-8 = 45, etc.
		// Deal 3 cards to Alice (deck.slice(49)): clubs-Q, clubs-K, clubs-A (sorted: clubs-Q, clubs-K, clubs-A)
		// Deal 3 cards to Bob (deck.slice(46, 49)): clubs-9, clubs-10, clubs-J (sorted: clubs-9, clubs-10, clubs-J)
		// Deck left: 46 cards (0 to 45) -> Top is clubs-8 (45), clubs-7 (44)

		const moves: DbMove[] = [
			{
				id: 1,
				game_id: 'test',
				seq: 0,
				player_id: 'p1',
				move_type: 'S',
				cards: null,
				created_at: new Date().toISOString()
			},
			{
				id: 2,
				game_id: 'test',
				seq: 1,
				player_id: 'p1',
				move_type: 'P',
				cards: '36',
				created_at: new Date().toISOString()
			}
		];

		// Instead of guessing exact numbers, let's build the move dynamically based on the dealt hands
		const stateAfterStart = replayGame('test', dbPlayers, initialDeck, []);
		// Let's run start and see what hands they get
		const stateStart = replayGame('test', dbPlayers, initialDeck, [moves[0]]);
		const aliceHand = stateStart.players[0].hand;
		const bobHand = stateStart.players[1].hand;

		// Alice plays a card from her hand
		const aliceCard = aliceHand[0];
		moves[1].cards = String(cardToInt(aliceCard));

		const statePlay = replayGame('test', dbPlayers, initialDeck, moves);
		expect(statePlay.tablePile.length).toBe(1);
		expect(statePlay.tablePile[0][0].id).toBe(aliceCard.id);
		expect(statePlay.activePlayerIdx).toBe(1); // turn order advanced to Bob (index 1)
		expect(statePlay.players[0].hand.length).toBe(3); // Alice drew replacement from deck
	});

	test('replays player decline/leave during active game by replacing with bot', () => {
		const initialDeck = createDeck();
		const moves: DbMove[] = [
			{
				id: 1,
				game_id: 'test',
				seq: 0,
				player_id: 'p1',
				move_type: 'S',
				cards: null,
				created_at: new Date().toISOString()
			},
			{
				id: 2,
				game_id: 'test',
				seq: 1,
				player_id: 'p2',
				move_type: 'L',
				cards: null,
				created_at: new Date().toISOString()
			}
		];

		const state = replayGame('test', dbPlayers, initialDeck, moves);
		expect(state.status).toBe('playing');
		expect(state.players.length).toBe(2);
		expect(state.players[1].id).toBe('p2');
		expect(state.players[1].isBot).toBe(true);
	});

	test('replays trick completion via chance play and determines trick winner', () => {
		const initialDeck = createDeck();
		const moves: DbMove[] = [
			{
				id: 1,
				game_id: 'test',
				seq: 0,
				player_id: 'p1',
				move_type: 'S',
				cards: null,
				created_at: new Date().toISOString()
			},
			{
				id: 2,
				game_id: 'test',
				seq: 1,
				player_id: 'p1',
				move_type: 'P',
				cards: '',
				created_at: new Date().toISOString()
			},
			{
				id: 3,
				game_id: 'test',
				seq: 2,
				player_id: 'p2',
				move_type: 'C',
				cards: '',
				created_at: new Date().toISOString()
			}
		];

		const stateStart = replayGame('test', dbPlayers, initialDeck, [moves[0]]);
		const aliceHand = stateStart.players[0].hand;
		const topDeckCard = stateStart.deck[stateStart.deck.length - 1];

		moves[1].cards = String(cardToInt(aliceHand[0]));
		moves[2].cards = String(cardToInt(topDeckCard));

		const stateFinal = replayGame('test', dbPlayers, initialDeck, moves);

		expect(stateFinal.trickWinnerId).not.toBeNull();
		expect(stateFinal.tablePile.length).toBe(2);
	});

	test('replays players joining and leaving lobby during waiting status', () => {
		const waitingDbPlayers: DbGamePlayer[] = [
			{
				game_id: 'test',
				profile_id: 'p1',
				role: 'host',
				is_ready: 1,
				invite_status: 'accepted',
				turn_order: 0,
				name: 'Alice',
				color: '#ff0000'
			}
		];

		const initialDeck = createDeck();
		const moves: DbMove[] = [
			{
				id: 1,
				game_id: 'test',
				seq: 0,
				player_id: 'p2',
				move_type: 'A', // Bob joins
				cards: null,
				created_at: new Date().toISOString()
			},
			{
				id: 2,
				game_id: 'test',
				seq: 1,
				player_id: 'p2',
				move_type: 'L', // Bob leaves
				cards: null,
				created_at: new Date().toISOString()
			}
		];

		const state = replayGame('test', waitingDbPlayers, initialDeck, moves);
		expect(state.status).toBe('waiting');
		expect(state.players.length).toBe(1);
		expect(state.players[0].id).toBe('p1');
	});

	test('applyDecline adjusts active turn index correctly in lobby', () => {
		const state: GameState = {
			status: 'waiting',
			phase: 1,
			activePlayerIdx: 2, // Charlie's turn
			players: [
				{ id: 'p1', name: 'Alice', color: 'red', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false, isHost: true, inviteStatus: 'accepted' },
				{ id: 'p2', name: 'Bob', color: 'green', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false, isHost: false, inviteStatus: 'accepted' },
				{ id: 'p3', name: 'Charlie', color: 'blue', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false, isHost: false, inviteStatus: 'accepted' }
			],
			deck: [],
			tablePile: [],
			tablePilePlayers: [],
			discardPile: [],
			trumpCard: null,
			hiddenTrumpStorage: null,
			logs: [],
			tieBreakerActive: false,
			tiedPlayerIds: [],
			tieBreakerStartPileSize: 0,
			trickWinnerId: null
		};

		// 1. Player before the active player leaves (p1 leaves at index 0, active turns shifts from 2 to 1)
		applyDecline(state, 'p1');
		expect(state.players.length).toBe(2);
		expect(state.players[0].id).toBe('p2');
		expect(state.players[1].id).toBe('p3');
		expect(state.activePlayerIdx).toBe(1); // Charlie is now at index 1

		// 2. Active player leaves (Charlie at index 1 leaves, turn wraps around to 0)
		applyDecline(state, 'p3');
		expect(state.players.length).toBe(1);
		expect(state.players[0].id).toBe('p2');
		expect(state.activePlayerIdx).toBe(0);

		// 3. Last player leaves (Bob at index 0 leaves)
		applyDecline(state, 'p2');
		expect(state.players.length).toBe(0);
		expect(state.activePlayerIdx).toBe(0);
	});
});

