<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';
	import { RoomState } from '$lib/state/roomState.svelte';
	import { CardDragState } from '$lib/state/cardDragState.svelte';
	import { Confetti } from '$lib';

	// Component imports
	import Sidebar from '$lib/components/room/Sidebar.svelte';
	import PlayersRow from '$lib/components/room/PlayersRow.svelte';
	import TablePile from '$lib/components/room/TablePile.svelte';
	import PlayerHand from '$lib/components/room/PlayerHand.svelte';
	import EndGameOverlay from '$lib/components/room/EndGameOverlay.svelte';
	import DebugMenu from '$lib/components/room/DebugMenu.svelte';
	import GameLogPanel from '$lib/components/room/GameLogPanel.svelte';
	import GameChatPanel from '$lib/components/room/GameChatPanel.svelte';

	const roomId = $page.params.roomId || '';
	const roomState = new RoomState(roomId);
	const dragState = new CardDragState(roomState);

	// Register dragState on roomState so it can reset pendingPlayOffsets
	roomState.dragState = dragState;

	let confettiRef: Confetti | null = $state(null);

	// Bind confettiRef on mount
	$effect(() => {
		roomState.confettiRef = confettiRef;
	});

	// Toggle skitgubbe background class on document body
	$effect(() => {
		const isSg = roomState.isLocalSkitgubbe;
		document.body.classList.toggle('is-skitgubbe', isSg);
		return () => {
			document.body.classList.remove('is-skitgubbe');
		};
	});

	onMount(async () => {
		await roomState.init();
	});

	onDestroy(() => {
		roomState.destroy();
	});
</script>

<svelte:window
	bind:innerHeight={roomState.innerHeight}
	bind:innerWidth={roomState.innerWidth}
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.card')) {
			roomState.focusedCardId = null;
			roomState.fanCenterIdx = -1;
		}
	}}
	onpointermove={(e) => dragState.handlePointerMove(e)}
	onpointerup={(e) => dragState.handlePointerUp(e)}
/>

<div class="felt-overlay"></div>
<Confetti bind:this={confettiRef} />

<!-- Disconnected Overlay -->
{#if roomState.showDisconnectedOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
		transition:fade
	>
		<div
			class="premium-modal-container flex flex-col items-center gap-4 border-red-500/20 p-8 text-center"
		>
			<div class="relative flex h-12 w-12 items-center justify-center">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
				></span>
				<span class="relative inline-flex h-6 w-6 rounded-full bg-red-500"></span>
			</div>
			<div>
				<h3 class="text-lg font-bold tracking-wider text-white uppercase">Connection Lost</h3>
				<p class="text-slate-450 mt-2 text-xs">Attempting to reconnect to the game server...</p>
			</div>
		</div>
	</div>
{/if}

<div
	class="game-layout relative flex h-screen w-screen flex-col justify-between overflow-hidden select-none"
	class:shake-active={roomState.shakeActive}
	style="--card-width: {roomState.cardWidth}px; --card-height: {roomState.cardWidth *
		1.4}px; --hand-container-height: {roomState.cardWidth * 1.4 * 1.35}px;"
>
	<!-- Top Container: Sidebars and Center Game Board -->
	<div class="flex w-full flex-grow">
		<!-- Left Sidebar: Draw, Discard, and Trump -->
		<Sidebar
			gameState={roomState.gameState}
			localPlayerId={roomState.playerId}
			isHumanTurn={roomState.isHumanTurn}
			connectionStatus={roomState.connectionStatus}
			onChanceClick={() => roomState.handleChanceClick()}
		/>

		<!-- Center Area: Players Row & Table Pile -->
		<div class="relative flex flex-grow flex-col">
			<!-- Top Row: Player status cards -->
			{#if roomState.gameState}
				<PlayersRow
					{roomState}
					players={roomState.gameState.players}
					activePlayerIdx={roomState.gameState.activePlayerIdx}
					trickWinnerId={roomState.gameState.trickWinnerId}
					gameStatus={roomState.gameState.status}
					localPlayerId={roomState.playerId}
					phase={roomState.gameState.phase}
				/>
			{/if}

			<!-- Main play field (Table) -->
			<main
				class="board-game-zone relative mx-auto flex w-full max-w-5xl flex-grow items-center justify-center overflow-visible px-4"
				class:drag-over-valid={dragState.isDragValid}
			>
				<!-- Ornate felt inner circle rim -->
				<div
					class="pointer-events-none absolute inset-0 my-12 rounded-full border opacity-20"
					style="border-color: var(--felt-rim-color);"
				></div>

				{#if roomState.errorMessage}
					<div
						class="absolute top-6 z-20 animate-bounce rounded-full border border-red-500/20 bg-red-950/90 px-4 py-2 text-xs font-semibold tracking-wide text-red-200 shadow-lg"
					>
						⚠️ {roomState.errorMessage}
					</div>
				{/if}

				{#if roomState.skitgubbe}
					<EndGameOverlay
						skitgubbe={roomState.skitgubbe}
						endGameStage={roomState.endGameStage}
						showDustEffect={roomState.showDustEffect}
						loserAvatarPos={roomState.loserAvatarPos}
						innerWidth={roomState.innerWidth}
						innerHeight={roomState.innerHeight}
					/>
				{/if}

				<!-- Cards currently in play -->
				{#if roomState.gameState}
					<TablePile
						{roomState}
						gameState={roomState.gameState}
						localPlayerId={roomState.playerId}
						endGameStage={roomState.endGameStage}
						trumpSuit={roomState.trumpSuit}
					/>
				{/if}
			</main>
		</div>
	</div>

	<!-- Exit to Lobby Button in Top Left -->
	<a
		href="/"
		class="gold-trimmed-btn absolute top-4 left-4 z-30 h-10 w-10"
		class:pulse-exit={roomState.endGameStage === 'poster_slam'}
		title="Exit to Lobby"
		aria-label="Exit to lobby"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1"
			/>
		</svg>
	</a>

	<!-- Toggle Logs Button in Top Right -->
	<button
		onclick={() => {
			roomState.showLogs = !roomState.showLogs;
			if (roomState.showLogs) {
				roomState.showChat = false;
			}
		}}
		class="gold-trimmed-btn absolute top-4 right-4 z-30 h-10 w-10"
		title="Toggle Game Log"
		aria-label="Toggle game log"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>

	<!-- Floating Logs Panel -->
	<GameLogPanel {roomState} />

	<!-- Floating Chat Panel -->
	<GameChatPanel {roomState} />

	<!-- Toggle Chat Button in Bottom Right -->
	{#if !roomState.showChat}
		<button
			onclick={() => {
				roomState.showChat = !roomState.showChat;
				if (roomState.showChat) {
					roomState.showLogs = false;
					roomState.showEmoteMenu = false;
				}
			}}
			class="gold-trimmed-btn absolute right-4 bottom-4 z-30 h-10 w-10"
			title="Toggle Chat"
			aria-label="Toggle chat"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
				/>
			</svg>
			{#if roomState.unreadChatCount > 0}
				<span
					class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center border border-amber-500/60 bg-red-700 px-0.5 font-mono text-[9px] font-bold text-[#ffe89e] shadow-[0_0_5px_rgba(239,68,68,0.5)]"
				>
					{roomState.unreadChatCount}
				</span>
			{/if}
		</button>
	{/if}

	<!-- Toggle Emote Menu Button in Bottom Right -->
	{#if !roomState.showChat}
		<button
			onclick={() => (roomState.showEmoteMenu = !roomState.showEmoteMenu)}
			class="gold-trimmed-btn absolute right-4 bottom-16 z-30 h-10 w-10"
			title="Send Emote"
			aria-label="Send emote"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		</button>
	{/if}

	<!-- Emote Selector Menu Popup -->
	{#if roomState.showEmoteMenu}
		<div
			transition:fade={{ duration: 150 }}
			class="premium-modal-container absolute right-4 bottom-28 z-40 flex flex-col gap-2 p-2"
		>
			<div class="grid grid-cols-5 gap-1.5">
				{#each ['😝', '😭', '😎', '😡', '😱', '😵', '🤢', '💀', '👍', '👎'] as emoji}
					<button
						onclick={() => {
							roomState.sendWsMessage({ type: 'chat', emote: emoji });
							roomState.showEmoteMenu = false;
						}}
						class="flex h-8 w-8 cursor-pointer items-center justify-center text-lg transition-transform duration-200 hover:scale-125 active:scale-90"
					>
						{emoji}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bottom Area: Actions & Player Hand -->
	<footer class="game-footer relative z-10 flex w-full flex-col items-center gap-4 pb-4">
		<!-- Buttons actions panel -->
		<div
			class="action-buttons-panel relative flex w-[80vw] max-w-5xl items-center justify-end overflow-visible px-2"
		>
			<!-- Right side trigger buttons -->
			<div class="flex gap-3">
				{#if roomState.gameState && roomState.gameState.phase === 2 && roomState.isHumanTurn && roomState.gameState.tablePile.length > 0}
					<button
						onclick={() => roomState.handlePickUpClick()}
						disabled={roomState.isReplaying}
						class="pick-up-btn cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						PLOCKA
					</button>
				{/if}
				{#if roomState.isStroValid}
					<button
						onclick={() => roomState.handleSprinkleClick()}
						disabled={roomState.isReplaying}
						class="lay-cards-btn cursor-pointer rounded-lg border border-teal-500/20 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg transition-all duration-300 hover:from-emerald-400 hover:to-teal-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						STRÖ ({roomState.selectedCardIds.length})
					</button>
				{/if}
			</div>
		</div>

		<!-- Hand Container -->
		<PlayerHand {roomState} {dragState} />
	</footer>
</div>

<!-- Debug Menu Floating Action Button and Panel -->
<DebugMenu {roomState} />

<!-- Portrait Orientation Warning Overlay -->
<div class="portrait-warning">
	<div class="warning-content">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="rotate-phone-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
		<h2>Rotera mobilen!</h2>
		<p>Spelet är anpassat för horisontellt läge. Rotera mobilen för att spela!</p>
	</div>
</div>

<style>
	:global(.card.transitioning) {
		transition: none !important;
	}

	:global(.board-game-zone.drag-over-valid) {
		box-shadow: inset 0 0 50px var(--drag-over-shadow) !important;
		background: radial-gradient(circle, var(--drag-over-bg) 0%, transparent 80%) !important;
		transition:
			background 0.3s ease,
			box-shadow 0.3s ease;
	}

	/* Screenshake viewport effect */
	@keyframes screenshake {
		0% {
			transform: translate(0, 0) rotate(0deg);
		}
		10% {
			transform: translate(-3px, 2px) rotate(-1deg);
		}
		20% {
			transform: translate(2px, -3px) rotate(1deg);
		}
		30% {
			transform: translate(-1px, 2px) rotate(0deg);
		}
		40% {
			transform: translate(3px, 1px) rotate(1deg);
		}
		50% {
			transform: translate(-2px, -2px) rotate(-1deg);
		}
		60% {
			transform: translate(2px, 3px) rotate(0deg);
		}
		70% {
			transform: translate(-1px, -1px) rotate(1deg);
		}
		80% {
			transform: translate(3px, 2px) rotate(-1deg);
		}
		90% {
			transform: translate(-2px, 1px) rotate(0deg);
		}
		100% {
			transform: translate(0, 0) rotate(0deg);
		}
	}
	:global(.shake-active) {
		animation: screenshake 0.4s ease-out;
	}

	/* Exit button pulse */
	@keyframes exit-pulse {
		0% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
		}
		70% {
			transform: scale(1.1);
			box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
		}
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}
	:global(.pulse-exit) {
		animation: exit-pulse 1.5s infinite !important;
		border-color: #f59e0b !important;
		color: #f59e0b !important;
	}
</style>
