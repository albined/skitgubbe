<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import type { ReplayState } from '$lib/state/replayState.svelte';

	interface Props {
		replayState: ReplayState;
	}

	let { replayState }: Props = $props();

	let rail = $state<HTMLDivElement | null>(null);
	let railWidth = $state(0);
	let scrubbing = $state(false);
	let pointerX = 0;
	let frame = 0;

	const span = $derived(Math.max(1, replayState.last - replayState.first));
	const at = (k: number) => ((k - replayState.first) / span) * 100;

	// Players who got out close together get their markers side by side, the later one on its spot.
	const marks = $derived.by(() => {
		const sorted = [...replayState.escapes].sort((a, b) => a.k - b.k);
		const xs = sorted.map(({ k }) => (at(k) / 100) * railWidth);
		for (let i = xs.length - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - 20);
		for (let i = 0; i < xs.length; i++) xs[i] = Math.max(xs[i], i > 0 ? xs[i - 1] + 20 : 0);
		return sorted.map((mark, i) => ({ ...mark, x: xs[i] }));
	});

	function seekToPointer() {
		frame = 0;
		if (!rail) return;
		const r = rail.getBoundingClientRect();
		const t = Math.max(0, Math.min(1, (pointerX - r.left) / r.width));
		void replayState.go(Math.round(replayState.first + t * span));
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button > 0 || (e.target as HTMLElement).closest('.rail-mark')) return;
		replayState.stop();
		rail?.setPointerCapture(e.pointerId);
		scrubbing = true;
		pointerX = e.clientX;
		seekToPointer();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!scrubbing) return;
		pointerX = e.clientX;
		if (!frame) frame = requestAnimationFrame(seekToPointer);
	}

	function endScrub() {
		scrubbing = false;
	}
</script>

<div class="timeline">
	<div class="timeline-buttons">
		<button
			type="button"
			class="gold-trimmed-btn timeline-btn"
			disabled={replayState.pos <= replayState.first}
			onclick={() => replayState.step(-1)}
			aria-label="Förra draget"
		>
			<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<rect x="2" y="2.5" width="2.2" height="11" />
				<path d="M14 2.5v11L5.5 8z" />
			</svg>
		</button>
		<button
			type="button"
			class="gold-trimmed-btn timeline-btn"
			onclick={() => replayState.togglePlay()}
			aria-label={replayState.playing ? 'Pausa' : 'Spela'}
		>
			<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				{#if replayState.playing}
					<rect x="3" y="2.5" width="3.4" height="11" />
					<rect x="9.6" y="2.5" width="3.4" height="11" />
				{:else}
					<path d="M3.5 2v12L14 8z" />
				{/if}
			</svg>
		</button>
		<button
			type="button"
			class="gold-trimmed-btn timeline-btn"
			disabled={replayState.pos >= replayState.last}
			onclick={() => replayState.step(1)}
			aria-label="Nästa drag"
		>
			<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
				<rect x="11.8" y="2.5" width="2.2" height="11" />
				<path d="M2 2.5v11L10.5 8z" />
			</svg>
		</button>
	</div>

	<div
		bind:this={rail}
		bind:clientWidth={railWidth}
		class="rail"
		role="slider"
		tabindex="0"
		aria-label="Tidslinje"
		aria-valuemin={0}
		aria-valuemax={span}
		aria-valuenow={replayState.pos - replayState.first}
		aria-valuetext={replayState.whenAt(replayState.pos)}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={endScrub}
		onpointercancel={endScrub}
	>
		<span class="rail-line"></span>
		<span class="rail-fill" style:width={`${at(replayState.pos)}%`}></span>
		{#if replayState.phaseTwoAt > replayState.first}
			<span class="rail-phase" style:left={`${at(replayState.phaseTwoAt)}%`}></span>
		{/if}
		{#each marks as { k, person, x } (person.id)}
			<button
				type="button"
				class="rail-mark"
				style:left={`${x}px`}
				aria-label={`${person.name} tog sig ut`}
				onclick={() => replayState.seek(k)}
			>
				<Avatar
					avatarConfig={person.avatar_config}
					fallbackColor={person.color}
					fallbackName={person.name}
					class="h-full w-full rounded-full"
				/>
			</button>
		{/each}
		<span class="rail-thumb" style:left={`${at(replayState.pos)}%`}></span>
		{#if scrubbing}
			<span class="rail-when" style:left={`${at(replayState.pos)}%`}>
				{replayState.whenAt(replayState.pos)}
			</span>
		{/if}
	</div>

	<button
		type="button"
		class="gold-trimmed-btn timeline-speed"
		onclick={() => replayState.cycleSpeed()}
		aria-label="Hastighet"
	>
		{replayState.speed}×
	</button>
</div>

<style>
	.timeline {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: 52px;
		padding: 2px 16px 6px;
	}

	.timeline-buttons {
		display: flex;
		flex: none;
		gap: 6px;
	}

	.timeline-btn {
		width: 40px;
		height: 40px;
	}

	.timeline-btn svg {
		width: 15px;
		height: 15px;
	}

	.timeline-speed {
		flex: none;
		width: 48px;
		height: 40px;
		font:
			700 13px 'Outfit',
			sans-serif;
		font-variant-numeric: tabular-nums;
	}

	.rail {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
		height: 40px;
		cursor: pointer;
		touch-action: none;
	}

	.rail:focus-visible {
		outline: 1.5px solid #ffe89e;
		outline-offset: 2px;
	}

	.rail-line,
	.rail-fill {
		position: absolute;
		left: 0;
		top: 28px;
		height: 2px;
	}

	.rail-line {
		right: 0;
		background: rgba(255, 255, 255, 0.14);
	}

	.rail-fill {
		background: linear-gradient(90deg, #875c12, #e3ba5a 55%, #ffe89e);
	}

	/* Where phase 2 starts */
	.rail-phase {
		position: absolute;
		top: 23px;
		width: 2px;
		height: 12px;
		margin-left: -1px;
		background: rgba(255, 232, 158, 0.75);
	}

	.rail-mark {
		position: absolute;
		top: 2px;
		width: 18px;
		height: 18px;
		margin-left: -9px;
		padding: 0;
		border: 1.5px dashed #10b981;
		border-radius: 50%;
		background: none;
		cursor: pointer;
		transition: transform 0.15s;
	}

	.rail-mark:hover {
		z-index: 2;
		transform: scale(1.18);
	}

	.rail-thumb {
		position: absolute;
		top: 29px;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		background: linear-gradient(
			135deg,
			#ffe89e 0%,
			#e3ba5a 25%,
			#b88728 45%,
			#fceeac 55%,
			#d19f33 70%,
			#875c12 100%
		);
		box-shadow:
			0 0 0 1.5px #1a140c,
			0 1px 4px rgba(0, 0, 0, 0.6);
		transform: rotate(45deg);
		pointer-events: none;
	}

	/* When the move under the thumb was made, shown while dragging */
	.rail-when {
		position: absolute;
		bottom: calc(100% - 10px);
		padding: 3px 9px;
		border: 1px solid;
		border-image: linear-gradient(to bottom right, #ffe89e, #b88728, #4a3b22, #1a1a1a) 1;
		background: rgba(20, 18, 15, 0.96);
		color: #ffe89e;
		font:
			600 11px/1.3 'Outfit',
			sans-serif;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		transform: translateX(-50%);
		pointer-events: none;
	}

	@media (max-height: 540px) {
		.timeline {
			height: 40px;
			padding: 0 12px 4px;
		}

		.timeline-btn {
			width: 32px;
			height: 32px;
		}

		.timeline-btn svg {
			width: 14px;
			height: 14px;
		}

		.timeline-speed {
			width: 40px;
			height: 32px;
			font-size: 12px;
		}

		.rail {
			height: 36px;
		}

		.rail-line,
		.rail-fill {
			top: 25px;
		}

		.rail-phase {
			top: 20px;
		}

		.rail-mark {
			top: 1px;
		}

		.rail-thumb {
			top: 26px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rail-mark {
			transition: none;
		}
	}
</style>
