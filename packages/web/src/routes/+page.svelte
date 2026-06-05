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
	const maxHandWidth = $derived(Math.max(125, containerWidth - 125));
	
	// Dragging states
	let isDragging = $state(false);
	let draggedCardIds = $state<string[]>([]);
	let primaryDragCardId = $state<string | null>(null);
	
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let dragCurrentX = $state(0);
	let dragCurrentY = $state(0);
	
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let isOverDiscardZone = $state(false);

	// Derived states for dynamic spread
	const activeSpreadCardId = $derived(hoveredCardId ?? focusedCardId);
	const activeSpreadIdx = $derived(
		activeSpreadCardId ? hand.findIndex(c => c.id === activeSpreadCardId) : -1
	);

	// DOM element bindings
	let discardPileEl = $state<HTMLElement | null>(null);

	// Track if drag has moved past threshold to distinguish click vs drag
	let hasMovedPastThreshold = $state(false);
	const DRAG_THRESHOLD = 6; // px

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
		draggedCardIds = [];
		primaryDragCardId = null;
		isDragging = false;
		isOverDiscardZone = false;
	}

	// Draw a card from deck to hand
	function drawCard() {
		if (deck.length === 0) return;
		const nextCard = deck[deck.length - 1];
		deck = deck.slice(0, deck.length - 1);
		hand = [...hand, nextCard];
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
	}

	// Setup initial game on mount
	onMount(() => {
		initializeGame();
		
		// Draw initial hand of 5 cards to make it look active right away!
		for (let i = 0; i < 5; i++) {
			drawCard();
		}
	});

	// Dragging Event Handlers
	function handlePointerDown(e: PointerEvent, card: Card) {
		if (e.button !== 0 && e.pointerType === 'mouse') return;

		// Focus the card (used for mobile and click-based spreading)
		focusedCardId = card.id;

		// Track drag start
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragCurrentX = e.clientX;
		dragCurrentY = e.clientY;
		hasMovedPastThreshold = false;
		isDragging = true;
		primaryDragCardId = card.id;

		// Decide dragging stack
		if (selectedCardIds.includes(card.id)) {
			draggedCardIds = [...selectedCardIds];
		} else {
			// If not selected, we clear other selections and drag just this card
			if (!e.shiftKey) {
				selectedCardIds = [card.id];
			} else {
				selectedCardIds = [...selectedCardIds, card.id];
			}
			draggedCardIds = [card.id];
		}

		// Set capture on target
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;

		dragCurrentX = e.clientX;
		dragCurrentY = e.clientY;

		const dx = dragCurrentX - dragStartX;
		const dy = dragCurrentY - dragStartY;

		if (!hasMovedPastThreshold && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
			hasMovedPastThreshold = true;
		}

		// Hit testing discard pile zone
		if (discardPileEl) {
			const rect = discardPileEl.getBoundingClientRect();
			isOverDiscardZone = (
				e.clientX >= rect.left &&
				e.clientX <= rect.right &&
				e.clientY >= rect.top &&
				e.clientY <= rect.bottom
			);
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (!isDragging) return;
		
		const target = e.currentTarget as HTMLElement;
		target.releasePointerCapture(e.pointerId);
		
		isDragging = false;

		if (!hasMovedPastThreshold) {
			// Click gesture
			toggleSelect(primaryDragCardId!);
		} else {
			// Drag release gesture
			if (isOverDiscardZone) {
				discardCards(draggedCardIds);
			}
		}

		draggedCardIds = [];
		primaryDragCardId = null;
		isOverDiscardZone = false;
	}

	// Click handler to collapse focused cards when clicking on background
	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.card')) {
			focusedCardId = null;
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
				const startX = -180 - targetX;
				const startY = -280;
				
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

		// Spacing compresses as total card count increases to ensure overlap within maxHandWidth
		const preferredSpacing = 80;
		const actualSpacing = Math.min(preferredSpacing, maxHandWidth / (total - 1));
		
		// Base centered coordinate
		let x = (index - (total - 1) / 2) * actualSpacing;

		// If a card is active (hovered or focused), shift surrounding cards out of the way
		if (activeIdx !== -1 && activeIdx !== index) {
			const diff = index - activeIdx;
			// spreadAmount is how much gap we create. Let's base it on the spacing.
			// When spacing is tight, we spread more to reveal the card.
			const spreadAmount = Math.max(35, 95 - actualSpacing);
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

	// Card Style Builder for Hand layout & Dragging
	function getCardStyle(
		cardId: string,
		index: number,
		isSelected: boolean,
		isDragged: boolean,
		isHovered: boolean,
		xPosition: number
	): string {
		if (isDragging && isDragged) {
			const dx = dragCurrentX - dragStartX;
			const dy = dragCurrentY - dragStartY;

			// Arrange selected cards as a nice stack behind the pointer
			const dragIdx = draggedCardIds.indexOf(cardId);
			const offsetX = dragIdx * 6;
			const offsetY = dragIdx * -6;

			// Lean in direction of horizontal speed
			const dragTilt = Math.min(Math.max(dx * 0.05, -12), 12);

			return `
				left: 50%;
				margin-left: -62.5px;
				transform: translate(${xPosition + dx + offsetX}px, ${dy + offsetY}px) rotate(${dragTilt}deg) scale(1.05);
				z-index: ${2000 + dragIdx};
				pointer-events: none;
			`;
		}

		// Vertical hand layout (non-dragged)
		let lift = 0;
		if (isSelected) lift -= 35;
		if (isHovered) lift -= 25;

		const zIndex = isHovered ? 1000 : (isSelected ? 500 : index);
		const scale = isHovered ? 1.08 : 1;

		return `
			left: 50%;
			margin-left: -62.5px;
			transform: translate(${xPosition}px, ${lift}px) scale(${scale});
			z-index: ${zIndex};
		`;
	}

	// Hand fanning angle helper
	const handCount = $derived(hand.length);
</script>

<svelte:window onclick={handleWindowClick} />

<div class="felt-overlay"></div>

<div class="relative w-screen h-screen flex flex-col justify-between p-6 select-none overflow-hidden">
	<!-- Top Bar / Header -->
	<header class="glass-panel rounded-2xl px-6 py-4 flex justify-between items-center z-10 mx-auto max-w-4xl w-full">
		<div class="flex items-center gap-4">
			<span class="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 via-amber-200 to-amber-400">
				Skitgubbe Sandbox
			</span>
			<span class="text-xs font-mono uppercase bg-emerald-950/60 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-800/40">
				Proof of Concept UI
			</span>
		</div>
		
		<div class="flex items-center gap-6 text-sm font-medium text-slate-300">
			<div>Deck: <span class="text-yellow-400 font-bold font-mono">{deck.length}</span></div>
			<div>Hand: <span class="text-yellow-400 font-bold font-mono">{hand.length}</span></div>
			<div>Discard: <span class="text-yellow-400 font-bold font-mono">{discardPile.length}</span></div>
		</div>
	</header>

	<!-- Board Game Zone -->
	<main class="flex-grow w-full flex justify-center items-center relative gap-20 max-w-5xl mx-auto">
		<!-- Ornate felt inner circle rim -->
		<div class="absolute inset-0 rounded-full gold-rim pointer-events-none opacity-30 my-8"></div>
		
		<!-- Draw Pile (Deck) -->
		<div class="flex flex-col items-center gap-3 z-10">
			<span class="text-xs uppercase font-mono tracking-widest text-slate-400">Draw Pile</span>
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
				<div class="w-[125px] h-[175px] rounded-12 border-2 border-dashed border-emerald-700/60 bg-emerald-950/20 flex flex-col justify-center items-center text-emerald-600/80 font-mono text-xs text-center p-3 select-none">
					<span>DECK<br/>EMPTY</span>
				</div>
			{/if}
			<span class="text-sm font-semibold text-slate-300 font-mono bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-800/20">{deck.length} cards</span>
		</div>

		<!-- Discard Pile -->
		<div class="flex flex-col items-center gap-3 z-10">
			<span class="text-xs uppercase font-mono tracking-widest text-slate-400">Discard Pile</span>
			<div 
				id="discard-pile-zone"
				bind:this={discardPileEl}
				class="w-[125px] h-[175px] rounded-12 relative transition-all duration-300 flex flex-col justify-center items-center text-center p-2 select-none border-2 border-dashed
					{isOverDiscardZone 
						? 'bg-emerald-900/50 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-105' 
						: 'bg-emerald-950/30 border-emerald-600/40'}"
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
			<span class="text-sm font-semibold text-slate-300 font-mono bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-800/20">{discardPile.length} cards</span>
		</div>
	</main>

	<!-- Footer / Hand / Controls Area -->
	<footer class="w-full flex flex-col items-center gap-6 relative z-10">
		<!-- Selection Status Prompt -->
		{#if selectedCardIds.length > 0}
			<div 
				transition:fade={{ duration: 150 }}
				class="glass-panel text-amber-300 px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 border border-amber-500/20 shadow-lg"
			>
				<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
				Selected: <span class="font-bold">{selectedCardIds.length}</span> card{selectedCardIds.length > 1 ? 's' : ''} — Drag them to Discard
			</div>
		{:else}
			<div class="text-slate-400 text-xs text-center max-w-sm leading-relaxed px-4 py-2 font-mono">
				Click to select multiple cards. Drag from hand to discard. Click deck to draw.
			</div>
		{/if}

		<!-- Hand Container -->
		<div 
			bind:clientWidth={containerWidth}
			class="w-[80vw] max-w-5xl h-[240px] flex justify-center items-end relative overflow-visible pb-4"
		>
			{#if hand.length > 0}
				{#each hand as card, i (card.id)}
					{@const xPosition = getCardX(i, handCount, activeSpreadIdx)}
					{@const isSelected = selectedCardIds.includes(card.id)}
					{@const isDragged = draggedCardIds.includes(card.id)}
					{@const isHovered = hoveredCardId === card.id}
					
					<div
						class="card absolute select-none"
						class:selected={isSelected}
						class:dragging={isDragged}
						style={getCardStyle(card.id, i, isSelected, isDragged, isHovered, xPosition)}
						onpointerdown={(e) => handlePointerDown(e, card)}
						onpointermove={handlePointerMove}
						onpointerup={handlePointerUp}
						onpointerenter={() => hoveredCardId = card.id}
						onpointerleave={() => { if (hoveredCardId === card.id) hoveredCardId = null; }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelect(card.id); }}
						role="button"
						tabindex="0"
						aria-label="{card.value} of {card.suitName}"
						in:drawTransition={{ duration: 500, targetX: xPosition }}
						out:fade={{ duration: 150 }}
						style:touch-action="none"
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
	class="fixed bottom-6 right-6 z-30 flex items-center justify-center p-3.5 rounded-full glass-panel text-white hover:text-red-400 border border-slate-700/60 hover:border-red-500/30 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group"
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
