<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { ReplayState } from '$lib/state/replayState.svelte';

	interface Props {
		replayState: ReplayState;
	}

	let { replayState }: Props = $props();

	let list = $state<HTMLDivElement | null>(null);

	// The latest entry at or before the current move; moves that wrote nothing keep the one before.
	const current = $derived.by(() => {
		let k = -1;
		for (const entry of replayState.logEntries) {
			if (entry.k > replayState.pos) break;
			k = entry.k;
		}
		return k;
	});

	$effect(() => {
		const k = current;
		if (!list) return;
		const el = list.querySelector<HTMLElement>(`[data-k="${k}"]`);
		if (el) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2;
	});
</script>

{#if replayState.showLog}
	<div
		transition:fade={{ duration: 150 }}
		class="premium-modal-container absolute top-16 right-4 z-40 flex max-h-[calc(var(--app-height)*0.7)] w-80 flex-col gap-2.5 p-4"
	>
		<div class="modal-header-glass flex items-center justify-between pb-2">
			<span class="logs-title">
				<span class="font-mono text-xs font-bold tracking-wider text-amber-400 uppercase">Log</span>
			</span>
			<button
				onclick={() => (replayState.showLog = false)}
				class="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-white"
				aria-label="Close logs"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
		<div
			bind:this={list}
			class="logs-panel custom-scrollbar premium-inner-box relative flex flex-grow flex-col gap-2.5 overflow-y-auto p-3"
		>
			{#each replayState.logEntries as entry (entry.k)}
				<button
					type="button"
					data-k={entry.k}
					class="log-entry log-step text-[11px] break-words"
					class:highlight={entry.k === current}
					class:later={entry.k > replayState.pos}
					onclick={() => replayState.seek(entry.k)}
				>
					{#each entry.lines as line, i (i)}
						<span class="block">{line}</span>
					{/each}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.log-step {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-left: -9px;
		padding: 0 0 0 7px;
		border: 0;
		border-left: 2px solid transparent;
		background: none;
		text-align: left;
		cursor: pointer;
	}

	.log-step:not(.highlight):hover {
		color: #cbd5e1 !important;
	}

	.log-step.highlight {
		border-left-color: #e3ba5a;
	}

	.log-step.later {
		opacity: 0.38;
	}

	/* Responsive adjustments for short horizontal screens (landscape mobile) */
	@media (max-height: 640px) {
		.premium-modal-container {
			max-height: calc(var(--app-height) * 0.82) !important;
			top: 12px !important;
			gap: 6px !important;
			padding: 10px !important;
		}

		.logs-panel {
			padding: 8px !important;
			gap: 6px !important;
		}
	}
</style>
