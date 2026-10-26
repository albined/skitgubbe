<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import AvatarAccessories from '$lib/components/room/AvatarAccessories.svelte';
	import { CardBack } from '$lib';
	import { gameTitle, type GameState } from 'shared';

	interface Props {
		gameState: GameState;
		viewerId: string;
		handOwnerId: string;
		onShowHand: (playerId: string) => void;
	}

	let { gameState, viewerId, handOwnerId, onShowHand }: Props = $props();

	const possessive = (name: string) => (/s$/i.test(name) ? name : `${name}s`);
</script>

<!-- The room's player row; each player is a tab for the hand shown at the bottom. -->
<div class="players-row z-10" class:crowded={gameState.players.length >= 5}>
	{#each gameState.players as player, idx (player.id)}
		{#if idx > 0}
			<div class="player-row-divider"></div>
		{/if}
		{@const isActive =
			gameState.activePlayerIdx === idx &&
			!gameState.trickWinnerId &&
			gameState.status === 'playing'}
		<button
			type="button"
			data-player-id={player.id}
			class="player-status-block hand-tab {isActive ? 'active-turn' : ''} {player.isDone
				? 'escaped'
				: ''} {player.hasLeft ? 'opacity-60 grayscale filter' : ''}"
			aria-pressed={player.id === handOwnerId}
			aria-label={`${possessive(player.name)} kort`}
			onclick={() => onShowHand(player.id)}
		>
			<span class="player-profile-stack relative">
				<span class="avatar-container relative">
					<Avatar
						avatarConfig={player.avatarConfig}
						fallbackColor={player.color}
						fallbackName={player.name}
						class="player-avatar h-full w-full"
					/>
					<AvatarAccessories title={gameTitle(player)} />
				</span>
				<span class="player-name">{player.id === viewerId ? 'Du' : player.name}</span>
			</span>

			<span class="player-card-badge relative overflow-hidden" class:active-turn={isActive}>
				{#if gameState.phase === 1 ? player.reserveStack.length > 1 : player.hand.length > 1}
					<CardBack
						class="pointer-events-none absolute inset-0 h-full w-full"
						style="border: none; background-size: 8px 8px, 8px 8px, 8px 8px, 100% 100%; z-index: 1;"
					/>
				{/if}
				<span class="relative z-10 flex h-full w-full items-center justify-center">
					{#if gameState.phase === 1}
						<span class="stacked-counts">
							<span class="hand-count">{player.hand.length}</span>
							<span class="count-divider"></span>
							<span class="reserve-count">{player.reserveStack.length}</span>
						</span>
					{:else}
						<span class="single-count">{player.hand.length}</span>
					{/if}
				</span>
			</span>
		</button>
	{/each}
</div>

<style>
	.players-row {
		/* Leave room above even the mobile avatars for their earned accessories. */
		padding-top: 18px;
		/* The replay has only the one button up there. */
		--players-row-clear-right: 64px;
	}

	.hand-tab {
		position: relative;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.hand-tab:focus-visible {
		outline: 1.5px solid #ffe89e;
		outline-offset: 2px;
	}

	.hand-tab:hover .player-name {
		color: #fff;
	}

	/* Whose hand is shown: a slanted gold bar, like the tabs in Topplista. */
	.hand-tab::after {
		content: '';
		position: absolute;
		left: 3px;
		right: 3px;
		bottom: -6px;
		height: 3px;
		background: linear-gradient(
			135deg,
			#ffe89e 0%,
			#e3ba5a 25%,
			#b88728 45%,
			#fceeac 55%,
			#d19f33 70%,
			#875c12 100%
		);
		box-shadow: 0 0 6px rgba(227, 186, 90, 0.45);
		transform: skewX(-24deg) scaleX(0);
		transition: transform 0.2s ease;
	}

	.hand-tab[aria-pressed='true']::after {
		transform: skewX(-24deg) scaleX(1);
	}

	/* A span here, so it sits inside the button. */
	.count-divider {
		display: block;
	}

	@media (prefers-reduced-motion: reduce) {
		.hand-tab::after {
			transition: none;
		}
	}
</style>
