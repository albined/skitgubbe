<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import { CardBack } from '$lib';
	import type { Player } from 'shared';

	interface Props {
		players: Player[];
		activePlayerIdx: number;
		trickWinnerId: string | null;
		gameStatus: string;
		localPlayerId: string;
		phase: number;
	}

	let { players, activePlayerIdx, trickWinnerId, gameStatus, localPlayerId, phase }: Props =
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
			<div class="player-profile-stack">
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
