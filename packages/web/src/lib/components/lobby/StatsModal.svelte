<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		profiles: any[];
		allPlayersStats: any[];
		activeProfileId: string;
		selectedStatsProfileId: string;
		selectedPlayerBreakdown: any;
		onSelectStatsProfile: (id: string) => void;
		statsTab: 'all' | 'personal';
		onTabChange: (tab: 'all' | 'personal') => void;
	}

	let {
		isOpen,
		onClose,
		profiles,
		allPlayersStats,
		activeProfileId,
		selectedStatsProfileId,
		selectedPlayerBreakdown,
		onSelectStatsProfile,
		statsTab,
		onTabChange
	}: Props = $props();

	let selectedStatsProfile = $derived(profiles.find((p) => p.id === selectedStatsProfileId));
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.9)] w-full max-w-4xl flex-col gap-6 overflow-hidden p-6 md:p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				onclick={onClose}
				class="absolute top-4 right-4 z-10 cursor-pointer text-slate-400 transition-colors hover:text-white md:top-6 md:right-6"
				aria-label="Close stats"
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

			<!-- Modal Header -->
			<div
				class="flex flex-col items-center justify-between gap-4 border-b border-white/5 pr-10 pb-4 sm:flex-row sm:pr-12"
			>
				<div class="text-center sm:text-left">
					<h2
						class="flex items-center gap-2 font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase"
					>
						Topplista & Stats
					</h2>
				</div>

				<!-- Tabs -->
				<div class="premium-tab-container">
					<button
						type="button"
						onclick={() => onTabChange('all')}
						class="premium-tab-btn {statsTab === 'all'
							? 'premium-tab-btn-active'
							: 'premium-tab-btn-inactive'}"
					>
						Alla spelare
					</button>
					<button
						type="button"
						onclick={() => onTabChange('personal')}
						class="premium-tab-btn {statsTab === 'personal'
							? 'premium-tab-btn-active'
							: 'premium-tab-btn-inactive'}"
					>
						Personliga resultat
					</button>
				</div>
			</div>

			<!-- Modal Content (Scrollable Container) -->
			<div class="custom-scrollbar flex-1 overflow-y-auto pr-1">
				{#if statsTab === 'all'}
					<!-- All Players Table -->
					<div class="premium-table-container w-full overflow-x-auto">
						<table class="premium-table">
							<thead>
								<tr class="stats-table-header">
									<th class="px-4 py-3">Spelare</th>
									<th class="px-4 py-3 text-center">Spel</th>
									<th class="px-4 py-3 text-center text-red-400">Skitgubbe</th>
									<th class="px-4 py-3 text-center text-pink-400">Sweetgubbe</th>
									<th class="px-4 py-3 text-center text-blue-400">Trumfman</th>
									<th class="px-4 py-3 text-center text-amber-400">Förstoppad</th>
								</tr>
							</thead>
							<tbody class="">
								{#each allPlayersStats as row}
									<tr
										class="stats-table-row cursor-pointer {row.id === activeProfileId
											? 'bg-amber-500/5'
											: ''}"
										onclick={() => {
											onTabChange('personal');
											onSelectStatsProfile(row.id);
										}}
									>
										<td class="flex items-center gap-3 px-4 py-3 font-semibold">
											<Avatar
												avatarConfig={row.avatar_config}
												fallbackColor={row.color}
												fallbackName={row.name}
												class="h-8 w-8 rounded-lg"
											/>
											<span>{row.name}</span>
										</td>
										<td class="px-4 py-3 text-center font-bold text-slate-100">{row.games}</td>
										<td class="px-4 py-3 text-center font-bold text-red-400/90">{row.skitgubbe}</td>
										<td class="px-4 py-3 text-center font-bold text-pink-400/90"
											>{row.sweetgubbe}</td
										>
										<td class="px-4 py-3 text-center font-bold text-blue-400/90">{row.trumfman}</td>
										<td class="px-4 py-3 text-center font-bold text-amber-400/90">
											{row.constipated}
											<span class="text-[10px] font-medium text-amber-500/60"
												>(Mega: {row.mega_constipated})</span
											>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<!-- Personal Breakdown -->
					<div class="flex flex-col gap-6">
						<!-- Profile Selector Dropdown inside Breakdown -->
						<div
							class="modal-inner-glass flex flex-col items-center justify-between gap-4 p-4 sm:flex-row"
						>
							<div class="flex items-center gap-3">
								{#if selectedStatsProfile}
									<Avatar
										avatarConfig={selectedStatsProfile.avatar_config}
										fallbackColor={selectedStatsProfile.color}
										fallbackName={selectedStatsProfile.name}
										class="h-12 w-12 rounded-xl"
									/>
									<div class="flex flex-col">
										<span class="text-lg font-bold text-slate-100">{selectedStatsProfile.name}</span
										>
									</div>
								{/if}
							</div>

							<select
								value={selectedStatsProfileId}
								onchange={(e) => onSelectStatsProfile((e.target as HTMLSelectElement).value)}
								class="modal-inner-glass cursor-pointer px-4 py-2 text-sm font-semibold text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
							>
								{#each profiles as p}
									<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</div>

						<!-- Personal Breakdown Table -->
						{#if selectedPlayerBreakdown}
							<div class="premium-table-container w-full overflow-x-auto">
								<table class="premium-table">
									<thead>
										<tr class="stats-table-header">
											<th class="px-4 py-3">Tidsfönster</th>
											<th class="px-4 py-3 text-center">Spel</th>
											<th class="px-4 py-3 text-center text-red-400">Skitgubbe</th>
											<th class="px-4 py-3 text-center text-pink-400">Sweetgubbe</th>
											<th class="px-4 py-3 text-center text-blue-400">Trumfman</th>
											<th class="px-4 py-3 text-center text-amber-400">Förstoppad</th>
										</tr>
									</thead>
									<tbody class="">
										<!-- Last 10 games row -->
										<tr class="transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-slate-300">Senaste 10</td>
											<td class="px-4 py-3 text-center font-bold text-slate-100"
												>{selectedPlayerBreakdown.last10.games}</td
											>
											<td class="px-4 py-3 text-center font-bold text-red-400/90"
												>{selectedPlayerBreakdown.last10.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-pink-400/90"
												>{selectedPlayerBreakdown.last10.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-blue-400/90"
												>{selectedPlayerBreakdown.last10.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last10.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.last10.mega_constipated})</span
												>
											</td>
										</tr>
										<!-- Last 50 games row -->
										<tr class="transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-slate-300">Senaste 50</td>
											<td class="px-4 py-3 text-center font-bold text-slate-100"
												>{selectedPlayerBreakdown.last50.games}</td
											>
											<td class="px-4 py-3 text-center font-bold text-red-400/90"
												>{selectedPlayerBreakdown.last50.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-pink-400/90"
												>{selectedPlayerBreakdown.last50.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-blue-400/90"
												>{selectedPlayerBreakdown.last50.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last50.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.last50.mega_constipated})</span
												>
											</td>
										</tr>
										<!-- All-time games row -->
										<tr class="bg-white/5 transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-amber-400">All-Time</td>
											<td class="px-4 py-3 text-center font-extrabold text-slate-100"
												>{selectedPlayerBreakdown.all.games}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-red-400/90"
												>{selectedPlayerBreakdown.all.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-pink-400/90"
												>{selectedPlayerBreakdown.all.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-blue-400/90"
												>{selectedPlayerBreakdown.all.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-amber-400/90">
												{selectedPlayerBreakdown.all.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.all.mega_constipated})</span
												>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
