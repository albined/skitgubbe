<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import { CardFace, CardBack } from '$lib';
	import { realCards, type SanitizedPlayer } from 'shared';

	interface Props {
		skitgubbe: SanitizedPlayer;
		endGameStage: 'none' | 'paused' | 'table_clear' | 'cards_reveal' | 'poster_slam';
		onPosterLanded: () => void;
		reducedMotion: boolean;
	}

	let { skitgubbe, endGameStage, onPosterLanded, reducedMotion }: Props = $props();

	let fanElement = $state<HTMLDivElement>();
	let start = $state({ x: 0, y: -200 });
	let posterReady = $state(false);
	let dustVisible = $state(false);
	let dustPlayer: (HTMLElement & { play: () => void }) | undefined;

	const revealing = $derived(endGameStage === 'cards_reveal' || endGameStage === 'poster_slam');

	// Measure both ends in viewport coordinates. The board is offset by the
	// sidebar, player row and footer, so viewport fractions are not accurate.
	$effect(() => {
		const fan = fanElement;
		const playerId = skitgubbe.id;
		if (!fan || !revealing || reducedMotion) return;
		const avatar = document.querySelector(
			`[data-player-id="${CSS.escape(playerId)}"] .avatar-container`
		);
		const measure = () => {
			if (!avatar) return;
			const from = avatar.getBoundingClientRect();
			const to = fan.getBoundingClientRect();
			start = {
				x: from.left + from.width / 2 - (to.left + to.width / 2),
				y: from.top + from.height / 2 - (to.top + to.height / 2)
			};
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(fan);
		if (avatar) observer.observe(avatar);
		window.addEventListener('resize', measure);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

	// Mount and decode the artwork during the opening pause, before the slam.
	function preparePoster(node: HTMLImageElement) {
		let disposed = false;
		void node
			.decode()
			.catch(() => {})
			.then(() => {
				if (!disposed) posterReady = true;
			});
		return {
			destroy: () => {
				disposed = true;
			}
		};
	}

	function posterLanded(event: AnimationEvent) {
		if (event.target !== event.currentTarget || reducedMotion) return;
		onPosterLanded();
		// A slow or failed dust load must not produce a delayed impact puff.
		if (dustPlayer) {
			dustVisible = true;
			dustPlayer.play();
		}
	}

	$effect(() => {
		if (endGameStage === 'none') {
			dustVisible = false;
			dustPlayer = undefined;
			posterReady = false;
		}
	});
</script>

{#if endGameStage !== 'none'}
	<!-- Skitgubbe Loss overlay -->
	<div
		class="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center p-6"
		aria-hidden={!revealing}
	>
		<div class="flex h-full w-full flex-row items-center justify-center gap-10 md:gap-16">
			<!-- Left Column: Wanted Poster (Slam Animation) -->
			<div class="flex flex-1 justify-end">
				<div class="poster-slot relative w-[290px] shrink-0">
					<!-- Prepared early; dust is outside the transformed/shadowed poster. -->
					<div class="dust-effect" style:opacity={dustVisible ? 1 : 0} aria-hidden="true">
						{#if !reducedMotion}
							<dotlottie-player
								src="/dust1.lottie"
								loop="false"
								style="display: block; width: 100%; height: 100%;"
								onready={(e: Event) => {
									dustPlayer = e.currentTarget as HTMLElement & { play: () => void };
								}}
								oncomplete={() => (dustVisible = false)}
								onerror={() => {
									dustPlayer = undefined;
									dustVisible = false;
								}}
							></dotlottie-player>
						{/if}
					</div>
					<div
						class="poster-motion relative flex w-full flex-col items-center select-none"
						class:poster-slam-active={endGameStage === 'poster_slam' && posterReady}
						onanimationend={posterLanded}
					>
						<div class="skitgubbe-poster pointer-events-none w-full" style="z-index: 10;">
							<img
								src="/skitgubbe_transparent.webp"
								alt=""
								width="1792"
								height="2400"
								class="block h-auto w-full"
								use:preparePoster
							/>
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
				</div>
			</div>

			<!-- Right Column: Fanned Cards (Fly one-by-one) -->
			<div class="flex flex-1 flex-col items-start justify-center">
				<div
					bind:this={fanElement}
					class="relative flex items-center justify-center"
					style="height: calc(var(--card-height) * 1.15); width: 320px;"
				>
					<!-- The server unmasks the skitgubbe's hand once the game ends -->
					{#if revealing}
						{#each realCards(skitgubbe.hand) as card, idx (card.id)}
							{@const N = skitgubbe.hand.length}
							{@const spacing = Math.min(32, 220 / N)}
							{@const xOffset = (idx - (N - 1) / 2) * spacing}
							{@const yOffset = Math.abs(idx - (N - 1) / 2) * 2}
							{@const rot = (idx - (N - 1) / 2) * 4}

							<div
								class="card-reveal-fly absolute select-none"
								style="
								--start-x: {start.x}px;
								--start-y: {start.y}px;
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
					{/if}
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
		animation: card-fly-in 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) both;
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
		animation: inner-card-flip 0.6s ease-in-out both;
	}

	/* Wanted Poster slam animation */
	@keyframes poster-slam {
		0% {
			transform: scale(4) rotate(-10deg);
			opacity: 0;
		}
		80% {
			transform: scale(1.05) rotate(2deg);
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 1;
		}
	}
	.poster-slot {
		margin-top: 100px;
	}
	.poster-motion {
		opacity: 0;
	}
	.dust-effect {
		position: absolute;
		width: 680px;
		height: 680px;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.poster-slam-active {
		animation: poster-slam 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) both;
	}
	@media (prefers-reduced-motion: reduce) {
		.card-reveal-fly {
			animation: none;
			opacity: 1;
			transform: translate(var(--card-x-offset), var(--card-y-offset)) rotate(var(--card-rot));
		}
		.inner-card-flip-active {
			animation: none;
		}
		.poster-slam-active {
			animation: none;
			opacity: 1;
		}
		.dust-effect {
			display: none;
		}
	}
</style>
