<script lang="ts">
	import { CardFace } from '$lib';
	import type { GameState } from 'shared';

	interface Props {
		gameState: GameState;
		viewerId: string;
		trumpSuit: string | null;
	}

	let { gameState, viewerId, trumpSuit }: Props = $props();

	const nameOf = (playerId: string) =>
		playerId === viewerId ? 'Du' : gameState.players.find((p) => p.id === playerId)?.name;
</script>

<!-- TablePile's layout without its live-game exit transitions; ReplayFlights moves the cards. -->
{#if gameState.phase === 1}
	<div class="table-pile-container flex items-center justify-center gap-4 overflow-visible">
		{#each gameState.tablePile as batch, idx (gameState.tablePilePlayers[idx] + '-' + (batch[0]?.id || ''))}
			<div class="flex flex-col items-center gap-2">
				<span
					class="rounded border px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300"
					style="background-color: var(--table-pile-badge-bg); border-color: var(--table-pile-badge-border);"
				>
					{nameOf(gameState.tablePilePlayers[idx])}
				</span>
				<div class="semi-stacked-pile">
					{#each batch as card (card.id)}
						<div class="card relative cursor-default" data-card-id={card.id}>
							<CardFace
								{card}
								isTrump={!!trumpSuit && card.suitName === trumpSuit}
								class="shadow-md"
								style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
							/>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div
		class="table-pile-container-phase2 flex max-w-4xl flex-wrap items-center justify-center gap-3 overflow-visible"
	>
		{#each gameState.tablePile as batch, idx (gameState.tablePilePlayers[idx] + '-' + (batch[0]?.id || ''))}
			<div class="flex flex-col items-center">
				<span class="mb-1 font-mono text-[9px] font-bold text-slate-400">
					{nameOf(gameState.tablePilePlayers[idx])}
				</span>
				<div
					class="semi-stacked-pile rounded-lg border p-1 shadow-inner"
					style="background-color: var(--table-pile-bg); border-color: var(--table-pile-border);"
				>
					{#each batch as card (card.id)}
						<div class="card relative cursor-default" data-card-id={card.id}>
							<CardFace
								{card}
								isTrump={!!trumpSuit && card.suitName === trumpSuit}
								class="shadow-md"
								style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
							/>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
