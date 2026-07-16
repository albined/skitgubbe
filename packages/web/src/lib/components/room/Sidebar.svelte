<script lang="ts">
	import { fade } from 'svelte/transition';
	import { CardFace, CardBack } from '$lib';
	import type { SanitizedGameState } from 'shared';

	interface Props {
		gameState: SanitizedGameState | null;
		localPlayerId: string;
		isHumanTurn: boolean;
		connectionStatus: 'connecting' | 'connected' | 'disconnected';
		onChanceClick: () => void;
	}

	let { gameState, localPlayerId, isHumanTurn, connectionStatus, onChanceClick }: Props = $props();
</script>

<div class="left-sidebar relative z-10 flex flex-shrink-0 flex-col items-center justify-center">
	<!-- Trump Box -->
	<div
		class="compact-pile-box flex w-full items-center justify-start gap-2"
		class:invisible={(gameState?.phase || 1) === 1}
	>
		<!-- Stable size container for card/slot transitions -->
		<div
			class="relative"
			style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
		>
			{#if gameState?.trumpCard}
				<div
					data-trump
					data-card-id={gameState.trumpCard.id}
					class="absolute inset-0 cursor-default rounded"
					transition:fade
				>
					<CardFace
						card={gameState.trumpCard}
						isTrump={true}
						class="h-full w-full shadow-md"
						style="padding: 1px; border: 1.5px solid #ffd700; border-radius: 4px;"
					/>
				</div>
			{:else if gameState?.hiddenTrumpStorage}
				{@const owner = gameState.players.find(
					(p) => p.id === (gameState ? gameState.hiddenTrumpStorage?.playerId : '')
				)}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/20 p-0.5 text-center font-mono text-[6px] leading-none text-slate-500"
					transition:fade
				>
					<span
						>HÅLLEN AV<br />{owner?.id === localPlayerId ? 'DIG' : owner?.name.toUpperCase()}</span
					>
				</div>
			{:else}
				<div
					class="absolute inset-0 flex flex-col items-center justify-center rounded border border-dashed border-slate-800 bg-slate-950/5 font-mono text-[7px] leading-none text-slate-600"
					transition:fade
				>
					<span>NONE</span>
				</div>
			{/if}
		</div>

		<!-- Unified stable text labels -->
		<div class="flex flex-col select-none">
			<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Trump</span>
			{#if gameState?.trumpCard}
				<span class="max-w-[65px] truncate font-mono text-[9px] font-bold text-yellow-400 uppercase"
					>{gameState.trumpCard.suitName}</span
				>
			{:else if gameState?.hiddenTrumpStorage}
				<span class="font-mono text-[9px] text-slate-500 uppercase">Hidden</span>
			{:else}
				<span class="font-mono text-[9px] text-slate-500 uppercase">None</span>
			{/if}
		</div>
	</div>

	<!-- Draw Pile Box (Phase 1) or Discard Pile Box (Phase 2) -->
	{#if gameState && gameState.phase === 1}
		<div class="compact-pile-box mt-2 flex w-full flex-col items-start gap-2" transition:fade>
			<div class="flex w-full items-center justify-start gap-2">
				<div
					data-deck
					class="relative flex-shrink-0 overflow-hidden rounded border border-amber-500/30 shadow-md"
					style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
				>
					{#if gameState.deck.length > 0}
						<CardBack
							class="h-full w-full"
							style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
						/>
					{:else}
						<div
							class="flex h-full w-full items-center justify-center rounded border border-dashed font-mono text-[7px] font-bold"
							style="background-color: var(--sidebar-empty-bg); border-color: var(--sidebar-empty-border); color: var(--sidebar-empty-text);"
						>
							Tomt
						</div>
					{/if}
				</div>
				<div class="flex flex-col select-none">
					<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Drag</span>
					<span class="font-mono text-[10px] font-bold text-yellow-400"
						>{gameState.deck.length} kvar</span
					>
				</div>
			</div>
			{#if gameState.deck.length > 0}
				<button
					onclick={onChanceClick}
					disabled={!isHumanTurn}
					class="gold-trimmed-btn mt-1 w-full py-1.5 font-serif text-xs font-bold tracking-wider uppercase"
				>
					Chansa
				</button>
			{/if}
		</div>
	{:else if gameState}
		<div class="compact-pile-box mt-2 flex w-full items-center justify-start gap-2" transition:fade>
			<div
				data-discard
				class="relative flex flex-shrink-0 items-center justify-center rounded border shadow-inner"
				style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height); background-color: var(--sidebar-slot-bg); border-color: var(--sidebar-slot-border);"
			>
				{#if gameState.discardPile.length > 0}
					<CardBack
						class="animate-fade-in h-full w-full"
						style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
					/>
				{/if}
			</div>
			<div class="flex flex-col select-none">
				<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Släng</span>
				<span class="font-mono text-[10px] font-bold" style="color: var(--sidebar-text-accent);"
					>{gameState.discardPile.length} kort</span
				>
			</div>
		</div>
	{/if}

	<!-- WebSocket status indicator -->
	{#if connectionStatus !== 'connected'}
		<div
			class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[9px] whitespace-nowrap text-slate-400"
			transition:fade
		>
			<span
				class="h-1.5 w-1.5 rounded-full bg-red-400 {connectionStatus === 'connecting'
					? 'animate-ping'
					: 'animate-pulse bg-red-500'}"
			></span>
			{connectionStatus.toUpperCase()}
		</div>
	{/if}
</div>
