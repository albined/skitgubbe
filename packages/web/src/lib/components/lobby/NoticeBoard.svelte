<script lang="ts">
	import { Spring } from 'svelte/motion';
	import { onMount } from 'svelte';
	import type { ApiCurrentSkitgubbe } from 'shared';
	import Avatar from '$lib/Avatar.svelte';
	import type { NoticeBoardAnchor } from './noticeBoard3D';

	interface Props {
		currentSkitgubbe: ApiCurrentSkitgubbe | null;
		onShowHistory: () => void;
		hiddenFor3D?: boolean;
		onAnchorChange?: (anchor: NoticeBoardAnchor) => void;
		targetWidth?: number;
		buttonWidth?: number;
		buttonTop?: number;
	}

	let {
		currentSkitgubbe,
		onShowHistory,
		hiddenFor3D = false,
		onAnchorChange,
		targetWidth,
		buttonWidth,
		buttonTop
	}: Props = $props();

	// 3D Swinging Notice Board state with user's tuned physics parameters
	const boardRotation = new Spring(0, {
		stiffness: 0.003,
		damping: 0.008
	});

	const tiltX = new Spring(0, { stiffness: 0.1, damping: 0.2 });
	const tiltY = new Spring(0, { stiffness: 0.1, damping: 0.2 });
	let boardElement: HTMLDivElement;

	// Cache bounding rect to prevent layout thrashing on mousemove
	let boardRect: DOMRect | null = null;

	function handleBoardMouseMove(event: MouseEvent) {
		if (hiddenFor3D) return;
		const target = event.currentTarget as HTMLElement;
		if (!target) return;
		if (!boardRect) {
			boardRect = target.getBoundingClientRect();
		}
		const x = event.clientX - boardRect.left;
		const y = event.clientY - boardRect.top;

		const normX = (x / boardRect.width) * 2 - 1;
		const normY = (y / boardRect.height) * 2 - 1;

		tiltX.target = -normY * 12; // Tilt up/down based on Y mouse pos
		tiltY.target = normX * 12; // Tilt left/right based on X mouse pos
	}

	function handleBoardMouseLeave() {
		if (hiddenFor3D) return;
		tiltX.target = 0;
		tiltY.target = 0;
		boardRect = null; // Clear cache on leave to handle resizing or layout shifts
	}

	let queueAnchorReport = () => {};

	onMount(() => {
		let animationFrame = 0;
		const reportAnchor = () => {
			animationFrame = 0;
			if (!boardElement) return;
			const bounds = boardElement.getBoundingClientRect();
			onAnchorChange?.({
				left: bounds.left,
				top: bounds.top,
				width: bounds.width,
				height: bounds.height,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
				buttonWidth: buttonWidth ?? (targetWidth ? Math.round(targetWidth / 0.64) : undefined),
				buttonTop
			});
		};
		queueAnchorReport = () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
			animationFrame = requestAnimationFrame(reportAnchor);
		};
		const resizeObserver = new ResizeObserver(queueAnchorReport);
		resizeObserver.observe(boardElement);
		window.addEventListener('resize', queueAnchorReport);
		window.addEventListener('orientationchange', queueAnchorReport);
		queueAnchorReport();

		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
			resizeObserver.disconnect();
			window.removeEventListener('resize', queueAnchorReport);
			window.removeEventListener('orientationchange', queueAnchorReport);
		};
	});

	$effect(() => {
		if (targetWidth !== undefined || buttonWidth !== undefined || buttonTop !== undefined) {
			queueAnchorReport();
		}
	});

	let pushTimeout: ReturnType<typeof setTimeout> | undefined;

	function pushBoard(event: MouseEvent | KeyboardEvent) {
		const target = event.currentTarget as HTMLElement;
		if (!target) return;
		const rect = boardRect || target.getBoundingClientRect();

		// Safe clientY lookup that falls back to the center of the board for keyboard triggers
		const clientY =
			'clientY' in event && (event as MouseEvent).clientY !== undefined
				? (event as MouseEvent).clientY
				: rect.top + rect.height / 2;

		const clickY = clientY - rect.top;

		// Calculate leverage: clicking lower down swings it harder
		const leverage = clickY / rect.height; // 0 to 1
		const force = -12 - leverage * 18; // ranges from -12 to -30 degrees (away from viewer)

		if (pushTimeout) clearTimeout(pushTimeout);

		// Apply a short impulse by setting a large target to build up backward velocity
		boardRotation.target = force * 4.5;

		pushTimeout = setTimeout(() => {
			boardRotation.target = 0;
		}, 60);
	}
</script>

<div class:hidden-for-3d={hiddenFor3D} class="notice-board-container">
	<div
		bind:this={boardElement}
		role="button"
		aria-label="Knuffa på Skitgubbe-skylten"
		tabindex="0"
		class="notice-board-3d"
		style="--tilt-x: {tiltX.current}deg; --tilt-y: {tiltY.current}deg; --swing-x: {boardRotation.current}deg;{targetWidth
			? ` --board-width: ${targetWidth}px;`
			: ''}"
		onmousemove={handleBoardMouseMove}
		onmouseleave={handleBoardMouseLeave}
		onclick={pushBoard}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				pushBoard(e);
			}
		}}
	>
		<!-- Rope Extension to the ceiling (optimized repeating WebP texture) -->
		<div class="rope-extension"></div>

		<!-- 3D Extrusion Layers (Optimized stack shifted back in Z-axis) -->
		<div class="board-layer board-layer-back"></div>
		<div class="board-layer board-layer-front"></div>

		<!-- Poster attached to the front of the board -->
		{#if currentSkitgubbe}
			<button
				onclick={(e) => {
					e.stopPropagation();
					onShowHistory();
				}}
				class="skitgubbe-poster on-board group focus:outline-none"
			>
				<div
					class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]"
				>
					<div
						class="relative flex aspect-square w-[48%] items-center justify-center overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/85 p-0 transition-all duration-300 group-hover:border-slate-500"
					>
						<Avatar
							avatarConfig={currentSkitgubbe.avatar_config}
							fallbackColor={currentSkitgubbe.color}
							fallbackName={currentSkitgubbe.name}
							class="h-full w-full rounded-2xl"
						/>

						<div class="absolute inset-0 bg-radial from-white/5 to-transparent"></div>
					</div>
					<span class="skitgubbe-poster-name max-w-[85%] truncate leading-none select-none">
						{currentSkitgubbe.name}
					</span>
				</div>
			</button>
		{:else}
			<button
				onclick={(e) => {
					e.stopPropagation();
					onShowHistory();
				}}
				class="skitgubbe-poster on-board default-poster group focus:outline-none"
			>
				<div
					class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]"
				>
					<div
						class="border-slate-650 relative flex aspect-square w-[48%] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-slate-950/50 p-0"
					>
						<span class="text-4xl font-black text-slate-500/60 select-none">?</span>
					</div>
					<span
						class="skitgubbe-poster-name text-slate-450! max-w-[85%] truncate leading-none select-none"
					>
						Vem blir nästa?
					</span>
				</div>
			</button>
		{/if}
	</div>
</div>

<style>
	/* 3D Swinging Notice Board Display */
	.notice-board-container {
		perspective: 1200px;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.notice-board-container.hidden-for-3d {
		visibility: hidden;
		pointer-events: none;
	}

	.notice-board-3d {
		position: relative;
		width: var(--board-width, 100%);
		max-width: var(--board-width, 680px);
		aspect-ratio: 1 / 1;
		transform-style: preserve-3d;
		transform-origin: 50% -35%;
		transform: translateY(var(--translate-y, -20%))
			rotateX(calc(var(--tilt-x, 0deg) + var(--swing-x, 0deg))) rotateY(var(--tilt-y, 0deg))
			rotateZ(0deg);
		cursor: pointer;
		background-color: transparent;
		border: none;
		padding: 0;
		display: block;
		user-select: none;
		container-type: inline-size;
		touch-action: none;
		will-change: transform;
		backface-visibility: hidden;
	}

	/* Optimized repeating rope texture reaching the ceiling */
	.rope-extension {
		position: absolute;
		bottom: 99%;
		left: 0;
		width: 100%;
		height: 100vh;
		pointer-events: none;
		transform: translateZ(-4px); /* place behind front board layer to mask connections */
		transform-style: preserve-3d;
		background-image: url('/notice_board_rope.webp');
		background-size: 100% auto;
		background-repeat: repeat-y;
		background-position: center bottom;
	}

	.board-layer {
		position: absolute;
		inset: 0;
		background-image: url('/notice_board.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		pointer-events: none;
		will-change: transform;
		backface-visibility: hidden;
	}

	/* Layered sandwich depth optimized for drawing overhead */
	.board-layer-back {
		transform: translateZ(-16px);
		filter: brightness(0.4) contrast(1.1);
	}
	.board-layer-front {
		transform: translateZ(0px);
		filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.5));
	}

	.skitgubbe-poster.on-board {
		position: absolute;
		top: 69%;
		left: 50%;
		width: 36%;
		aspect-ratio: 1792 / 2400;
		background-image: url('/skitgubbe_transparent.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		background-color: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		transform: translate3d(-50%, -50%, 2px) rotate(-1.5deg);
		transform-style: preserve-3d;
		transition:
			transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
			filter 0.2s ease;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
		will-change: transform;
		backface-visibility: hidden;
	}

	.skitgubbe-poster.on-board.default-poster {
		transform: translate3d(-50%, -50%, 2px) rotate(1deg);
	}

	.skitgubbe-poster.on-board:hover {
		transform: translate3d(-50%, -50%, 8px) rotate(-2.5deg) scale(1.05);
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5));
	}

	.skitgubbe-poster.on-board.default-poster:hover {
		transform: translate3d(-50%, -50%, 8px) rotate(2deg) scale(1.05);
	}

	.skitgubbe-poster-name {
		font-family: 'Nanum Brush Script', cursive;
		font-size: 8.5cqw; /* Auto-scales based on board size */
		font-weight: 700;
		color: #2e2315; /* Dark ink on parchment */
		margin-top: 0.35rem;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	/* Adjust padding & notice board sizing on short screens for landscape mobile layout */
	@media (max-height: 540px) {
		.notice-board-3d {
			max-width: min(var(--board-width, 500px), 500px);
			--translate-y: -30%;
		}
	}

	@media (max-height: 420px) {
		.notice-board-3d {
			max-width: min(var(--board-width, 380px), 380px);
			--translate-y: -35%;
		}
	}

	@media (max-height: 340px) {
		.notice-board-3d {
			max-width: min(var(--board-width, 300px), 300px);
			--translate-y: -50%;
		}
	}
</style>
