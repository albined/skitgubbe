<script lang="ts">
	import type { ApiSkitgubbeHistoryEntry } from 'shared';
	import Avatar from '$lib/Avatar.svelte';
	import { daysAgo, shortDate } from '$lib/time';
	import LobbySheet from './LobbySheet.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		skitgubbeHistory: ApiSkitgubbeHistoryEntry[];
	}

	let { isOpen, onClose, skitgubbeHistory }: Props = $props();

	let current = $derived(skitgubbeHistory[0]);

	// Counted from the first loss of the current holder's run, so losing again doesn't reset it.
	let heldFor = $derived.by(() => {
		if (!current) return '';
		let first = 0;
		while (skitgubbeHistory[first + 1]?.profile_id === current.profile_id) first++;
		const days = daysAgo(skitgubbeHistory[first].acquired_at);
		if (days <= 0) return 'Idag';
		return `${days} ${days === 1 ? 'dag' : 'dagar'}`;
	});
</script>

{#if isOpen}
	<LobbySheet title="Skitgubbe-loggen" width={800} tall {onClose}>
		<div class="sheet-body log">
			<figure class="poster">
				<div class="poster-art">
					<img src="/skitgubbe_transparent.webp" alt="" width="1792" height="2400" />
					{#if current}
						<div class="poster-face">
							<Avatar
								avatarConfig={current.profile_avatar}
								fallbackColor={current.profile_color}
								fallbackName={current.profile_name}
								class="h-full w-full"
							/>
						</div>
						<span class="poster-name">{current.profile_name}</span>
					{:else}
						<div class="poster-face is-empty" aria-hidden="true">?</div>
						<span class="poster-name">Vem blir nästa?</span>
					{/if}
				</div>
				{#if current}
					<figcaption>{heldFor}</figcaption>
				{/if}
			</figure>

			<div class="ledger-wrap">
				<ol class="ledger">
					{#each skitgubbeHistory as entry (entry.id)}
						<li>
							<span class="date">{shortDate(entry.acquired_at)}</span>
							<Avatar
								avatarConfig={entry.profile_avatar}
								fallbackColor={entry.profile_color}
								fallbackName={entry.profile_name}
								class="entry-av"
							/>
							<span class="name">{entry.profile_name}</span>
							<span class="game">{entry.game_name ?? ''}</span>
						</li>
					{/each}
				</ol>
			</div>
		</div>
	</LobbySheet>
{/if}

<style>
	.log {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		padding: 0;
		overflow: hidden;
		/* The poster sizes itself from the height of this area. */
		container-type: size;
	}

	.poster {
		margin: 0;
		padding: 10px 14px 8px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-height: 0;
		border-right: 1px solid rgba(255, 255, 255, 0.07);
	}

	.poster-art {
		position: relative;
		height: calc(100cqh - 48px);
		max-height: 320px;
		aspect-ratio: 1792 / 2400;
		container-type: inline-size;
		transform: rotate(-1.5deg);
		filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.6));
	}

	.poster-art > img {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* Same placement as the poster on the notice board. */
	.poster-face {
		position: absolute;
		left: 26%;
		top: 35%;
		width: 48%;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 5.5cqw;
		border: 1px solid rgba(46, 35, 21, 0.2);
		background: #1e1b18;
	}

	.poster-face.is-empty {
		display: grid;
		place-items: center;
		border: 1px dashed rgba(100, 116, 139, 0.6);
		background: rgba(2, 6, 23, 0.5);
		font-size: 22cqw;
		font-weight: 900;
		color: rgba(100, 116, 139, 0.6);
	}

	.poster-name {
		position: absolute;
		left: 7%;
		right: 7%;
		top: 73%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
		font-family: 'Nanum Brush Script', cursive;
		font-size: 12cqw;
		line-height: 1;
		color: #2e2315;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	figcaption {
		font:
			700 17px/1 'Cormorant Garamond',
			Georgia,
			serif;
		font-variant-numeric: lining-nums;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #e3ba5a;
	}

	.ledger-wrap {
		min-width: 0;
		overflow: auto;
		padding: 4px 16px 10px;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
	}

	.ledger {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.ledger li {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 36px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.date {
		flex: none;
		min-width: 44px;
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: #94a3b8;
		white-space: nowrap;
	}

	.ledger :global(.entry-av) {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		font-size: 9px;
	}

	.name {
		flex: none;
		font-family: 'Nanum Brush Script', cursive;
		font-size: 21px;
		line-height: 1;
		color: #eadcbc;
	}

	.game {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
		font:
			italic 400 15px 'Cormorant Garamond',
			Georgia,
			serif;
		color: rgba(255, 255, 255, 0.5);
	}

	@media (max-height: 360px) {
		.ledger li {
			height: 33px;
		}
	}
</style>
