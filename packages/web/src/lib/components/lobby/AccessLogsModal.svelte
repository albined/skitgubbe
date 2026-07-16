<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { ApiAccessLog } from 'shared';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		accessLogs: ApiAccessLog[];
	}

	let { isOpen, onClose, accessLogs }: Props = $props();

	function normalizeTimestamp(timestamp: string): string {
		if (!timestamp) return timestamp;
		if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
			return timestamp.replace(' ', 'T') + 'Z';
		}
		return timestamp;
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.8)] w-full max-w-md flex-col gap-6 overflow-hidden p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				onclick={onClose}
				class="absolute top-4 right-4 z-10 cursor-pointer text-slate-400 transition-colors hover:text-white md:top-6 md:right-6"
				aria-label="Close logins"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<div class="px-10 text-center">
				<h2
					class="flex items-center justify-center gap-2 font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase"
				>
					Senaste inloggningarna
				</h2>
			</div>

			<div class="custom-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
				{#if accessLogs.length === 0}
					<p class="py-8 text-center text-sm font-medium text-slate-500">No access logs found.</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each accessLogs as log}
							<div class="modal-inner-glass flex flex-col gap-2 p-4">
								<div class="flex items-start justify-between gap-2">
									<span class="text-sm font-semibold text-slate-200"
										>{log.location_display || log.ip_address}</span
									>
									<span class="text-xs whitespace-nowrap text-slate-400">
										{new Date(normalizeTimestamp(log.accessed_at)).toLocaleString()}
									</span>
								</div>
								<div class="flex items-center justify-between text-xs text-slate-400">
									<span title={log.device_info}>{log.device_display || log.device_info}</span>
									{#if log.location_display && log.location_display !== 'Lokalt nätverk'}
										<span class="font-mono text-[10px] text-slate-500" title="IP-adress"
											>{log.ip_address}</span
										>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
