<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import { CardBack } from '$lib';
	import type { Player } from 'shared';
	import type { RoomState } from '$lib/state/roomState.svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		roomState: RoomState;
		players: Player[];
		activePlayerIdx: number;
		trickWinnerId: string | null;
		gameStatus: string;
		localPlayerId: string;
		phase: number;
	}

	let { roomState, players, activePlayerIdx, trickWinnerId, gameStatus, localPlayerId, phase }: Props =
		$props();
</script>

<div class="players-row z-10">
	{#each players as player, idx (player.id)}
		{#if idx > 0}
			<div class="player-row-divider"></div>
		{/if}
		{@const isActive = activePlayerIdx === idx && !trickWinnerId && gameStatus === 'playing'}
		<div
			data-player-id={player.id}
			class="player-status-block transition-all duration-300 {isActive
				? 'active-turn'
				: ''} {player.isDone ? 'escaped' : ''} {player.inviteStatus === 'pending'
				? 'pending-invite opacity-40 grayscale filter'
				: ''} {player.isBot ? 'opacity-60 grayscale filter' : ''}"
		>
			<!-- Left Side: Profile vertical stack -->
			<div class="player-profile-stack relative">
				<Avatar
					avatarConfig={player.avatarConfig}
					fallbackColor={player.color}
					fallbackName={player.name}
					class="player-avatar h-full w-full"
				/>
				<span class="player-name">
					{player.id === localPlayerId ? 'Du' : player.name}
					{#if player.isBot}
						<span
							class="status-badge block text-[8px] font-bold tracking-wider text-slate-400 uppercase"
							>🤖 BOT</span
						>
					{/if}
					{#if player.isSkitgubbe}
						<span class="status-badge text-red-500"></span>
					{:else if player.inviteStatus === 'pending'}
						<span
							class="status-badge text-amber-550 block text-[8px] font-bold tracking-wider uppercase"
							>Inbjuden</span
						>
					{/if}
				</span>

				<!-- Chat / Emote Bubble -->
				{#if roomState.activeBubbles.has(player.id)}
					{@const bubble = roomState.activeBubbles.get(player.id)}
					<div
						transition:fade={{ duration: 150 }}
						class="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none"
					>
						<div class="premium-chat-bubble">
							{#if bubble?.type === 'emote'}
								<span class="text-sm">{bubble.content}</span>
							{:else}
								<span class="text-[9px] leading-tight text-slate-100 whitespace-nowrap text-ellipsis overflow-hidden max-w-[90px]">{bubble?.content}</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Right Side: Card count symbol -->
			<div class="player-card-badge relative overflow-hidden" class:active-turn={isActive}>
				{#if phase === 1 ? player.reserveStack.length > 1 : player.hand.length > 1}
					<CardBack
						class="pointer-events-none absolute inset-0 h-full w-full"
						style="border: none; background-size: 8px 8px, 8px 8px, 8px 8px, 100% 100%; z-index: 1;"
					/>
				{/if}
				<div class="relative z-10 flex h-full w-full items-center justify-center">
					{#if phase === 1}
						<div class="stacked-counts">
							<span class="hand-count">{player.hand.length}</span>
							<div class="count-divider"></div>
							<span class="reserve-count">{player.reserveStack.length}</span>
						</div>
					{:else}
						<span class="single-count">{player.hand.length}</span>
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>

<style>
	.premium-chat-bubble {
		background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(35, 30, 25, 0.9) 100%);
		border: 1.5px solid;
		border-image: linear-gradient(to bottom right, #ffe89e, #b88728) 1;
		border-radius: 0 !important;
		color: #ffffff;
		padding: 2px 6px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: 'Outfit', 'Inter', sans-serif;
		font-weight: 600;
	}
</style>
