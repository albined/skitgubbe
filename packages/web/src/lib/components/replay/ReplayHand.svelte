<script lang="ts">
	import { fade } from 'svelte/transition';
	import { CardFace } from '$lib';
	import type { Card } from 'shared';

	interface Props {
		cards: Card[];
		cardWidth: number;
		trumpSuit: string | null;
	}

	let { cards, cardWidth, trumpSuit }: Props = $props();

	let width = $state(0);

	// The room's hand spacing, without the lift and spread used for picking cards.
	const gap = $derived(
		cards.length > 1
			? Math.min(cardWidth * 0.64, Math.max(cardWidth, width - cardWidth) / (cards.length - 1))
			: 0
	);
</script>

<div
	bind:clientWidth={width}
	class="replay-hand relative w-[80vw] max-w-5xl"
	in:fade={{ duration: 180 }}
>
	{#each cards as card, i (card.id)}
		<div
			class="card replay-card"
			data-card-id={card.id}
			style:left={`calc(50% + ${(i - (cards.length - 1) / 2) * gap}px)`}
			style:z-index={i}
		>
			<CardFace
				{card}
				isTrump={!!trumpSuit && card.suitName === trumpSuit}
				class="shadow-md"
				style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
			/>
		</div>
	{/each}
</div>

<style>
	.replay-hand {
		height: calc(var(--card-height) + 6px);
		/* Keeps the cards' stacking inside, so the timeline's time bubble draws over them. */
		isolation: isolate;
	}

	.replay-card {
		position: absolute;
		bottom: 0;
		margin-left: calc(var(--card-width) / -2);
		cursor: default;
	}
</style>
