<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { RoomState } from '$lib/state/roomState.svelte';

	interface Props {
		roomState: RoomState;
	}

	let { roomState }: Props = $props();
</script>

{#if roomState.showLogs}
	<div
		transition:fade={{ duration: 150 }}
		class="premium-modal-container absolute top-16 right-4 z-30 flex max-h-[calc(var(--app-height)*0.7)] w-80 flex-col gap-2.5 p-4"
	>
		<div class="modal-header-glass flex items-center justify-between pb-2">
			<span class="logs-title flex items-center gap-2">
				<span class="font-mono text-xs font-bold tracking-wider text-amber-400 uppercase">Log</span>
				<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></span>
			</span>
			<button
				onclick={() => (roomState.showLogs = false)}
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
			class="logs-panel custom-scrollbar premium-inner-box flex flex-grow flex-col gap-2.5 overflow-y-auto p-3"
		>
			{#if roomState.gameState}
				{#each roomState.gameState.logs as log}
					<div class="log-entry text-[11px] break-words">
						{log}
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
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
