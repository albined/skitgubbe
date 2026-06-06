<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Card {
		id: string; // e.g., "spades-A"
		suit: '♠' | '♥' | '♦' | '♣';
		value: string;
		suitName: 'spades' | 'hearts' | 'diamonds' | 'clubs';
		color: 'red' | 'black';
	}

	interface Player {
		id: string; // 'human' | 'cpu1' | 'cpu2'
		name: string;
		color: string; // Avatar solid color
		hand: Card[];
		reserveStack: Card[]; // Trick cards won in Phase 1
		isDone: boolean; // Escaped Hand in Phase 2
		isSkitgubbe: boolean; // Loser flag
	}

	// Svelte 5 Runes for reactive game states
	let deck = $state<Card[]>([]);
	let players = $state<Player[]>([
		{ id: 'human', name: 'You', color: '#3b82f6', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false },
		{ id: 'cpu1', name: 'CPU 1', color: '#10b981', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false },
		{ id: 'cpu2', name: 'CPU 2', color: '#f59e0b', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false }
	]);
	
	let activePlayerIdx = $state(0);
	let phase = $state<1 | 2>(1);
	let tablePile = $state<Card[][]>([]); // Array of play batches
	let tablePilePlayers = $state<string[]>([]); // Player IDs matching tablePile batches
	let discardPile = $state<Card[]>([]); // Burned cards in Phase 2
	let trumpCard = $state<Card | null>(null);
	let hiddenTrumpStorage = $state<{ playerId: string; card: Card } | null>(null);
	let logs = $state<string[]>([]);
	
	let tieBreakerActive = $state(false);
	let tiedPlayerIds = $state<string[]>([]);
	let tieBreakerStartPileSize = $state(0);
	let trickWinnerId = $state<string | null>(null);
	let isCpuThinking = $state(false);
	let isAutoPlay = $state(true);

	// User Selection States
	let selectedCardIds = $state<string[]>([]);
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let fanCenterIdx = $state(-1);

	// Screen sizing & layout derived variables
	let containerWidth = $state(800);
	let innerHeight = $state(800);
	let innerWidth = $state(800);
	const cardWidth = $derived(
		Math.max(52, Math.min(Math.min(innerHeight * 0.15, innerWidth * 0.14), 125))
	);
	const maxHandWidth = $derived(Math.max(cardWidth, containerWidth - cardWidth));

	// Derived Game state mappings
	const humanHand = $derived(players.length > 0 ? players[0].hand : []);
	const selectedCards = $derived(humanHand.filter(c => selectedCardIds.includes(c.id)));
	const isHumanTurn = $derived(players.length > 0 && activePlayerIdx === 0 && !trickWinnerId && !players[0].isDone && !players[0].isSkitgubbe);
	const trumpSuit = $derived(trumpCard ? trumpCard.suitName : null);
	const isSelectionValid = $derived(
		isValidPlay(selectedCards, humanHand, tablePile, phase, tieBreakerActive, tiedPlayerIds, 'human', trumpSuit)
	);

	const isStroValid = $derived(
		phase === 1 &&
		!trickWinnerId &&
		selectedCardIds.length > 0 &&
		(() => {
			const firstVal = selectedCards[0].value;
			if (!selectedCards.every(c => c.value === firstVal)) return false;
			return tablePilePlayers.some((playerId, idx) => 
				playerId === 'human' && tablePile[idx].length > 0 && tablePile[idx][0].value === firstVal
			);
		})()
	);
	
	const activeSpreadCardId = $derived(hoveredCardId ?? focusedCardId);
	const activeSpreadIdx = $derived(
		activeSpreadCardId ? humanHand.findIndex(c => c.id === activeSpreadCardId) : -1
	);

	// Card Order Ranking Helper
	const VALUES_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
	function getValueNumeric(card: Card): number {
		return VALUES_ORDER.indexOf(card.value) + 2;
	}

	// Sort hand helper by suit and value
	const SUITS_ORDER = ['spades', 'hearts', 'diamonds', 'clubs'];
	function sortHand(hand: Card[]): Card[] {
		return [...hand].sort((a, b) => {
			const suitDiff = SUITS_ORDER.indexOf(a.suitName) - SUITS_ORDER.indexOf(b.suitName);
			if (suitDiff !== 0) return suitDiff;
			return getValueNumeric(a) - getValueNumeric(b);
		});
	}

	// Helper to create a standard 52-card deck
	function createDeck(): Card[] {
		const suits = [
			{ symbol: '♠', name: 'spades', color: 'black' },
			{ symbol: '♥', name: 'hearts', color: 'red' },
			{ symbol: '♦', name: 'diamonds', color: 'red' },
			{ symbol: '♣', name: 'clubs', color: 'black' }
		] as const;
		const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
		const newDeck: Card[] = [];

		for (const suit of suits) {
			for (const value of values) {
				newDeck.push({
					id: `${suit.name}-${value}`,
					suit: suit.symbol,
					value,
					suitName: suit.name,
					color: suit.color
				});
			}
		}
		return newDeck;
	}

	// Shuffle helper (Fisher-Yates)
	function shuffle(array: Card[]): Card[] {
		const arr = [...array];
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	// Initialize / Reset Game
	function initializeGame() {
		deck = shuffle(createDeck());
		players = [
			{ id: 'human', name: 'You', color: '#3b82f6', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false },
			{ id: 'cpu1', name: 'CPU 1', color: '#10b981', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false },
			{ id: 'cpu2', name: 'CPU 2', color: '#f59e0b', hand: [], reserveStack: [], isDone: false, isSkitgubbe: false }
		];
		
		// Deal starting hand (3 cards each)
		for (const p of players) {
			p.hand = sortHand(deck.slice(deck.length - 3));
			deck = deck.slice(0, deck.length - 3);
		}
		
		discardPile = [];
		tablePile = [];
		tablePilePlayers = [];
		trumpCard = null;
		hiddenTrumpStorage = null;
		logs = ['🎲 Game started. Phase 1: The Gathering. Your lead!'];
		phase = 1;
		activePlayerIdx = 0; // Human leads
		tieBreakerActive = false;
		tiedPlayerIds = [];
		tieBreakerStartPileSize = 0;
		selectedCardIds = [];
		trickWinnerId = null;
		isCpuThinking = false;
	}

	// Setup initial game on mount
	onMount(() => {
		initializeGame();
	});

	// Toggle selection of a card in hand
	function toggleSelect(cardId: string) {
		if (selectedCardIds.includes(cardId)) {
			selectedCardIds = selectedCardIds.filter(id => id !== cardId);
		} else {
			selectedCardIds = [...selectedCardIds, cardId];
		}
	}

	// Helper to group cards by value
	function groupHandByValue(hand: Card[]) {
		const groups: { [val: string]: Card[] } = {};
		for (const card of hand) {
			if (!groups[card.value]) groups[card.value] = [];
			groups[card.value].push(card);
		}
		return groups;
	}

	// Click handler to collapse focused cards when clicking on background
	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.card')) {
			focusedCardId = null;
			fanCenterIdx = -1;
		}
	}

	// Draw replacements immediately after card play
	function drawReplacements(player: Player, count: number) {
		const targetHandSize = 3;
		const currentSize = player.hand.length;
		const toDraw = Math.max(count, targetHandSize - currentSize);
		for (let i = 0; i < toDraw; i++) {
			if (deck.length === 0) break;
			const nextCard = deck[deck.length - 1];
			deck = deck.slice(0, deck.length - 1);
			
			if (deck.length === 0) {
				// Last card drawn: designated as hidden trump
				hiddenTrumpStorage = { playerId: player.id, card: nextCard };
				logs = [...logs, `🔒 ${player.name} drew the absolute last card (Hidden Trump Storage)!`];
			} else {
				player.hand = sortHand([...player.hand, nextCard]);
			}
		}
	}

	// Verify if played cards form a valid action under Skitgubbe rules
	function isValidPlay(
		selected: Card[],
		handCards: Card[],
		table: Card[][],
		currPhase: number,
		isTie: boolean,
		tiedIds: string[],
		playerId: string,
		tSuit: string | null
	): boolean {
		if (selected.length === 0) return false;

		if (currPhase === 1) {
			if (isTie) {
				// Tie-breaker requires exactly 1 card of any value
				return selected.length === 1;
			}
			// Phase 1 requires all played cards to be of the same value
			const firstVal = selected[0].value;
			return selected.every(c => c.value === firstVal);
		}

		if (currPhase === 2) {
			// Phase 2 requires same suit cards in a sequential order, or Trump Suit cards
			const suit = selected[0].suitName;
			if (!selected.every(c => c.suitName === suit)) return false;

			// Sort selected cards numerically
			const sorted = [...selected].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
			
			// Verify sequential values
			for (let i = 0; i < sorted.length - 1; i++) {
				if (getValueNumeric(sorted[i + 1]) !== getValueNumeric(sorted[i]) + 1) {
					return false;
				}
			}

			// Empty table: any card or valid sequence goes
			if (table.length === 0) return true;

			// Check against the top card of the table pile
			const topBatch = table[table.length - 1];
			const topCard = topBatch[topBatch.length - 1];

			const topVal = getValueNumeric(topCard);
			const topSuit = topCard.suitName;

			const playVal = getValueNumeric(sorted[0]);
			const playSuit = sorted[0].suitName;

			const isTrumpPlay = (playSuit === tSuit);
			const isTopTrump = (topSuit === tSuit);

			if (isTopTrump) {
				// Beat a trump card with a higher value trump card
				return isTrumpPlay && playVal > topVal;
			} else {
				if (isTrumpPlay) {
					// Trump card beats any normal suit card
					return true;
				} else {
					// Normal card must match suit and be higher value
					return playSuit === topSuit && playVal > topVal;
				}
			}
		}

		return false;
	}

	// Check if player has escaped (won)
	function checkPlayerEscape(player: Player) {
		if (player.hand.length === 0 && !player.isDone) {
			player.isDone = true;
			logs = [...logs, `🎉 ${player.name} emptied their hand and ESCAPED! 🎉`];
			
			// Check game end conditions
			const remaining = players.filter(p => !p.isDone);
			if (remaining.length === 1) {
				const loser = remaining[0];
				loser.isSkitgubbe = true;
				logs = [...logs, `💀 Game Over! ${loser.name} is the Skitgubbe! 💀`];
			}
		}
	}

	// Move to next player in clockwise direction (Phase 2)
	function progressPhase2Turn() {
		const remaining = players.filter(p => !p.isDone);
		if (remaining.length <= 1) return;
		
		let nextIdx = (activePlayerIdx + 1) % players.length;
		while (players[nextIdx].isDone) {
			nextIdx = (nextIdx + 1) % players.length;
		}
		activePlayerIdx = nextIdx;
	}

	// Verify game continuation or shift focus after escape
	function checkGameOverOrProgress() {
		const remaining = players.filter(p => !p.isDone);
		if (remaining.length <= 1) return;
		if (players[activePlayerIdx].isDone) {
			progressPhase2Turn();
		}
	}

	// Pick Up oldest batch on table (Phase 2 Fail Action)
	function pickUpTableBatch(playerId: string) {
		const player = players.find(p => p.id === playerId)!;
		if (tablePile.length === 0) return;

		const oldestBatch = tablePile[0];
		const oldestPlayerId = tablePilePlayers[0];
		const oldestPlayer = players.find(p => p.id === oldestPlayerId)!;

		// Add cards to hand
		player.hand = sortHand([...player.hand, ...oldestBatch]);
		
		// Remove from table
		tablePile = tablePile.slice(1);
		tablePilePlayers = tablePilePlayers.slice(1);

		logs = [...logs, `❌ ${player.name} picked up the oldest batch (${oldestBatch.map(c => c.value + c.suit).join(' ')} played by ${oldestPlayer.name})`];
		selectedCardIds = [];

		progressPhase2Turn();
	}

	// Discard cards in Phase 2
	function playCardsPhase2(playerId: string, cards: Card[]) {
		const player = players.find(p => p.id === playerId)!;

		// Remove played cards from player's hand
		player.hand = sortHand(player.hand.filter(h => !cards.some(c => c.id === h.id)));

		// Sort cards before laying on table
		const sorted = [...cards].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		
		// Put batch on table
		tablePile = [...tablePile, sorted];
		tablePilePlayers = [...tablePilePlayers, playerId];

		logs = [...logs, `📤 ${player.name} played: ${sorted.map(c => c.value + c.suit).join(' ')}`];
		selectedCardIds = [];

		checkPlayerEscape(player);

		// Burn check: distinct play batches count equals number of remaining active players
		const activeCount = players.filter(p => !p.isDone).length;
		if (tablePile.length === activeCount) {
			logs = [...logs, `🔥 Table Burned! ${player.name} clears the deck and starts next.`];
			
			// Push to discard pile
			const burned = tablePile.flat();
			discardPile = [...discardPile, ...burned];

			tablePile = [];
			tablePilePlayers = [];
			
			checkGameOverOrProgress();

			// If the active player is still a CPU, run their turn
			const nextActive = players[activePlayerIdx];
			if (nextActive && nextActive.id !== 'human' && !nextActive.isDone && !nextActive.isSkitgubbe) {
				if (isAutoPlay) {
					playCpuTurn();
				}
			}
		} else {
			progressPhase2Turn();
		}
	}

	// Trigger Phase 2 transition sequence
	function transitionToPhase2() {
		phase = 2;
		logs = [...logs, '🔄 All Phase 1 cards drawn. Transitioning to Phase 2: The Shedding!'];

		// Pick up won reserve stacks
		for (const p of players) {
			p.hand = sortHand([...p.hand, ...p.reserveStack]);
			p.reserveStack = [];
			logs = [...logs, `${p.name} picked up reserve stack. Hand: ${p.hand.length} cards.`];
		}

		// Reveal Hidden Trump
		if (hiddenTrumpStorage) {
			const { playerId, card } = hiddenTrumpStorage;
			const owner = players.find(p => p.id === playerId)!;

			trumpCard = card;
			logs = [...logs, `👑 Trump revealed: ${card.value}${card.suit} (${card.suitName.toUpperCase()})`];
			logs = [...logs, `${owner.name} adds it to hand and leads Phase 2!`];

			owner.hand = sortHand([...owner.hand, card]);
			activePlayerIdx = players.findIndex(p => p.id === playerId);
		} else {
			activePlayerIdx = 0;
		}

		tablePile = [];
		tablePilePlayers = [];
		discardPile = [];

		// Run escape checks on all players
		for (const p of players) {
			checkPlayerEscape(p);
		}
		checkGameOverOrProgress();

		// If the leading player in Phase 2 is a CPU, trigger their turn
		const nextActive = players[activePlayerIdx];
		if (nextActive && nextActive.id !== 'human' && !nextActive.isDone && !nextActive.isSkitgubbe) {
			if (isAutoPlay) {
				playCpuTurn();
			}
		}
	}

	// Progress Turn in Phase 1
	function progressPhase1Turn() {
		if (tieBreakerActive) {
			const subRoundPlays = tablePile.length - tieBreakerStartPileSize;
			if (subRoundPlays === tiedPlayerIds.length) {
				resolveTieBreaker();
			} else {
				const nextTiedId = tiedPlayerIds[subRoundPlays];
				activePlayerIdx = players.findIndex(p => p.id === nextTiedId);
			}
		} else {
			if (tablePile.length === players.filter(p => !p.isDone).length) {
				resolveNormalRoundPhase1();
			} else {
				activePlayerIdx = (activePlayerIdx + 1) % players.length;
			}
		}
	}

	// Resolve normal round in Phase 1
	function resolveNormalRoundPhase1() {
		let maxVal = -1;
		let plays = [];

		for (let i = 0; i < tablePile.length; i++) {
			const playerId = tablePilePlayers[i];
			const val = getValueNumeric(tablePile[i][0]);
			plays.push({ playerId, val });
			if (val > maxVal) {
				maxVal = val;
			}
		}

		const winners = plays.filter(p => p.val === maxVal);
		if (winners.length === 1) {
			const winnerId = winners[0].playerId;
			const winner = players.find(p => p.id === winnerId)!;

			winner.reserveStack = [...winner.reserveStack, ...tablePile.flat()];
			logs = [...logs, `⭐ ${winner.name} wins trick with ${tablePile[plays.findIndex(p => p.playerId === winnerId)][0].value}s!`];

			trickWinnerId = winnerId;
			activePlayerIdx = players.findIndex(p => p.id === winnerId);

			setTimeout(() => {
				trickWinnerId = null;
				tablePile = [];
				tablePilePlayers = [];

				if (deck.length === 0 && players.some(p => p.hand.length === 0)) {
					transitionToPhase2();
				}
			}, 2000);
		} else {
			// Check if we must transition to Phase 2 because deck is empty and someone has no cards
			if (deck.length === 0 && players.some(p => p.hand.length === 0)) {
				logs = [...logs, `⚠️ Tie occurred but deck is empty and player has no cards. Transitioning to Phase 2!`];
				transitionToPhase2();
				return;
			}

			// TIE
			const tiedIds = winners.map(w => w.playerId);
			logs = [...logs, `⚔️ Tie for highest! Tied players: ${tiedIds.map(id => players.find(p => p.id === id)!.name).join(', ')}. Tie-breaker starts.`];
			
			tieBreakerActive = true;
			tiedPlayerIds = tiedIds;
			tieBreakerStartPileSize = tablePile.length;
			activePlayerIdx = players.findIndex(p => p.id === tiedPlayerIds[0]);
		}
	}

	// Resolve tie-breaker round in Phase 1
	function resolveTieBreaker() {
		const K = tiedPlayerIds.length;
		const subRoundBatches = tablePile.slice(tablePile.length - K);
		const subRoundPlayers = tablePilePlayers.slice(tablePilePlayers.length - K);

		let maxVal = -1;
		let plays = [];
		for (let i = 0; i < K; i++) {
			const playerId = subRoundPlayers[i];
			const val = getValueNumeric(subRoundBatches[i][0]);
			plays.push({ playerId, val });
			if (val > maxVal) {
				maxVal = val;
			}
		}

		const winners = plays.filter(p => p.val === maxVal);
		if (winners.length === 1) {
			const winnerId = winners[0].playerId;
			const winner = players.find(p => p.id === winnerId)!;

			winner.reserveStack = [...winner.reserveStack, ...tablePile.flat()];
			logs = [...logs, `⭐ ${winner.name} breaks the tie and wins trick with ${subRoundBatches[plays.findIndex(p => p.playerId === winnerId)][0].value}!`];

			trickWinnerId = winnerId;
			activePlayerIdx = players.findIndex(p => p.id === winnerId);
			tieBreakerActive = false;
			tiedPlayerIds = [];

			setTimeout(() => {
				trickWinnerId = null;
				tablePile = [];
				tablePilePlayers = [];

				if (deck.length === 0 && players.some(p => p.hand.length === 0)) {
					transitionToPhase2();
				}
			}, 2000);
		} else {
			const newTiedIds = winners.map(w => w.playerId);

			// Check if we must transition to Phase 2 because deck is empty and someone has no cards
			if (deck.length === 0 && players.some(p => p.hand.length === 0)) {
				logs = [...logs, `⚠️ Tie occurred again but deck is empty and player has no cards. Transitioning to Phase 2!`];
				transitionToPhase2();
				return;
			}

			logs = [...logs, `⚔️ Tied again! Tied: ${newTiedIds.map(id => players.find(p => p.id === id)!.name).join(', ')}. Another tie-breaker card required.`];
			
			tiedPlayerIds = newTiedIds;
			tieBreakerStartPileSize = tablePile.length;
			activePlayerIdx = players.findIndex(p => p.id === tiedPlayerIds[0]);
		}
	}

	// Play cards in Phase 1
	function playCardsPhase1(playerId: string, cards: Card[]) {
		const player = players.find(p => p.id === playerId)!;
		player.hand = sortHand(player.hand.filter(h => !cards.some(c => c.id === h.id)));

		tablePile = [...tablePile, cards];
		tablePilePlayers = [...tablePilePlayers, playerId];

		logs = [...logs, `📤 ${player.name} played: ${cards.map(c => c.value + c.suit).join(' ')}`];
		selectedCardIds = [];

		drawReplacements(player, cards.length);
		progressPhase1Turn();
	}

	// Main card click trigger
	function handleCardClick(idx: number, cardId: string) {
		if (humanHand.length > 15) {
			if (fanCenterIdx === -1) {
				fanCenterIdx = idx;
			} else {
				const L = Math.max(0, fanCenterIdx - 2);
				const R = Math.min(humanHand.length - 1, fanCenterIdx + 2);
				
				if (humanHand.length >= 20 && (idx === L || idx === R)) {
					fanCenterIdx = idx;
				} else if (Math.abs(idx - fanCenterIdx) <= 2) {
					toggleSelect(cardId);
				} else {
					fanCenterIdx = idx;
				}
			}
		} else {
			toggleSelect(cardId);
		}
	}

	// Direct layout trigger from LAY CARDS action button
	function handleLayCardsClick() {
		if (!isHumanTurn) return;
		
		if (phase === 1) {
			playCardsPhase1('human', selectedCards);
		} else {
			playCardsPhase2('human', selectedCards);
		}
	}

	// Sprinkle / Strö click handler
	function handleSprinkleClick() {
		if (phase !== 1 || !isStroValid) return;

		const firstVal = selectedCards[0].value;
		const humanPlayedIdx = tablePilePlayers.findIndex((playerId, idx) => 
			playerId === 'human' && tablePile[idx].length > 0 && tablePile[idx][0].value === firstVal
		);
		if (humanPlayedIdx === -1) return;

		const player = players[0];
		const cardsToSprinkle = [...selectedCards];
		const count = cardsToSprinkle.length;
		
		// Remove selected cards from hand
		player.hand = sortHand(player.hand.filter(h => !selectedCardIds.includes(h.id)));
		
		// Add to existing table batch
		tablePile[humanPlayedIdx] = [...tablePile[humanPlayedIdx], ...cardsToSprinkle];

		logs = [...logs, `✨ You sprinkled: ${cardsToSprinkle.map(c => c.value + c.suit).join(' ')}`];
		
		// Draw replacements
		drawReplacements(player, count);
		
		// Clear selection
		selectedCardIds = [];
	}

	// Chance click handler (Phase 1)
	function handleChanceClick() {
		if (phase !== 1 || !isHumanTurn || deck.length === 0) return;

		const chancedCard = deck[deck.length - 1];
		deck = deck.slice(0, deck.length - 1);

		tablePile = [...tablePile, [chancedCard]];
		tablePilePlayers = [...tablePilePlayers, 'human'];

		logs = [...logs, `🎲 You chanced and played the top card from the deck: ${chancedCard.value}${chancedCard.suit}`];
		selectedCardIds = [];

		progressPhase1Turn();
	}

	// Direct layout trigger from PICK UP action button
	function handlePickUpClick() {
		if (!isHumanTurn || phase !== 2) return;
		pickUpTableBatch('human');
	}

	// Generate all legal plays in Phase 2 (for CPU execution)
	function getLegalPlays(handCards: Card[], table: Card[][], tSuit: string | null): Card[][] {
		const legal: Card[][] = [];
		const suitGroups: { [suit: string]: Card[] } = {};

		for (const card of handCards) {
			if (!suitGroups[card.suitName]) suitGroups[card.suitName] = [];
			suitGroups[card.suitName].push(card);
		}

		// Single card checks
		for (const card of handCards) {
			if (isValidPlay([card], handCards, table, 2, false, [], '', tSuit)) {
				legal.push([card]);
			}
		}

		// Sequence checks (unbroken sequences of same suit of size >= 2)
		for (const suit in suitGroups) {
			const cards = suitGroups[suit].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
			for (let i = 0; i < cards.length; i++) {
				for (let j = i + 1; j < cards.length; j++) {
					const seq = cards.slice(i, j + 1);
					if (isValidPlay(seq, handCards, table, 2, false, [], '', tSuit)) {
						legal.push(seq);
					}
				}
			}
		}

		return legal;
	}

	// Executed automatically when CPU's turn is active
	async function playCpuTurn(bypassWait = false) {
		const activePlayer = players[activePlayerIdx];
		if (!activePlayer || activePlayer.id === 'human' || trickWinnerId || players.filter(p => !p.isDone).length <= 1) return;

		try {
			isCpuThinking = true;
			if (!bypassWait) {
				await new Promise(resolve => setTimeout(resolve, 1400));
			}
			isCpuThinking = false;

			// Re-fetch player index in case state changed during sleep
			if (activePlayerIdx === 0 || players[activePlayerIdx].id === 'human') return;

			if (phase === 1) {
				if (tieBreakerActive) {
					if (tiedPlayerIds.includes(activePlayer.id)) {
						const randomCard = activePlayer.hand[Math.floor(Math.random() * activePlayer.hand.length)];
						playCardsPhase1(activePlayer.id, [randomCard]);
					} else {
						progressPhase1Turn();
					}
				} else {
					const groups = groupHandByValue(activePlayer.hand);
					const groupVals = Object.keys(groups);
					if (groupVals.length > 0) {
						const val = groupVals[Math.floor(Math.random() * groupVals.length)];
						const groupCards = groups[val];
						const count = Math.floor(Math.random() * groupCards.length) + 1;
						const cardsToPlay = groupCards.slice(0, count);
						playCardsPhase1(activePlayer.id, cardsToPlay);
					}
				}
			} else {
				// Phase 2 logic
				const legal = getLegalPlays(activePlayer.hand, tablePile, trumpSuit);
				if (legal.length > 0) {
					const chosen = legal[Math.floor(Math.random() * legal.length)];
					playCardsPhase2(activePlayer.id, chosen);
				} else {
					pickUpTableBatch(activePlayer.id);
				}
			}
		} catch (error) {
			console.error("Error in playCpuTurn:", error);
			isCpuThinking = false;
		}
	}

	// Svelte 5 effect rune: trigger playCpuTurn reactively when activePlayerIdx changes
	$effect(() => {
		const activePlayer = players[activePlayerIdx];
		if (activePlayer && activePlayer.id !== 'human' && !trickWinnerId && players.filter(p => !p.isDone).length > 1) {
			if (isAutoPlay) {
				playCpuTurn();
			}
		}
	});

	// Dynamic deck shadow for piling depth
	function getDeckShadowStyle(count: number): string {
		const layers = Math.min(Math.ceil(count / 4), 10);
		if (layers === 0) return '';
		
		let shadow = '';
		for (let i = 1; i <= layers; i++) {
			shadow += `${i}px ${i}px 0px rgba(212, 175, 55, 0.4), `;
			shadow += `${i}px ${i}px 1px rgba(0,0,0,0.15), `;
		}
		shadow += `${layers + 2}px ${layers + 2}px 12px rgba(0,0,0,0.5)`;
		return `box-shadow: ${shadow}; transform: translate(${-layers/2}px, ${-layers/2}px);`;
	}

	const deckShadowStyle = $derived(getDeckShadowStyle(deck.length));

	// Custom flip & fly-in card transition
	function drawTransition(node: HTMLElement, { duration = 600, targetX = 0 }) {
		return {
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				const startX = -1.4 * cardWidth - targetX;
				const startY = -2.2 * cardWidth;
				
				const x = targetX + (1 - eased) * startX;
				const y = (1 - eased) * startY;
				const scale = 0.55 + eased * 0.45;
				
				const rotate = (1 - eased) * -35;
				const rotateY = (1 - eased) * 180;
				return `
					transform: translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg) rotateY(${rotateY}deg) !important;
					opacity: ${t};
				`;
			}
		};
	}

	// Spacing and dynamic offset math for horizontal arrangement fanning
	function getCardX(index: number, total: number, activeIdx: number): number {
		if (total === 0) return 0;
		if (total === 1) return 0;

		const preferredSpacing = cardWidth * 0.64;

		if (total > 15 && fanCenterIdx !== -1) {
			const L = Math.max(0, fanCenterIdx - 2);
			const R = Math.min(total - 1, fanCenterIdx + 2);
			
			let N_wide = 0;
			for (let i = 0; i < total - 1; i++) {
				if (i >= L && i <= R) {
					N_wide++;
				}
			}
			const N_compressed = (total - 1) - N_wide;

			const minCompressedSpacing = cardWidth * 0.1;
			const preferredFannedSpacing = cardWidth * 0.84;
			let actualWideSpacing = preferredFannedSpacing;
			let compressedSpacing = minCompressedSpacing;
			if (N_compressed > 0) {
				compressedSpacing = (maxHandWidth - N_wide * actualWideSpacing) / N_compressed;
				if (compressedSpacing < minCompressedSpacing) {
					compressedSpacing = minCompressedSpacing;
					actualWideSpacing = (maxHandWidth - N_compressed * minCompressedSpacing) / N_wide;
				}
			}

			// Accumulate positions
			let currentX = 0;
			const positions = [];
			for (let i = 0; i < total; i++) {
				positions.push(currentX);
				if (i < total - 1) {
					const isWideGap = (i >= L && i <= R);
					currentX += isWideGap ? actualWideSpacing : compressedSpacing;
				}
			}
			const W = currentX;
			return positions[index] - W / 2;
		}

		const actualSpacing = Math.min(preferredSpacing, maxHandWidth / (total - 1));
		let x = (index - (total - 1) / 2) * actualSpacing;

		if (activeIdx !== -1 && activeIdx !== index) {
			const diff = index - activeIdx;
			const spreadAmount = Math.max(cardWidth * 0.3, cardWidth * 0.76 - actualSpacing);
			const decayFactor = 0.55;

			if (diff < 0) {
				x -= spreadAmount * Math.pow(decayFactor, Math.abs(diff) - 1);
			} else {
				x += spreadAmount * Math.pow(decayFactor, Math.abs(diff) - 1);
			}
		}

		return x;
	}

	// Card Style Builder for Hand layout
	function getCardStyle(
		cardId: string,
		index: number,
		isSelected: boolean,
		isHovered: boolean,
		xPosition: number
	): string {
		let lift = 0;
		if (isSelected) lift -= cardWidth * 0.28;
		if (isHovered) lift -= cardWidth * 0.20;

		const zIndex = isHovered ? 1000 : index;
		const scale = isHovered ? 1.08 : 1;

		return `
			left: 50%;
			margin-left: calc(-1 * var(--card-width) / 2);
			transform: translate(${xPosition}px, ${lift}px) scale(${scale});
			z-index: ${zIndex};
		`;
	}

	// Derived game escape checks
	const gameWinner = $derived(
		players.find(p => p.isDone && !players.some(op => op.isSkitgubbe))?.name ?? null
	);
	const skitgubbe = $derived(
		players.find(p => p.isSkitgubbe)?.name ?? null
	);

	// Hand fanning count helper
	const handCount = $derived(humanHand.length);
</script>

<svelte:window bind:innerHeight={innerHeight} bind:innerWidth={innerWidth} onclick={handleWindowClick} />

<div class="felt-overlay"></div>

<div class="game-layout relative w-screen h-screen flex flex-col justify-between select-none overflow-hidden" style="--card-width: {cardWidth}px; --card-height: {cardWidth * 1.4}px; --hand-container-height: {cardWidth * 1.4 * 1.35}px;">
	
	<!-- Top Container: Sidebars and Center Game Board -->
	<div class="flex-grow flex w-full overflow-hidden">
		
		<!-- Left Sidebar: Draw, Discard, and Trump -->
		<div class="left-sidebar flex flex-col items-center justify-start flex-shrink-0 z-10">
			
			<div class="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest mt-1 mb-2">
				Phase {phase}
			</div>

			<!-- Trump Box -->
			<div class="compact-pile-box w-full flex items-center justify-start gap-2">
				{#if trumpCard}
					<div class="rounded relative cursor-default" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<div class="card-face shadow-md" style="padding: 1px; border: 1.5px solid #ffd700; border-radius: 4px;">
							<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
								<rect width="125" height="175" rx="12" fill="#ffffff" />
								<text x="14" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill={trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{trumpCard.value}</text>
								<text x="14" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" fill={trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{trumpCard.suit}</text>
								
								<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" fill={trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{trumpCard.suit}</text>
								
								<g transform="rotate(180 62.5 87.5)">
									<text x="14" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill={trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{trumpCard.value}</text>
									<text x="14" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" fill={trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{trumpCard.suit}</text>
								</g>
							</svg>
						</div>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] font-bold text-yellow-400 uppercase font-mono truncate max-w-[65px]">{trumpCard.suitName}</span>
					</div>
				{:else if hiddenTrumpStorage}
					{@const owner = players.find(p => p.id === (hiddenTrumpStorage ? hiddenTrumpStorage.playerId : ''))}
					<div class="rounded border border-dashed border-slate-700 bg-slate-950/20 flex flex-col justify-center items-center text-center p-0.5 text-[6px] text-slate-500 font-mono leading-none" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<span>HELD BY<br/>{owner?.name.toUpperCase()}</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] text-slate-500 uppercase font-mono">Hidden</span>
					</div>
				{:else}
					<div class="rounded border border-dashed border-slate-800 bg-slate-950/5 flex flex-col justify-center items-center text-[7px] text-slate-600 font-mono leading-none" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<span>NONE</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] text-slate-500 uppercase font-mono">None</span>
					</div>
				{/if}
			</div>

			<!-- Draw Pile Box (Phase 1) or Discard Pile Box (Phase 2) -->
			{#if phase === 1}
				<div class="compact-pile-box w-full flex flex-col items-start gap-2 mt-2" transition:fade>
					<div class="flex items-center justify-start gap-2 w-full">
						<div class="rounded relative overflow-hidden flex-shrink-0 border border-amber-500/30 shadow-md" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);">
							{#if deck.length > 0}
								<div class="w-full h-full card-back" style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"></div>
							{:else}
								<div class="w-full h-full bg-emerald-950/40 border border-dashed border-emerald-700/60 rounded flex items-center justify-center text-[7px] text-emerald-600/70 font-bold font-mono">
									EMPTY
								</div>
							{/if}
						</div>
						<div class="flex flex-col select-none">
							<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Draw</span>
							<span class="text-[10px] font-bold font-mono text-yellow-400">{deck.length} left</span>
						</div>
					</div>
					{#if deck.length > 0}
						<button
							onclick={handleChanceClick}
							disabled={!isHumanTurn}
							class="chance-btn w-full rounded bg-amber-500 disabled:bg-slate-800/40 hover:bg-amber-600 disabled:text-slate-500 text-slate-950 font-bold tracking-wide uppercase transition-all duration-200 border border-slate-700/30 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-md"
						>
							Chance
						</button>
					{/if}
				</div>
			{:else}
				<div class="compact-pile-box w-full flex items-center justify-start gap-2 mt-2" transition:fade>
					<div class="rounded border border-emerald-800/40 bg-emerald-950/20 relative flex items-center justify-center shadow-inner flex-shrink-0" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);">
						{#if discardPile.length > 0}
							<div class="w-full h-full card-face" style="padding: 1px; border-radius: 4px;">
								<div class="text-[7px] font-bold text-center mt-2 text-slate-600 font-mono leading-none">BURNED</div>
							</div>
						{:else}
							<div class="text-[7px] text-emerald-700/60 font-bold font-mono">BURN</div>
						{/if}
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Discard</span>
						<span class="text-[10px] font-bold font-mono text-emerald-400">{discardPile.length} cards</span>
					</div>
				</div>
			{/if}

		</div>

		<!-- Center Area: Players Row & Table Pile -->
		<div class="flex-grow flex flex-col relative overflow-hidden">
			
			<!-- Top Row: Player status cards -->
			<div class="players-row flex justify-center items-center w-full z-10 gap-6">
				<!-- Auto Play Toggle -->
				<button 
					onclick={() => isAutoPlay = !isAutoPlay} 
					class="px-3.5 py-2 rounded-xl text-xs font-bold font-mono tracking-wider transition-all duration-300 border flex items-center gap-1.5 shadow-md cursor-pointer {isAutoPlay ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-slate-800/40 text-slate-400 border-slate-700/30 hover:bg-slate-700/20'}"
				>
					<span class="w-1.5 h-1.5 rounded-full {isAutoPlay ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
					AUTO: {isAutoPlay ? 'ON' : 'OFF'}
				</button>

				{#each players as player, idx}
					{@const isActive = activePlayerIdx === idx && !trickWinnerId}
					<div class="player-box transition-all duration-300 {isActive ? 'active-turn' : ''} {player.isDone ? 'escaped' : ''}">
						<div class="player-avatar" style="background-color: {player.color}">
							{player.id === 'human' ? 'U' : (player.id === 'cpu1' ? 'C1' : 'C2')}
						</div>
						<div class="player-info">
							<span class="player-name flex items-center gap-1.5">
								{player.name}
								{#if player.isDone}
									<span class="text-[10px] text-emerald-400 font-bold font-mono">✓ ESCAPED</span>
								{:else if player.isSkitgubbe}
									<span class="text-[10px] text-red-500 font-bold font-mono">💀 LOOSER</span>
								{/if}
							</span>
							<span class="player-stats">
								Cards: <span class="text-white font-bold">{player.hand.length}</span>
								{#if phase === 1}
									<br/>Reserve: <span class="text-amber-400 font-bold">{player.reserveStack.length}</span>
								{/if}
							</span>
						</div>
						{#if isActive && player.id !== 'human' && !player.isDone && !player.isSkitgubbe}
							<button 
								onclick={() => playCpuTurn(true)} 
								class="debug-play-btn ml-auto px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 active:scale-95 text-[10px] font-bold text-slate-950 shadow transition-all duration-200 border border-slate-700/30"
								title="Force CPU Move (Bypass delay)"
							>
								⚡ FORCE
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Main play field (Table) -->
			<main class="board-game-zone flex-grow w-full flex justify-center items-center relative max-w-5xl mx-auto overflow-visible px-4">
				
				<!-- Ornate felt inner circle rim -->
				<div class="absolute inset-0 rounded-full border border-emerald-900/10 pointer-events-none opacity-20 my-12"></div>
				
				{#if gameWinner}
					<!-- Game Won overlay -->
					<div class="absolute inset-0 bg-emerald-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center rounded-2xl gap-4">
						<span class="text-yellow-400 text-4xl font-extrabold animate-bounce">Congratulations!</span>
						<span class="text-white text-2xl font-medium">{gameWinner} escapes first and wins!</span>
						<button onclick={initializeGame} class="lay-cards-btn px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide mt-2">
							Play Again
						</button>
					</div>
				{:else if skitgubbe}
					<!-- Skitgubbe Loss overlay -->
					<div class="absolute inset-0 bg-red-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center rounded-2xl gap-4">
						<span class="text-red-500 text-4xl font-extrabold animate-pulse">Skitgubbe!</span>
						<span class="text-white text-2xl font-medium">{skitgubbe} is the loser!</span>
						<button onclick={initializeGame} class="lay-cards-btn px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide mt-2">
							Play Again
						</button>
					</div>
				{:else if trickWinnerId}
					<!-- Phase 1 Trick Resolution splash overlay -->
					{@const winner = players.find(p => p.id === trickWinnerId)}
					<div class="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-2xl gap-2 shadow-2xl border border-emerald-800/20">
						<span class="text-yellow-400 text-3xl font-extrabold animate-bounce tracking-tight">Trick Won!</span>
						<span class="text-white text-lg font-medium">{winner?.name} takes the trick cards</span>
						<span class="text-slate-400 text-xs font-mono">Setting up next trick...</span>
					</div>
				{:else if isCpuThinking}
					<div class="absolute top-6 px-4 py-2 rounded-full glass-panel text-yellow-300 text-xs font-medium tracking-wide flex items-center gap-2 border border-yellow-500/20 z-20 shadow-lg">
						<span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping"></span>
						{players[activePlayerIdx]?.name} is choosing their card...
					</div>
				{/if}

				<!-- Cards currently in play -->
				{#if phase === 1}
					<!-- Phase 1 Layout: Groups of played cards arranged side-by-side -->
					<div class="table-pile-container flex items-center justify-center overflow-visible">
						{#each tablePile as batch, idx}
							{@const playerId = tablePilePlayers[idx]}
							{@const player = players.find(p => p.id === playerId)}
							<div class="flex flex-col items-center gap-2" transition:fade>
								<span class="text-xs font-bold font-mono text-slate-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
									{player?.name}
								</span>
								<div class="semi-stacked-pile">
									{#each batch as card}
										<div class="card cursor-default relative">
											<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
												<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
													<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
													
													<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
													<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<g transform="rotate(180 62.5 87.5)">
														<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
														<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													</g>
												</svg>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}

						{#if tablePile.length === 0}
							<div class="text-emerald-700/50 font-mono text-sm uppercase tracking-widest text-center">
								Trick lead starts here
							</div>
						{/if}
					</div>
				{:else}
					<!-- Phase 2 Layout: Horizontally fanned out sequential play batches -->
					<div class="table-pile-container-phase2 flex items-center justify-center flex-wrap max-w-4xl overflow-visible">
						{#each tablePile as batch, batchIdx}
							{@const playerId = tablePilePlayers[batchIdx]}
							{@const player = players.find(p => p.id === playerId)}
							<div class="flex flex-col items-center" transition:fade>
								<span class="text-[10px] font-bold font-mono text-slate-400 mb-1">
									{player?.name}
								</span>
								<div class="semi-stacked-pile p-1 bg-emerald-950/20 border border-emerald-900/30 rounded-lg shadow-inner">
									{#each batch as card}
										<div class="card cursor-default relative">
											<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
												<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
													<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
													
													<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
													<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<g transform="rotate(180 62.5 87.5)">
														<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
														<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													</g>
												</svg>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}

						{#if tablePile.length === 0}
							<div class="text-emerald-700/50 font-mono text-sm uppercase tracking-widest text-center">
								Table is empty. Lead play!
							</div>
						{/if}
					</div>
				{/if}

			</main>

		</div>

		<!-- Right Sidebar: Scrollable Game Logs Panel -->
		<div class="right-sidebar flex flex-col p-3 flex-shrink-0 z-10">
			<span class="logs-title mb-2 flex items-center gap-1.5">
				<span>📜 Logs</span>
				<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
			</span>
			<div class="logs-panel flex-grow rounded-xl overflow-y-auto p-3 flex flex-col gap-2 shadow-inner border border-slate-700/30">
				{#each logs as log}
					<div class="text-[10px] break-words">
						{log}
					</div>
				{/each}
			</div>
		</div>

	</div>

	<!-- Bottom Area: Actions & Player Hand -->
	<footer class="game-footer w-full flex flex-col items-center gap-4 relative z-10 pb-4">
		
		<!-- Buttons actions panel -->
		<div class="action-buttons-panel w-[80vw] max-w-5xl flex justify-between px-2 relative overflow-visible items-center">
			
			<!-- Left side status indicators -->
			<div class="text-xs font-mono text-slate-300">
				{#if isHumanTurn}
					<span class="text-green-400 font-bold">● YOUR TURN</span>
				{:else if trickWinnerId}
					<span class="text-slate-400">Trick Resolving...</span>
				{:else}
					<span class="text-yellow-400">CPU's Turn...</span>
				{/if}
			</div>

			<!-- Right side trigger buttons -->
			<div class="flex gap-3">
				{#if phase === 2 && isHumanTurn && tablePile.length > 0}
					<button
						onclick={handlePickUpClick}
						class="pick-up-btn font-bold tracking-wide transition-all duration-300 active:scale-95 cursor-pointer"
					>
						PICK UP BATCH
					</button>
				{/if}
				{#if isStroValid}
					<button 
						onclick={handleSprinkleClick}
						class="lay-cards-btn bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold transition-all duration-300 active:scale-95 cursor-pointer shadow-lg border border-teal-500/20"
					>
						SPRINKLE ({selectedCardIds.length})
					</button>
				{:else if isHumanTurn && selectedCardIds.length > 0 && isSelectionValid}
					<button 
						onclick={handleLayCardsClick}
						class="lay-cards-btn font-bold tracking-wide shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer"
					>
						{#if phase === 1}
							PLAY CARD(S) ({selectedCardIds.length})
						{:else}
							LAY CARDS ({selectedCardIds.length})
						{/if}
					</button>
				{/if}
			</div>

		</div>

		<!-- Hand Container -->
		<div 
			bind:clientWidth={containerWidth}
			class="w-[80vw] max-w-5xl flex justify-center items-end relative overflow-visible pb-4"
			style="height: var(--hand-container-height);"
		>
			{#if humanHand.length > 0}
				{#each humanHand as card, i (card.id)}
					{@const xPosition = getCardX(i, handCount, activeSpreadIdx)}
					{@const isSelected = selectedCardIds.includes(card.id)}
					{@const isHovered = hoveredCardId === card.id}
					
					<div
						class="card absolute select-none"
						class:selected={isSelected}
						style={getCardStyle(card.id, i, isSelected, isHovered, xPosition)}
						onclick={() => handleCardClick(i, card.id)}
						onpointerenter={() => hoveredCardId = card.id}
						onpointerleave={() => { if (hoveredCardId === card.id) hoveredCardId = null; }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(i, card.id); }}
						role="button"
						tabindex="0"
						aria-label="{card.value} of {card.suitName}"
						in:drawTransition={{ duration: 500, targetX: xPosition }}
						out:fade={{ duration: 150 }}
					>
						<div class="w-full h-full relative" style="transform-style: preserve-3d;">
							
							<!-- Front of Card -->
							<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
								<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
									<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
									
									<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
									<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									
									<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									
									<g transform="rotate(180 62.5 87.5)">
										<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
										<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									</g>
								</svg>
							</div>
							
							<!-- Back of Card (for flip transition) -->
							<div class="card-back-red" style="backface-visibility: hidden; transform: rotateY(180deg);"></div>
						</div>
					</div>
				{/each}
			{:else}
				<div 
					transition:fade
					class="text-slate-400 text-sm font-medium bg-emerald-950/20 border border-emerald-800/30 px-6 py-3 rounded-2xl flex flex-col items-center gap-1.5 text-center mb-6"
				>
					<span>Your hand is empty</span>
				</div>
			{/if}
		</div>
	</footer>
</div>

<!-- Floating Action Button for Reset -->
<button
	id="reset-game-btn"
	onclick={initializeGame}
	class="reset-btn fixed z-30 flex items-center justify-center rounded-full glass-panel text-white hover:text-red-400 border border-slate-700/60 hover:border-red-500/30 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
	title="Reset Sandbox"
	aria-label="Reset game board"
>
	<svg 
		xmlns="http://www.w3.org/2000/svg" 
		class="h-5.5 w-5.5 transition-transform duration-500 group-hover:rotate-180" 
		fill="none" 
		viewBox="0 0 24 24" 
		stroke="currentColor" 
		stroke-width="2"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5M4 9h5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
	</svg>
</button>

<!-- Portrait Orientation Warning Overlay -->
<div class="portrait-warning">
	<div class="warning-content">
		<svg xmlns="http://www.w3.org/2000/svg" class="rotate-phone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
		<h2>Please Rotate Your Device</h2>
		<p>This sandbox is optimized for horizontal (landscape) layout. Turn your phone to start playing!</p>
	</div>
</div>
