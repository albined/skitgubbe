<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		skitgubbeHistory: any[];
	}

	let { isOpen, onClose, skitgubbeHistory }: Props = $props();

	function normalizeTimestamp(timestamp: string): string {
		if (!timestamp) return timestamp;
		if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
			return timestamp.replace(' ', 'T') + 'Z';
		}
		return timestamp;
	}

	function timeAgo(timestamp: string) {
		if (!timestamp) return '';
		const seconds = Math.floor(
			(new Date().getTime() - new Date(normalizeTimestamp(timestamp)).getTime()) / 1000
		);
		let interval = Math.floor(seconds / 31536000);
		if (interval >= 1) return interval + ' år sedan';
		interval = Math.floor(seconds / 2592000);
		if (interval >= 1) return interval + ' mån sedan';
		interval = Math.floor(seconds / 86400);
		if (interval >= 1) return interval + ' dagar sedan';
		interval = Math.floor(seconds / 3600);
		if (interval >= 1) return interval + 'h sedan';
		interval = Math.floor(seconds / 60);
		if (interval >= 1) return interval + 'm sedan';
		return 'just nu';
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
				aria-label="Close log"
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
					Skitgubbe Log
				</h2>
			</div>

			<div class="custom-scrollbar flex-1 overflow-y-auto pr-1">
				{#if skitgubbeHistory.length === 0}
					<p class="py-8 text-center text-sm font-medium text-slate-500">
						No history entries found.
					</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each skitgubbeHistory as entry}
							<div
								class="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/50 p-3 transition-colors hover:bg-slate-900/80"
							>
								<div class="flex items-center gap-3">
									<Avatar
										avatarConfig={entry.profile_avatar}
										fallbackColor={entry.profile_color}
										fallbackName={entry.profile_name}
										class="h-10 w-10 rounded-xl"
									/>
									<div class="flex flex-col">
										<span class="text-sm font-bold text-slate-200">{entry.profile_name}</span>
									</div>
								</div>
								<span class="text-[11px] font-medium text-slate-400">
									{timeAgo(entry.acquired_at)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
