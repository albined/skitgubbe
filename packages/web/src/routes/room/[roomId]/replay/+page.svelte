<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ReplayState } from '$lib/state/replayState.svelte';
	import { hideGameStatusBar, showGameStatusBar } from '$lib/platform/gameSystemBars';

	import Sidebar from '$lib/components/room/Sidebar.svelte';
	import ReplayPlayersRow from '$lib/components/replay/ReplayPlayersRow.svelte';
	import ReplayTable from '$lib/components/replay/ReplayTable.svelte';
	import ReplayHand from '$lib/components/replay/ReplayHand.svelte';
	import ReplayTimeline from '$lib/components/replay/ReplayTimeline.svelte';
	import ReplayLog from '$lib/components/replay/ReplayLog.svelte';

	const roomId = $page.params.roomId || '';
	const replayState = new ReplayState(roomId);

	const onNativeResume = () => {
		hideGameStatusBar();
	};

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (!replayState.replay || target.closest('input, textarea')) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			e.preventDefault();
			replayState.step(e.key === 'ArrowRight' ? 1 : -1);
		} else if (e.key === 'Home' || e.key === 'End') {
			e.preventDefault();
			replayState.seek(e.key === 'Home' ? replayState.first : replayState.last);
		}
	}

	onMount(async () => {
		hideGameStatusBar();
		window.addEventListener('skitgubbe:native-resume', onNativeResume);
		await replayState.load();
		// Games without a usable move log keep today's end screen.
		if (replayState.loadError === 'missing') {
			goto(`/room/${roomId}`, { replaceState: true });
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('skitgubbe:native-resume', onNativeResume);
		}
		showGameStatusBar();
		replayState.destroy();
	});
</script>

<svelte:window
	bind:innerHeight={replayState.innerHeight}
	bind:innerWidth={replayState.innerWidth}
	onkeydown={handleKeydown}
/>

<div class="felt-overlay"></div>

<div
	class="game-layout relative flex h-screen w-screen flex-col justify-between overflow-hidden select-none"
	style="--card-width: {replayState.cardWidth}px; --card-height: {replayState.cardWidth * 1.4}px;"
>
	{#if replayState.gameState && replayState.replay}
		{@const gameState = replayState.gameState}
		{@const viewerId = replayState.replay.viewerId}
		<div class="flex w-full flex-grow">
			<Sidebar
				{gameState}
				localPlayerId={viewerId}
				isHumanTurn={false}
				connectionStatus="connected"
			/>

			<div class="relative flex flex-grow flex-col">
				<ReplayPlayersRow
					{gameState}
					{viewerId}
					handOwnerId={replayState.handOwnerId}
					onShowHand={(id) => replayState.showHand(id)}
				/>

				<main
					class="board-game-zone relative mx-auto flex w-full max-w-5xl flex-grow items-center justify-center overflow-visible px-4"
				>
					<!-- Ornate felt inner circle rim -->
					<div
						class="pointer-events-none absolute inset-0 my-12 rounded-full border opacity-20"
						style="border-color: var(--felt-rim-color);"
					></div>
					<ReplayTable {gameState} {viewerId} trumpSuit={replayState.trumpSuit} />
				</main>
			</div>
		</div>

		<footer class="game-footer relative z-10 flex w-full flex-col items-center">
			{#key replayState.handOwnerId}
				<ReplayHand
					cards={replayState.hand}
					cardWidth={replayState.cardWidth}
					trumpSuit={replayState.trumpSuit}
				/>
			{/key}
			<ReplayTimeline {replayState} />
		</footer>

		<button
			onclick={() => (replayState.showLog = !replayState.showLog)}
			class="gold-trimmed-btn absolute top-4 right-4 z-30 h-10 w-10"
			title="Toggle Game Log"
			aria-label="Toggle game log"
			aria-expanded={replayState.showLog}
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

		<ReplayLog {replayState} />
	{:else if replayState.loadError === 'failed'}
		<p class="m-auto font-mono text-xs tracking-wider text-slate-400 uppercase">
			Spelet kunde inte laddas.
		</p>
	{/if}

	<!-- Exit to Lobby Button in Top Left -->
	<a
		href="/"
		class="gold-trimmed-btn absolute top-4 left-4 z-30 h-10 w-10"
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
</div>

<!-- Cards in flight between the table, the hand and the players -->
<div bind:this={replayState.flights.layer} class="pointer-events-none fixed inset-0 z-[35]"></div>

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
