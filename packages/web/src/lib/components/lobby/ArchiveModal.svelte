<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		archivedGames: any[];
		restoreGame: (roomId: string) => void;
	}

	let { isOpen, onClose, archivedGames, restoreGame }: Props = $props();

	function normalizeTimestamp(timestamp: string): string {
		if (!timestamp) return timestamp;
		if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
			return timestamp.replace(' ', 'T') + 'Z';
		}
		return timestamp;
	}

	function formatTime(timestamp: string) {
		if (!timestamp) return '';
		const d = new Date(normalizeTimestamp(timestamp));
		return (
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
			' ' +
			d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
		);
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.9)] w-full max-w-2xl flex-col gap-6 overflow-hidden p-6 md:p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b border-white/5 pb-4">
				<div class="flex items-center gap-2">
					<h2 class="font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase">
						Arkiverade spel
					</h2>
				</div>
				<button
					onclick={onClose}
					class="cursor-pointer text-slate-400 transition-colors hover:text-white"
					aria-label="Close archive"
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
			</div>

			<!-- Modal Content -->
			<div class="flex-1 overflow-y-auto pr-1">
				{#if archivedGames.length === 0}
					<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<p class="text-slate-450 text-sm">Du har inga arkiverade spel.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each archivedGames as g}
							<div
								class="modal-inner-glass flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-all hover:border-white/10"
							>
								<div class="min-w-0 flex-1">
									<div class="mb-1.5 flex items-center gap-2">
										<span
											class="max-w-[180px] truncate font-semibold text-slate-200 sm:max-w-[280px]"
										>
											{g.name || g.id}
										</span>
										<span
											class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase {g.status ===
											'ended'
												? 'border border-red-500/20 bg-red-500/10 text-red-400'
												: 'border border-amber-500/20 bg-amber-500/10 text-amber-400'}"
										>
											{g.status === 'ended' ? 'Finished' : 'Archived'}
										</span>
									</div>

									{#if g.status === 'ended' && g.loser_name}
										<div class="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
											<span>Skitgubbe:</span>
											<span
												class="flex items-center gap-1 font-bold"
												style="color: {g.loser_color || '#ef4444'}"
											>
												<Avatar
													avatarConfig={g.loser_avatar_config}
													fallbackColor={g.loser_color || '#ef4444'}
													fallbackName={g.loser_name}
													class="h-3.5 w-3.5 rounded-full"
												/>
												{g.loser_name}
											</span>
										</div>
									{/if}

									<div class="mt-1.5 font-mono text-[10px] text-slate-500">
										Last played {formatTime(g.updated_at)}
									</div>
								</div>

								<div class="flex items-center gap-2">
									{#if g.status === 'ended'}
										<a
											href={`/room/${g.id}`}
											class="text-slate-350 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold transition-all hover:text-white active:scale-95"
										>
											View Board
										</a>
									{:else}
										<button
											onclick={() => restoreGame(g.id)}
											class="text-emerald-450 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-emerald-500/20 hover:text-white active:scale-95"
										>
											Restore
										</button>
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
