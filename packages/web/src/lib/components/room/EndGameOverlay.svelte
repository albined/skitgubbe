<script lang="ts">
	import { fade } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';
	import { CardFace, CardBack } from '$lib';
	import type { Player } from 'shared';

	interface Props {
		skitgubbe: Player;
		endGameStage: 'none' | 'paused' | 'table_clear' | 'cards_reveal' | 'poster_slam';
		showDustEffect: boolean;
		loserAvatarPos: { x: number; y: number } | null;
		innerWidth: number;
		innerHeight: number;
	}

	let { skitgubbe, endGameStage, showDustEffect, loserAvatarPos, innerWidth, innerHeight }: Props =
		$props();
</script>

{#if endGameStage !== 'none' && endGameStage !== 'paused' && endGameStage !== 'table_clear'}
	<!-- Skitgubbe Loss overlay -->
	<div
		class="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 transition-opacity duration-1000"
		in:fade={{ duration: 600 }}
	>
		<div class="flex h-full w-full flex-row items-center justify-center gap-10 md:gap-16">
			<!-- Left Column: Wanted Poster (Slam Animation) -->
			<div class="flex flex-1 justify-end">
				{#if endGameStage === 'poster_slam'}
					<div class="poster-slam-active relative flex w-[290px] flex-col items-center select-none">
						<!-- Dust Particle Effect (Behind Poster) -->
						{#if showDustEffect}
							<div
								class="pointer-events-none absolute z-0"
								style="width: 680px; height: 680px; top: 50%; left: 50%; transform: translate(-50%, -50%);"
							>
								<!-- Dust 1: Normal Orientation -->
								<div class="absolute inset-0" style="transform: translate(0, 0px) rotate(0deg);">
									<dotlottie-player
										src="/dust1.lottie"
										autoplay
										style="display: block; width: 100%; height: 100%;"
										onready={(e: any) => {
											console.log('Lottie Player 1: Ready');
											e.currentTarget.play();
										}}
										onload={(e: any) => {
											console.log('Lottie Player 1: Loaded /dust1.lottie');
											e.currentTarget.play();
										}}
										onerror={(e: any) => {
											console.error('Lottie Player 1: Error loading /dust1.lottie', e);
										}}
									></dotlottie-player>
								</div>
							</div>
						{/if}

						<div class="skitgubbe-poster pointer-events-none w-full" style="z-index: 10;">
							<div
								class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]"
							>
								<div
									class="relative flex aspect-square w-[48%] items-center justify-center overflow-hidden rounded-2xl border border-[#2e2315]/20 bg-[#1e1b18] p-0"
								>
									<Avatar
										avatarConfig={skitgubbe.avatarConfig}
										fallbackColor="#1e1b18"
										fallbackName={skitgubbe.name}
										class="h-full w-full rounded-2xl"
									/>
									<div class="absolute inset-0 bg-radial from-white/5 to-transparent"></div>
								</div>
								<span class="skitgubbe-poster-name max-w-[85%] truncate leading-none">
									{skitgubbe.name}
								</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Right Column: Fanned Cards (Fly one-by-one) -->
			<div class="flex flex-1 flex-col items-start justify-center">
				<div
					class="relative flex items-center justify-center"
					style="height: calc(var(--card-height) * 1.15); width: 320px;"
				>
					{#each skitgubbe.hand as card, idx (card.id)}
						{@const N = skitgubbe.hand.length}
						{@const spacing = Math.min(32, 220 / N)}
						{@const xOffset = (idx - (N - 1) / 2) * spacing}
						{@const yOffset = Math.abs(idx - (N - 1) / 2) * 2}
						{@const rot = (idx - (N - 1) / 2) * 4}
						{@const startX = loserAvatarPos ? loserAvatarPos.x - innerWidth * 0.75 : 0}
						{@const startY = loserAvatarPos ? loserAvatarPos.y - innerHeight * 0.5 : -200}

						<div
							class="card-reveal-fly absolute select-none"
							style="
								--start-x: {startX}px;
								--start-y: {startY}px;
								--card-x-offset: {xOffset}px;
								--card-y-offset: {yOffset}px;
								--card-rot: {rot}deg;
								animation-delay: {idx * 250}ms;
								left: 50%;
								margin-left: calc(-1 * var(--card-width) / 2);
							"
						>
							<div
								class="inner-card-flip-active relative"
								style="
									width: var(--card-width);
									height: var(--card-height);
									transform-style: preserve-3d;
									animation-delay: {idx * 250}ms;
								"
							>
								<!-- Front of Card -->
								<CardFace
									{card}
									isTrump={false}
									class="shadow-lg"
									style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
								/>

								<!-- Back of Card -->
								<CardBack
									style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
								/>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Skitgubbe Poster Display */
	.skitgubbe-poster {
		position: relative;
		width: 100%;
		max-width: 290px;
		aspect-ratio: 1792 / 2400;
		background-image: url('/skitgubbe_transparent.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.6));
		background-color: transparent;
		border: none;
		padding: 0;
		display: block;
	}

	.skitgubbe-poster-name {
		font-family: 'Nanum Brush Script', cursive;
		font-size: 2.2rem;
		font-weight: 700;
		color: #2e2315; /* dark ink color on parchment */
		margin-top: 0.35rem;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	/* Card fly-in animation */
	@keyframes card-fly-in {
		0% {
			transform: translate(var(--start-x), var(--start-y)) scale(0.2);
			opacity: 0;
		}
		100% {
			transform: translate(var(--card-x-offset), var(--card-y-offset)) scale(1)
				rotate(var(--card-rot));
			opacity: 1;
		}
	}
	.card-reveal-fly {
		animation: card-fly-in 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
		transform-style: preserve-3d;
	}

	/* Inner card flip animation (from face down to face up) */
	@keyframes inner-card-flip {
		0% {
			transform: rotateY(180deg);
		}
		30% {
			transform: rotateY(180deg);
		}
		100% {
			transform: rotateY(0deg);
		}
	}
	.inner-card-flip-active {
		animation: inner-card-flip 0.6s ease-in-out forwards;
	}

	/* Wanted Poster slam animation */
	@keyframes poster-slam {
		0% {
			transform: scale(4) rotate(-10deg);
			opacity: 0;
			filter: drop-shadow(0 100px 50px rgba(0, 0, 0, 0.9));
		}
		80% {
			transform: scale(1.05) rotate(2deg);
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 1;
			filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.8));
		}
	}
	.poster-slam-active {
		animation: poster-slam 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
		margin-top: 100px;
	}
</style>
