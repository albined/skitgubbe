<script lang="ts">
	import Avatar from '$lib/Avatar.svelte';
	import { CardBack } from '$lib';
	import type { SanitizedPlayer } from 'shared';
	import type { RoomState } from '$lib/state/roomState.svelte';
	import { fade } from 'svelte/transition';
	import { apiRequest } from '$lib/platform/api';
	import { tick } from 'svelte';

	interface Props {
		roomState: RoomState;
		players: SanitizedPlayer[];
		activePlayerIdx: number;
		trickWinnerId: string | null;
		gameStatus: string;
		localPlayerId: string;
		phase: number;
	}

	let {
		roomState,
		players,
		activePlayerIdx,
		trickWinnerId,
		gameStatus,
		localPlayerId,
		phase
	}: Props = $props();

	let nudgeTarget = $state<string | null>(null);
	let menuLeft = $state(0);
	let menuTop = $state(0);
	let sending = $state(false);
	let feedback = $state('');
	let sent = $state(false);
	let menuElement = $state<HTMLDivElement>();
	let trigger: HTMLButtonElement | null = null;
	let menuVersion = 0;

	function canNudge(player: SanitizedPlayer, idx: number) {
		return (
			idx === activePlayerIdx &&
			!trickWinnerId &&
			gameStatus === 'playing' &&
			player.id !== localPlayerId &&
			!player.isOnline &&
			!player.hasLeft &&
			!player.isDone &&
			player.inviteStatus !== 'pending'
		);
	}

	$effect(() => {
		if (
			nudgeTarget &&
			!players.some((player, idx) => player.id === nudgeTarget && canNudge(player, idx))
		) {
			nudgeTarget = null;
		}
	});

	async function openNudge(event: MouseEvent, playerId: string) {
		menuVersion++;
		if (nudgeTarget === playerId) {
			nudgeTarget = null;
			return;
		}
		trigger = event.currentTarget as HTMLButtonElement;
		const rect = trigger.getBoundingClientRect();
		menuLeft = Math.max(12, Math.min(rect.left, window.innerWidth - 236));
		menuTop = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 160));
		nudgeTarget = playerId;
		feedback = '';
		sent = false;
		sending = false;
		await tick();
		menuElement?.querySelector('button')?.focus();
	}

	function outsideClick(event: MouseEvent) {
		const target = event.target as Node;
		if (!menuElement?.contains(target) && !trigger?.contains(target)) nudgeTarget = null;
	}

	async function nudge() {
		const target = nudgeTarget;
		const version = menuVersion;
		if (!target || sending || sent) return;
		sending = true;
		try {
			const response = await apiRequest(
				`/api/games/${encodeURIComponent(roomState.roomId)}/nudge/${encodeURIComponent(target)}`,
				{ method: 'POST' }
			);
			const result = await response.json();
			if (nudgeTarget !== target || version !== menuVersion) return;
			if (!response.ok) {
				feedback = result.error || 'Kunde inte skicka påminnelsen.';
			} else {
				sent = true;
				feedback = 'Påminnelse skickad!';
			}
		} catch {
			if (nudgeTarget === target && version === menuVersion)
				feedback = 'Kunde inte skicka påminnelsen. Försök igen.';
		} finally {
			if (nudgeTarget === target && version === menuVersion) sending = false;
		}
	}
</script>

<svelte:window
	onclick={outsideClick}
	onresize={() => (nudgeTarget = null)}
	onkeydown={(event) => {
		if (event.key === 'Escape' && nudgeTarget) {
			nudgeTarget = null;
			trigger?.focus();
		}
	}}
/>

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
				: ''} {player.hasLeft ? 'opacity-60 grayscale filter' : ''}"
		>
			<!-- Left Side: Profile vertical stack -->
			<div class="player-profile-stack relative">
				<div class="avatar-container relative">
					<Avatar
						avatarConfig={player.avatarConfig}
						fallbackColor={player.color}
						fallbackName={player.name}
						class="player-avatar h-full w-full"
					/>
					{#if player.isOnline}
						<span class="online-indicator" title="Online"></span>
					{/if}
					{#if canNudge(player, idx)}
						<button
							type="button"
							class="absolute inset-0 cursor-pointer rounded-[inherit] border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-amber-300"
							aria-label={`Påminn ${player.name}`}
							aria-expanded={nudgeTarget === player.id}
							onclick={(event) => openNudge(event, player.id)}
						></button>
					{/if}
				</div>
				<span class="player-name">
					{player.id === localPlayerId ? 'Du' : player.name}
					{#if player.hasLeft}
						<span
							class="status-badge block text-[8px] font-bold tracking-wider text-slate-400 uppercase"
							>🚪 Lämnade</span
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
						class="pointer-events-none absolute top-full left-1/2 z-50 mt-2 flex -translate-x-1/2 items-center justify-center"
					>
						<div class="premium-chat-bubble" class:is-emote={bubble?.type === 'emote'}>
							{#if bubble?.type === 'emote'}
								<span class="text-6xl">{bubble.content}</span>
							{:else}
								<span
									class="max-w-[200px] text-center text-[20px] leading-tight break-words text-slate-100"
									>{bubble?.content}</span
								>
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

{#if nudgeTarget}
	<div
		bind:this={menuElement}
		class="premium-modal-container fixed z-[100] w-56 p-3 text-slate-200"
		style:left={`${menuLeft}px`}
		style:top={`${menuTop}px`}
		transition:fade={{ duration: 100 }}
	>
		<button
			type="button"
			class="gold-trimmed-btn w-full px-3 py-2 font-serif text-sm"
			disabled={sending || sent}
			onclick={nudge}
		>
			{sending ? 'Skickar…' : sent ? 'Påmind' : 'Påminn spelaren'}
		</button>
		<p class="mt-2 text-xs text-slate-300" role="status">
			{feedback || 'Skicka en notis om att du väntar på nästa drag.'}
		</p>
	</div>
{/if}

<style>
	.premium-chat-bubble {
		background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(35, 30, 25, 0.9) 100%);
		border: 1.5px solid;
		border-image: linear-gradient(to bottom right, #ffe89e, #b88728) 1;
		border-radius: 0 !important;
		color: #ffffff;
		padding: 4px 10px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: 'Outfit', 'Inter', sans-serif;
		font-weight: 600;
	}

	.premium-chat-bubble.is-emote {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		padding: 0 !important;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
	}
</style>
