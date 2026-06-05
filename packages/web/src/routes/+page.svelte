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

	interface DiscardedCard extends Card {
		rotation: number;
		offsetX: number;
		offsetY: number;
	}

	// Svelte 5 Runes for reactive state
	let deck = $state<Card[]>([]);
	let hand = $state<Card[]>([]);
	let discardPile = $state<DiscardedCard[]>([]);
	let selectedCardIds = $state<string[]>([]);
	let containerWidth = $state(800);
	let innerHeight = $state(800);
	const cardWidth = $derived(innerHeight < 540 ? 75 : 125);
	const maxHandWidth = $derived(Math.max(cardWidth, containerWidth - cardWidth));
	
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let fanCenterIdx = $state(-1);

	// Derived states for dynamic spread
	const activeSpreadCardId = $derived(hoveredCardId ?? focusedCardId);
	const activeSpreadIdx = $derived(
		activeSpreadCardId ? hand.findIndex(c => c.id === activeSpreadCardId) : -1
	);

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

	// Initialize / Reset
	function initializeGame() {
		deck = shuffle(createDeck());
		hand = [];
		discardPile = [];
		selectedCardIds = [];
		fanCenterIdx = -1;
	}

	// Draw a card from deck to hand
	function drawCard() {
		if (deck.length === 0) return;
		const nextCard = deck[deck.length - 1];
		deck = deck.slice(0, deck.length - 1);
		hand = [...hand, nextCard];
		fanCenterIdx = -1;
	}

	// Toggle selection of a card in hand
	function toggleSelect(cardId: string) {
		if (selectedCardIds.includes(cardId)) {
			selectedCardIds = selectedCardIds.filter(id => id !== cardId);
		} else {
			selectedCardIds = [...selectedCardIds, cardId];
		}
	}

	// Discard specified cards
	function discardCards(cardIds: string[]) {
		const cardsToDiscard = hand.filter(c => cardIds.includes(c.id));
		const discarded = cardsToDiscard.map(card => ({
			...card,
			rotation: Math.random() * 30 - 15,
			offsetX: Math.random() * 16 - 8,
			offsetY: Math.random() * 16 - 8
		}));

		discardPile = [...discardPile, ...discarded];
		hand = hand.filter(c => !cardIds.includes(c.id));
		selectedCardIds = selectedCardIds.filter(id => !cardIds.includes(id));
		fanCenterIdx = -1;
	}

	// Setup initial game on mount
	onMount(() => {
		initializeGame();
		
		// Draw initial hand of 5 cards to make it look active right away!
		for (let i = 0; i < 5; i++) {
			drawCard();
		}
	});

	// Select handler that handles the >15 cards fanning/select region flow
	function handleCardClick(idx: number, cardId: string) {
		if (hand.length > 15) {
			if (fanCenterIdx === -1) {
				fanCenterIdx = idx;
			} else {
				const L = Math.max(0, fanCenterIdx - 2);
				const R = Math.min(hand.length - 1, fanCenterIdx + 2);
				
				if (hand.length >= 20 && (idx === L || idx === R)) {
					// 20+ cards: clicking the ends of fanned region centers on them instead of selecting
					fanCenterIdx = idx;
				} else if (Math.abs(idx - fanCenterIdx) <= 2) {
					// Select card if within range (or inside center 3 if 30+ cards)
					toggleSelect(cardId);
				} else {
					// Clicked outside fanned region: shift center
					fanCenterIdx = idx;
				}
			}
		} else {
			toggleSelect(cardId);
		}
	}

	// Click handler to collapse focused cards when clicking on background
	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.card')) {
			focusedCardId = null;
			fanCenterIdx = -1;
		}
	}

	// Calculate 3D Deck Shadow Style based on count
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

	// Custom flip & fly in transition for drawing cards
	function drawTransition(node: HTMLElement, { duration = 600, targetX = 0 }) {
		return {
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				// Card flies in from deck area (roughly top-left/center relative to hand container)
				// The start position of fly-in should be fixed around the draw pile:
				const isSmall = innerHeight < 540;
				const startX = (isSmall ? -110 : -180) - targetX;
				const startY = isSmall ? -160 : -280;
				
				const x = targetX + (1 - eased) * startX;
				const y = (1 - eased) * startY;
				const scale = 0.55 + eased * 0.45;
				
				// Spin and 3D card flip
				const rotate = (1 - eased) * -35;
				const rotateY = (1 - eased) * 180;
				return `
					transform: translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg) rotateY(${rotateY}deg) !important;
					opacity: ${t};
				`;
			}
		};
	}

	// Spacing and dynamic offset math for horizontal arrangement with hover/focus spreading
	function getCardX(index: number, total: number, activeIdx: number): number {
		if (total === 0) return 0;
		if (total === 1) return 0;

		const preferredSpacing = innerHeight < 540 ? 50 : 80;

		if (total > 15 && fanCenterIdx !== -1) {
			const L = Math.max(0, fanCenterIdx - 2);
			const R = Math.min(total - 1, fanCenterIdx + 2);
			
			// Wide gaps are between L and R, AND the gap after R (to prevent R from being covered by R+1)
			let N_wide = 0;
			for (let i = 0; i < total - 1; i++) {
				if (i >= L && i <= R) {
					N_wide++;
				}
			}
			const N_compressed = (total - 1) - N_wide;

			const minCompressedSpacing = innerHeight < 540 ? 8 : 12;
			const preferredFannedSpacing = innerHeight < 540 ? 65 : 105;
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

		// Spacing compresses as total card count increases to ensure overlap within maxHandWidth
		const actualSpacing = Math.min(preferredSpacing, maxHandWidth / (total - 1));
		
		// Base centered coordinate
		let x = (index - (total - 1) / 2) * actualSpacing;

		// If a card is active (hovered or focused), shift surrounding cards out of the way
		if (activeIdx !== -1 && activeIdx !== index) {
			const diff = index - activeIdx;
			// spreadAmount is how much gap we create. Let's base it on the spacing.
			// When spacing is tight, we spread more to reveal the card.
			const spreadAmount = Math.max(cardWidth * 0.3, cardWidth * 0.76 - actualSpacing);
			const decayFactor = 0.55;

			if (diff < 0) {
				// Card is to the left of the hovered card: shift left
				x -= spreadAmount * Math.pow(decayFactor, Math.abs(diff) - 1);
			} else {
				// Card is to the right of the hovered card: shift right
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
		// Vertical hand layout
		let lift = 0;
		const isSmall = innerHeight < 540;
		if (isSelected) lift -= isSmall ? 20 : 35;
		if (isHovered) lift -= isSmall ? 15 : 25;

		const zIndex = isHovered ? 1000 : index;
		const scale = isHovered ? 1.08 : 1;

		return `
			left: 50%;
			margin-left: calc(-1 * var(--card-width) / 2);
			transform: translate(${xPosition}px, ${lift}px) scale(${scale});
			z-index: ${zIndex};
		`;
	}

	// Hand fanning angle helper
	const handCount = $derived(hand.length);
</script>

<svelte:window bind:innerHeight={innerHeight} onclick={handleWindowClick} />

<div class="felt-overlay"></div>

<div class="game-layout relative w-screen h-screen flex flex-col justify-between select-none overflow-hidden">
	<!-- Board Game Zone -->
	<main class="board-game-zone flex-grow w-full flex justify-center items-center relative max-w-5xl mx-auto">
		<!-- Draw Pile (Deck) -->
		<div class="pile-container flex flex-col items-center z-10">
			<span class="pile-label text-xs uppercase font-mono tracking-widest text-slate-400">Draw Pile</span>
			{#if deck.length > 0}
				<button 
					id="draw-pile-btn"
					class="relative card card-container transition-transform active:scale-95"
					style={deckShadowStyle}
					onclick={drawCard}
					aria-label="Draw a card"
				>
					<div class="card-back"></div>
				</button>
			{:else}
				<div class="w-[var(--card-width)] h-[var(--card-height)] rounded-12 border-2 border-dashed border-emerald-700/60 bg-emerald-950/20 flex flex-col justify-center items-center text-emerald-600/80 font-mono text-xs text-center p-3 select-none">
					<span>DECK<br/>EMPTY</span>
				</div>
			{/if}
			<span class="pile-badge text-sm font-semibold text-slate-300 font-mono bg-emerald-950/40 rounded-full border border-emerald-800/20">{deck.length} cards</span>
		</div>

		<!-- Discard Pile -->
		<div class="pile-container flex flex-col items-center z-10">
			<span class="pile-label text-xs uppercase font-mono tracking-widest text-slate-400">Discard Pile</span>
			<div 
				id="discard-pile-zone"
				class="w-[var(--card-width)] h-[var(--card-height)] rounded-12 relative flex flex-col justify-center items-center text-center p-2 select-none border-2 border-dashed bg-emerald-950/30 border-emerald-600/40"
			>
				{#if discardPile.length > 0}
					<!-- Render stacked discarded cards with random offsets -->
					{#each discardPile.slice(-15) as dcard, idx (dcard.id)}
						<div 
							class="absolute card cursor-default"
							style="
								transform: rotate({dcard.rotation}deg) translate({dcard.offsetX}px, {dcard.offsetY}px);
								z-index: {idx};
								transition: none;
							"
						>
							<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
								<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
									<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
									
									<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={dcard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{dcard.value}</text>
									<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={dcard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{dcard.suit}</text>
									
									<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={dcard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{dcard.suit}</text>
									
									<g transform="rotate(180 62.5 87.5)">
										<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={dcard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{dcard.value}</text>
										<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={dcard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{dcard.suit}</text>
									</g>
									
									<text x="111" y="22" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="middle">SK</text>
									<g transform="rotate(180 62.5 87.5)">
										<text x="111" y="22" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="middle">SK</text>
									</g>
								</svg>
							</div>
						</div>
					{/each}
				{:else}
					<span class="text-xs font-mono text-emerald-600/80">DROP<br/>HERE</span>
				{/if}
			</div>
			<span class="pile-badge text-sm font-semibold text-slate-300 font-mono bg-emerald-950/40 rounded-full border border-emerald-800/20">{discardPile.length} cards</span>
		</div>
	</main>

	<!-- Footer / Hand / Controls Area -->
	<footer class="game-footer w-full flex flex-col items-center relative z-10">
		<!-- Active Selection Actions Bar -->
		<div class="w-[80vw] max-w-5xl flex justify-end px-2 h-12 relative overflow-visible items-center">
			{#if selectedCardIds.length > 0}
				<button 
					transition:fade={{ duration: 150 }}
					onclick={() => discardCards(selectedCardIds)}
					class="lay-cards-btn px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide shadow-2xl transition-all duration-300 active:scale-95 z-20 cursor-pointer"
				>
					LAY CARDS ({selectedCardIds.length})
				</button>
			{/if}
		</div>

		<!-- Hand Container -->
		<div 
			bind:clientWidth={containerWidth}
			class="w-[80vw] max-w-5xl flex justify-center items-end relative overflow-visible pb-4"
			style="height: var(--hand-container-height);"
		>
			{#if hand.length > 0}
				{#each hand as card, i (card.id)}
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
							<!-- Front of Card (Static Vector SVG for performance and no-squishing aspect ratio constraint) -->
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
									
									<text x="111" y="22" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="middle">SK</text>
									<g transform="rotate(180 62.5 87.5)">
										<text x="111" y="22" font-family="monospace" font-size="8" fill="#94a3b8" text-anchor="middle">SK</text>
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
					<button 
						onclick={drawCard} 
						class="text-xs text-yellow-400 font-bold hover:underline font-mono"
					>
						[DRAW A CARD]
					</button>
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
