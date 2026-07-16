<script lang="ts">
	import { CardFace, CardBack } from '$lib';
	import type { RoomState } from '$lib/state/roomState.svelte';
	import type { CardDragState } from '$lib/state/cardDragState.svelte';

	interface Props {
		roomState: RoomState;
		dragState: CardDragState;
	}

	let { roomState, dragState }: Props = $props();

	// Read dimensions from roomState
	let cardWidth = $derived(roomState.cardWidth);
	let maxHandWidth = $derived(roomState.maxHandWidth);

	function getCardX(index: number, total: number, activeIdx: number): number {
		if (total === 0) return 0;
		if (total === 1) return 0;

		const preferredSpacing = cardWidth * 0.64;

		if (total > 15 && roomState.fanCenterIdx !== -1) {
			const L = Math.max(0, roomState.fanCenterIdx - 2);
			const R = Math.min(total - 1, roomState.fanCenterIdx + 2);

			let N_wide = 0;
			for (let i = 0; i < total - 1; i++) {
				if (i >= L && i <= R) {
					N_wide++;
				}
			}
			const N_compressed = total - 1 - N_wide;

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

			let currentX = 0;
			const positions = [];
			for (let i = 0; i < total; i++) {
				positions.push(currentX);
				if (i < total - 1) {
					const isWideGap = i >= L && i <= R;
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

	function getCardStyle(
		cardId: string,
		index: number,
		isSelected: boolean,
		isHovered: boolean,
		xPosition: number
	): string {
		let lift = 0;
		if (isSelected) lift -= cardWidth * 0.28;
		if (isHovered) lift -= cardWidth * 0.2;

		const zIndex = isHovered ? 1000 : index;
		const scale = isHovered ? 1.08 : 1;

		return `
			--x-pos: ${xPosition}px;
			--lift: ${lift}px;
			--scale: ${scale};
			--z-index: ${zIndex};
		`;
	}
</script>

<div
	bind:clientWidth={roomState.containerWidth}
	class="relative flex w-[80vw] max-w-5xl items-end justify-center overflow-visible pb-4"
	style="height: var(--hand-container-height);"
>
	{#if roomState.humanHand.length > 0}
		{#each roomState.humanHand as card, i (card.id)}
			{@const xPosition = getCardX(i, roomState.handCount, roomState.activeSpreadIdx)}
			{@const isSelected = roomState.selectedCardIds.includes(card.id)}
			{@const isHovered = roomState.hoveredCardId === card.id}
			{@const isPlayable = roomState.checkDropValidity([card]) !== null}

			<div
				class="card hand-card absolute select-none"
				class:selected={isSelected}
				class:non-playable={(roomState.isHumanTurn || roomState.anyCardPlayable) && !isPlayable}
				class:playing-fly-up={roomState.transitions.animatingPlayCardIds.includes(card.id)}
				style="{getCardStyle(
					card.id,
					i,
					isSelected,
					isHovered,
					xPosition
				)}{dragState.cardsBeingDragged.includes(card.id)
					? `; transform: translate(calc(var(--x-pos) + ${dragState.dragOffset.x}px), calc(var(--lift) + ${dragState.dragOffset.y}px)) scale(1.05) !important; z-index: 10000 !important; transition: none !important;`
					: dragState.pendingPlayOffsets[card.id]
						? `; transform: translate(calc(var(--x-pos) + ${dragState.pendingPlayOffsets[card.id].x}px), calc(var(--lift) + ${dragState.pendingPlayOffsets[card.id].y}px)) scale(1.05) !important; z-index: 10000 !important; transition: none !important;`
						: ''}"
				onclick={(e) => dragState.handleCardElementClick(e, i, card.id)}
				onpointerdown={(e) => dragState.handleCardPointerDown(e, card.id, i)}
				ondragstart={(e) => e.preventDefault()}
				onpointerenter={() => (roomState.hoveredCardId = card.id)}
				onpointerleave={() => {
					if (roomState.hoveredCardId === card.id) roomState.hoveredCardId = null;
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') roomState.handleCardClick(i, card.id);
				}}
				role="button"
				tabindex={roomState.isReplaying ? -1 : 0}
				aria-label="{card.value} of {card.suitName}"
				data-card-id={card.id}
				in:roomState.transitions.cardIn|global={{ id: card.id, playerId: roomState.playerId, card }}
				out:roomState.transitions.cardOut|global={{ id: card.id }}
			>
				<div
					class="relative h-full w-full"
					style="transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1); transition-delay: {roomState.isReplaying
						? '0ms'
						: i * 100 + 'ms'}; transform: rotateY({roomState.isReplaying ? 180 : 0}deg);"
				>
					<!-- Front of Card -->
					<CardFace
						{card}
						isTrump={!!roomState.trumpSuit && card.suitName === roomState.trumpSuit}
						class="shadow-md"
						style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
					/>

					<!-- Back of Card (for flip transition) -->
					<CardBack
						style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
					/>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.hand-card.playing-fly-up {
		transform: translate(var(--x-pos), calc(var(--app-height) * -0.45)) scale(1.1) rotate(0deg) !important;
		opacity: 0 !important;
		transition:
			transform 0.4s cubic-bezier(0.25, 1, 0.5, 1),
			opacity 0.4s ease !important;
		z-index: 10000 !important;
		pointer-events: none;
	}

	.hand-card {
		position: absolute;
		bottom: 0;
		left: 50%;
		margin-left: calc(-1 * var(--card-width) / 2);
		transform: translate(var(--x-pos), var(--lift)) scale(var(--scale));
		z-index: var(--z-index);
		touch-action: none;
		transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
	}
</style>
