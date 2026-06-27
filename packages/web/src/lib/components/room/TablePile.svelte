<script lang="ts">
	import { fade } from 'svelte/transition';
	import { CardFace, CardBack } from '$lib';
	import type { GameState } from 'shared';
	import type { RoomState } from '$lib/state/roomState.svelte';

	interface Props {
		roomState: RoomState;
		gameState: GameState;
		localPlayerId: string;
		endGameStage: 'none' | 'paused' | 'table_clear' | 'cards_reveal' | 'poster_slam';
		trumpSuit: string | null;
	}

	let { roomState, gameState, localPlayerId, endGameStage, trumpSuit }: Props = $props();
</script>

{#if gameState.phase === 1}
	<!-- Phase 1 Layout: Groups of played cards arranged side-by-side -->
	<div class="table-pile-container flex items-center justify-center gap-4 overflow-visible">
		{#each gameState.tablePile as batch, idx (gameState.tablePilePlayers[idx] + '-' + (batch[0]?.id || ''))}
			{@const playerIdOfBatch = gameState.tablePilePlayers[idx]}
			{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
			<div class="flex flex-col items-center gap-2">
				<span
					class="rounded border px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300"
					style="background-color: var(--table-pile-badge-bg); border-color: var(--table-pile-badge-border);"
					out:fade={{ duration: 300 }}
				>
					{player?.id === localPlayerId ? 'Du' : player?.name}
				</span>
				<div class="semi-stacked-pile">
					{#each batch as card, cardIdx (card.id)}
						{#if endGameStage === 'none' || endGameStage === 'paused'}
							<div
								class="card relative cursor-default"
								data-card-id={card.id}
								in:roomState.cardIn|global={{ id: card.id, playerId: playerIdOfBatch, card }}
								out:roomState.cardOut|global={{ id: card.id }}
							>
								<div class="relative h-full w-full" style="transform-style: preserve-3d;">
									<!-- Front of Card -->
									<CardFace
										{card}
										isTrump={!!trumpSuit && card.suitName === trumpSuit}
										class="shadow-md"
										style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
									/>

									<!-- Back of Card (for flip transition) -->
									<CardBack
										style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
									/>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<!-- Phase 2 Layout: Horizontally fanned out sequential play batches -->
	<div
		class="table-pile-container-phase2 flex max-w-4xl flex-wrap items-center justify-center gap-3 overflow-visible"
	>
		{#each gameState.tablePile as batch, batchIdx (gameState.tablePilePlayers[batchIdx] + '-' + (batch[0]?.id || ''))}
			{@const playerIdOfBatch = gameState.tablePilePlayers[batchIdx]}
			{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
			<div class="flex flex-col items-center">
				<span
					class="mb-1 font-mono text-[9px] font-bold text-slate-400"
					out:fade={{ duration: 300 }}
				>
					{player?.id === localPlayerId ? 'Du' : player?.name}
				</span>
				<div
					class="semi-stacked-pile rounded-lg border p-1 shadow-inner"
					style="background-color: var(--table-pile-bg); border-color: var(--table-pile-border);"
				>
					{#each batch as card, cardIdx (card.id)}
						{#if endGameStage === 'none' || endGameStage === 'paused'}
							<div
								class="card relative cursor-default"
								data-card-id={card.id}
								in:roomState.cardIn|global={{ id: card.id, playerId: playerIdOfBatch, card }}
								out:roomState.cardOut|global={{ id: card.id }}
							>
								<div class="relative h-full w-full" style="transform-style: preserve-3d;">
									<!-- Front of Card -->
									<CardFace
										{card}
										isTrump={!!trumpSuit && card.suitName === trumpSuit}
										class="shadow-md"
										style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
									/>

									<!-- Back of Card (for flip transition) -->
									<CardBack
										style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
									/>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
