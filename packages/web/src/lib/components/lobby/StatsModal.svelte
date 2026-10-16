<script lang="ts">
	import type { ApiProfile, ApiPlayerStats, ApiPlayerStatsBreakdown, ApiStatsCounts } from 'shared';
	import Avatar from '$lib/Avatar.svelte';
	import LobbySheet from './LobbySheet.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		profiles: ApiProfile[];
		allPlayersStats: ApiPlayerStats[];
		activeProfileId: string;
		selectedStatsProfileId: string;
		selectedPlayerBreakdown: ApiPlayerStatsBreakdown | null;
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

	const TABS = [
		['all', 'Alla spelare'],
		['personal', 'Personligt']
	] as const;
</script>

<!-- Förstoppad, with the mega count hanging to the right so the column stays aligned. -->
{#snippet constipated(count: number, mega: number)}
	<span class="num">
		{count}{#if mega > 0}<span class="mega">({mega} mega)</span>{/if}
	</span>
{/snippet}

{#snippet headings(first: string, withChevron = false)}
	<thead>
		<tr>
			<th scope="col">
				{#if first}{first}{:else}<span class="sr-only">Period</span>{/if}
			</th>
			<th scope="col" class="n">Spel</th>
			<th scope="col" class="n sg">Skit&shy;gubbe</th>
			<th scope="col" class="n sw">Sweet&shy;gubbe</th>
			<th scope="col" class="n tm">Trumf&shy;man</th>
			<th scope="col" class="n fo">För&shy;stoppad</th>
			{#if withChevron}<th aria-label="Öppna"></th>{/if}
		</tr>
	</thead>
{/snippet}

{#snippet period(label: string, c: ApiStatsCounts, total = false)}
	<tr class:is-total={total}>
		<th scope="row">{label}</th>
		<td class="n">{c.games}</td>
		<td class="n sg">{c.skitgubbe}</td>
		<td class="n sw">{c.sweetgubbe}</td>
		<td class="n tm">{c.trumfman}</td>
		<td class="n fo">{@render constipated(c.constipated, c.mega_constipated)}</td>
	</tr>
{/snippet}

{#snippet tabs()}
	<div class="tabs" role="tablist">
		{#each TABS as [key, label] (key)}
			<button
				type="button"
				class="tab"
				class:is-on={statsTab === key}
				role="tab"
				aria-selected={statsTab === key}
				onclick={() => onTabChange(key)}
			>
				<span>{label}</span>
			</button>
		{/each}
	</div>
{/snippet}

{#if isOpen}
	<LobbySheet title="Topplista & stats" width={820} tall {onClose} head={tabs}>
		{#if statsTab === 'all'}
			<div class="sheet-body flush">
				<table class="stats">
					{@render headings('Spelare', true)}
					<tbody>
						{#each allPlayersStats as row (row.id)}
							<tr
								class="player-row"
								class:is-me={row.id === activeProfileId}
								onclick={() => {
									onTabChange('personal');
									onSelectStatsProfile(row.id);
								}}
							>
								<td>
									<span class="who">
										<Avatar
											avatarConfig={row.avatar_config}
											fallbackColor={row.color}
											fallbackName={row.name}
											class="av-sm"
										/>
										{row.name}
									</span>
								</td>
								<td class="n">{row.games}</td>
								<td class="n sg">{row.skitgubbe}</td>
								<td class="n sw">{row.sweetgubbe}</td>
								<td class="n tm">{row.trumfman}</td>
								<td class="n fo">{@render constipated(row.constipated, row.mega_constipated)}</td>
								<td class="chev" aria-hidden="true">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="15"
										height="15"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2.5"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
									</svg>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="sheet-body split">
				<nav class="rail" aria-label="Spelare">
					{#each profiles as p (p.id)}
						<button
							type="button"
							class="pick"
							class:is-on={p.id === selectedStatsProfileId}
							aria-current={p.id === selectedStatsProfileId}
							onclick={() => onSelectStatsProfile(p.id)}
						>
							<Avatar
								avatarConfig={p.avatar_config}
								fallbackColor={p.color}
								fallbackName={p.name}
								class="av-xs"
							/>
							<span>{p.name}</span>
						</button>
					{/each}
				</nav>
				<div class="detail">
					{#if selectedStatsProfile}
						<div class="hero">
							<Avatar
								avatarConfig={selectedStatsProfile.avatar_config}
								fallbackColor={selectedStatsProfile.color}
								fallbackName={selectedStatsProfile.name}
								class="av-lg"
							/>
							<p class="hero-name">{selectedStatsProfile.name}</p>
						</div>
					{/if}
					{#if selectedPlayerBreakdown}
						<table class="stats breakdown">
							{@render headings('')}
							<tbody>
								{@render period('Senaste 10', selectedPlayerBreakdown.last10)}
								{@render period('Senaste 50', selectedPlayerBreakdown.last50)}
								{@render period('Totalt', selectedPlayerBreakdown.all, true)}
							</tbody>
						</table>
					{/if}
				</div>
			</div>
		{/if}
	</LobbySheet>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 6px;
		padding-inline: 4px;
	}

	.tab {
		height: 26px;
		padding: 0 12px;
		border: 1px solid rgba(227, 186, 90, 0.25);
		background: rgba(0, 0, 0, 0.3);
		color: #94a3b8;
		font-size: 11px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		transform: skewX(-15deg);
		cursor: pointer;
		transition:
			color 0.2s,
			background 0.2s;
	}

	.tab > span {
		display: inline-block;
		transform: skewX(15deg);
	}

	.tab:hover {
		color: #fff;
	}

	.tab.is-on {
		background: #e3ba5a;
		border-color: transparent;
		color: #1a1a1a;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.flush {
		padding: 0 14px 6px;
	}

	.stats {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-variant-numeric: tabular-nums;
	}

	.stats thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 6px 8px;
		background: #1c1915;
		border-bottom: 2px solid rgba(227, 186, 90, 0.3);
		text-align: left;
		font:
			700 11.5px/1.15 'Cormorant Garamond',
			Georgia,
			serif;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e3ba5a;
		white-space: nowrap;
	}

	.stats thead th.n {
		text-align: center;
		white-space: normal;
		hyphens: manual;
	}

	.stats td {
		height: 29px;
		padding: 2px 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		vertical-align: middle;
	}

	.stats td.n {
		text-align: center;
		font-size: 15px;
		font-weight: 700;
		color: #f1f5f9;
	}

	.stats td.sg {
		color: rgba(248, 113, 113, 0.92);
	}
	.stats td.sw {
		color: rgba(244, 114, 182, 0.92);
	}
	.stats td.tm {
		color: rgba(96, 165, 250, 0.92);
	}
	.stats td.fo {
		color: rgba(251, 191, 36, 0.92);
	}
	.stats thead th.sg {
		color: #f87171;
	}
	.stats thead th.sw {
		color: #f472b6;
	}
	.stats thead th.tm {
		color: #60a5fa;
	}
	.stats thead th.fo {
		color: #fbbf24;
	}

	.num {
		position: relative;
		display: inline-block;
	}

	.mega {
		position: absolute;
		left: 100%;
		top: 50%;
		transform: translateY(-50%);
		margin-left: 5px;
		font-size: 10px;
		font-weight: 500;
		color: rgba(245, 158, 11, 0.6);
		white-space: nowrap;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 14px;
		font-weight: 600;
		color: #e2e8f0;
		white-space: nowrap;
	}

	.who :global(.av-sm) {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		font-size: 9px;
	}

	.player-row {
		cursor: pointer;
	}

	.player-row:hover td {
		background: rgba(255, 255, 255, 0.03);
	}

	.player-row.is-me td {
		background: rgba(245, 158, 11, 0.07);
	}

	.player-row.is-me td:first-child {
		box-shadow: inset 2px 0 0 #e3ba5a;
	}

	.stats td.chev {
		width: 18px;
		padding: 0 4px 0 0;
		color: #64748b;
	}

	.split {
		display: grid;
		grid-template-columns: 168px minmax(0, 1fr);
		padding: 0;
		overflow: hidden;
	}

	.rail,
	.detail {
		overflow: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
	}

	.rail {
		padding: 6px 0;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
	}

	.pick {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		height: 32px;
		padding: 0 12px 0 14px;
		border: 0;
		background: none;
		text-align: left;
		color: #cbd5e1;
		font-size: 13.5px;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	.pick > span {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pick:hover {
		color: #fff;
		background: rgba(255, 255, 255, 0.03);
	}

	.pick.is-on {
		color: #ffe89e;
		background: rgba(255, 255, 255, 0.05);
		box-shadow: inset 3px 0 0 #e3ba5a;
	}

	.pick :global(.av-xs) {
		flex: none;
		width: 20px;
		height: 20px;
		border-radius: 3px;
		font-size: 8px;
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		padding: 12px 16px;
	}

	.hero {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.hero :global(.av-lg) {
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	.hero-name {
		margin: 0;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font:
			700 24px/1 'Cormorant Garamond',
			Georgia,
			serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #f1f5f9;
	}

	.breakdown tbody th {
		padding: 0 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		text-align: left;
		font-size: 13px;
		font-weight: 700;
		color: #cbd5e1;
		white-space: nowrap;
	}

	.breakdown td {
		height: 34px;
	}

	.breakdown tr.is-total th,
	.breakdown tr.is-total td {
		background: rgba(255, 255, 255, 0.04);
	}

	.breakdown tr.is-total th {
		color: #fbbf24;
	}

	.breakdown tr.is-total td.n {
		font-weight: 800;
	}

	@media (max-height: 360px) {
		.stats td {
			height: 27px;
		}
	}

	@media (max-width: 720px) {
		.split {
			grid-template-columns: 148px minmax(0, 1fr);
		}
		.tab {
			padding: 0 9px;
		}
		.hero-name {
			font-size: 21px;
		}
	}
</style>
