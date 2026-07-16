<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { LobbyState } from '$lib/state/lobbyState.svelte';

	// Import extracted components
	import ProfileSelector from '$lib/components/lobby/ProfileSelector.svelte';
	import NoticeBoard from '$lib/components/lobby/NoticeBoard.svelte';
	import ProfileMenuDropdown from '$lib/components/lobby/ProfileMenuDropdown.svelte';
	import StatsModal from '$lib/components/lobby/StatsModal.svelte';
	import AccessLogsModal from '$lib/components/lobby/AccessLogsModal.svelte';
	import HistoryModal from '$lib/components/lobby/HistoryModal.svelte';
	import ArchiveModal from '$lib/components/lobby/ArchiveModal.svelte';
	import InviteModal from '$lib/components/lobby/InviteModal.svelte';
	import CreateProfileModal from '$lib/components/lobby/CreateProfileModal.svelte';

	const lobby = new LobbyState();

	onMount(async () => {
		await lobby.init();
	});

	let pollInterval: ReturnType<typeof setInterval> | undefined;

	function startPolling() {
		if (pollInterval) clearInterval(pollInterval);
		pollInterval = setInterval(async () => {
			if (lobby.activeProfile && !lobby.isLoading) {
				await lobby.loadGames();
			}
		}, 5000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = undefined;
		}
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') {
			if (lobby.activeProfile && !lobby.isLoading) {
				lobby.loadGames();
				startPolling();
			}
		} else {
			stopPolling();
		}
	}

	$effect(() => {
		if (lobby.activeProfile) {
			startPolling();
			document.addEventListener('visibilitychange', handleVisibilityChange);
		} else {
			stopPolling();
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		}

		return () => {
			stopPolling();
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	function normalizeTimestamp(timestamp: string): string {
		if (!timestamp) return timestamp;
		if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
			return timestamp.replace(' ', 'T') + 'Z';
		}
		return timestamp;
	}

	function timeAgo(timestamp: string) {
		if (!timestamp) return '';
		const seconds = Math.floor(
			(new Date().getTime() - new Date(normalizeTimestamp(timestamp)).getTime()) / 1000
		);
		let interval = Math.floor(seconds / 31536000);
		if (interval >= 1) return interval + ' år sedan';
		interval = Math.floor(seconds / 2592000);
		if (interval >= 1) return interval + ' mån sedan';
		interval = Math.floor(seconds / 86400);
		if (interval >= 1) return interval + ' dagar sedan';
		interval = Math.floor(seconds / 3600);
		if (interval >= 1) return interval + 'h sedan';
		interval = Math.floor(seconds / 60);
		if (interval >= 1) return interval + 'm sedan';
		return 'just nu';
	}
</script>

<div class="felt-overlay"></div>

<div
	class="font-nanum relative z-10 flex h-[var(--app-height)] w-full flex-col items-center overflow-hidden px-4 py-4 text-white md:py-8"
>
	<!-- The page itself never scrolls — only the games list and the profile grid
	     scroll internally, so the fixed background stays put on mobile. Children
	     use my-auto: auto margins center content that fits and collapse to zero
	     when space runs out. -->
	{#if lobby.isLoading}
		<!-- Simple Elegant loading spinner -->
		<div class="my-auto flex animate-pulse flex-col items-center gap-4">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"
			></div>
			<span class="text-sm font-bold tracking-widest text-amber-500/80 uppercase"
				>Loading Skitgubbe...</span
			>
		</div>
	{:else if !lobby.activeProfile}
		<!-- Netflix-Style Profile Selector Screen -->
		<ProfileSelector profiles={lobby.profiles} onSelectProfile={(id) => lobby.selectProfile(id)} />
	{:else}
		<!-- Main Game Hub View -->
		<picture class="lobby-background" transition:fade={{ duration: 300 }}>
			<source srcset="/bg-large.avif" type="image/avif" media="(min-width: 1921px)" />
			<source srcset="/bg-large.webp" type="image/webp" media="(min-width: 1921px)" />
			<source srcset="/bg-desktop.avif" type="image/avif" />
			<source srcset="/bg-desktop.webp" type="image/webp" />
			<img
				src="/bg-desktop.webp"
				alt="Lobby Background"
				class="h-full w-full object-cover object-center"
			/>
		</picture>
		<div
			class="relative my-auto grid max-h-full min-h-0 w-full max-w-5xl grid-cols-1 grid-rows-[auto_minmax(0,1fr)] items-start gap-8 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)] landscape:grid-cols-2 landscape:grid-rows-[minmax(0,1fr)]"
			in:fade={{ duration: 300 }}
		>
			<!-- Left column: Global Skitgubbe Calling Card / Poster -->
			<div
				class="skitgubbe-left-col flex w-full flex-col items-center justify-center pt-8 text-center md:pt-16"
				in:fade={{ duration: 300 }}
			>
				<NoticeBoard
					currentSkitgubbe={lobby.currentSkitgubbe}
					onShowHistory={() => lobby.openSkitgubbeHistory()}
				/>
			</div>

			<!-- Right column contains everything -->
			<div class="relative flex max-h-full min-h-0 w-full flex-col pt-12 md:pt-16">
				<!-- Fixed player chip in top right corner of window -->
				<ProfileMenuDropdown state={lobby} />

				<!-- Matchmaking Quick Actions at the top -->
				<div class="mb-6 flex w-full shrink-0 flex-col gap-3 px-3">
					<button
						onclick={() => {
							lobby.selectedInviteIds = [];
							lobby.newRoomName = '';
							lobby.showInviteModal = true;
						}}
						class="premium-action-btn"
					>
						<div class="btn-shimmer"></div>
						<span class="premium-action-btn-content">+ Nytt spel</span>
					</button>
				</div>

				<!-- Invitations List -->
				{#if lobby.pendingInvitations.length > 0}
					<div class="mb-8 flex shrink-0 flex-col gap-3">
						<div class="premium-room-list">
							{#each lobby.pendingInvitations as g (g.id)}
								<div class="premium-invite-card">
									<div class="premium-invite-content">
										<div class="room-info-block">
											<span class="room-title-text">
												{g.name || g.id}
											</span>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => lobby.declineGame(g.id)}
												class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-red-500 transition-all duration-200 hover:bg-red-500/20 active:scale-90"
												title="Decline"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-8 w-8"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="3"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
											<button
												onclick={() => lobby.acceptGame(g.id)}
												class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-emerald-500 transition-all duration-200 hover:bg-emerald-500/20 active:scale-90"
												title="Accept"
											>
												<svg
													xmlns="http://www.w3.org/2000/svg"
													class="h-8 w-8"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													stroke-width="3"
												>
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Rooms List -->
				{#if lobby.activeGames.length > 0}
					<div class="flex min-h-0 flex-col gap-3">
						{#if lobby.isArchiveMode}
							<!-- Archive selection controls header -->
							<div
								class="modal-inner-glass archive-selection-header mb-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-2.5"
							>
								<span class="text-xs font-bold tracking-wider text-red-400 uppercase">
									Välj rum att arkivera ({lobby.selectedGamesToArchive.length})
								</span>
								<div class="flex gap-2">
									<button
										onclick={() => {
											lobby.isArchiveMode = false;
											lobby.selectedGamesToArchive = [];
										}}
										class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 transition-all hover:text-white active:scale-95"
									>
										Avbryt
									</button>
									<button
										onclick={() => lobby.handleArchiveSelected()}
										disabled={lobby.selectedGamesToArchive.length === 0}
										class="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/25 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
									>
										Arkivera valda
									</button>
								</div>
							</div>
						{/if}

						<div
							class="premium-room-list custom-scrollbar max-h-[calc(var(--app-height)-200px)] min-h-0 overflow-y-auto"
						>
							{#each lobby.activeGames as g (g.id)}
								{#if lobby.isArchiveMode}
									<button
										onclick={() => lobby.toggleArchiveSelection(g.id)}
										class="premium-room-card text-left transition-all duration-200 {lobby.selectedGamesToArchive.includes(
											g.id
										)
											? 'border-red-500/40 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
											: ''}"
									>
										<div class="premium-room-content flex items-center justify-between">
											<div class="room-info-block flex items-center gap-3">
												<!-- Checkbox indicator -->
												<div
													class="flex h-5 w-5 items-center justify-center rounded border transition-all {lobby.selectedGamesToArchive.includes(
														g.id
													)
														? 'border-red-500 bg-red-500 text-white'
														: 'border-slate-600 bg-slate-950/50'}"
												>
													{#if lobby.selectedGamesToArchive.includes(g.id)}
														<svg
															xmlns="http://www.w3.org/2000/svg"
															class="h-3.5 w-3.5"
															viewBox="0 0 20 20"
															fill="currentColor"
														>
															<path
																fill-rule="evenodd"
																d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
																clip-rule="evenodd"
															/>
														</svg>
													{/if}
												</div>
												<div class="flex flex-col">
													<span class="room-title-text font-semibold text-slate-200">
														{g.name || g.id}
													</span>
													<span class="room-time-text text-[10px] text-slate-500"
														>{timeAgo(g.updated_at)}</span
													>
												</div>
											</div>
										</div>
									</button>
								{:else}
									<a
										href={`/room/${g.id}`}
										class="premium-room-card {g.is_my_turn && g.status === 'playing'
											? 'my-turn'
											: ''}"
									>
										<div class="turn-pulse-glow"></div>
										<div class="premium-room-content">
											<div class="room-info-block">
												<span class="room-title-text">
													{#if g.is_my_turn && g.status === 'playing'}
														<span class="gold-diamond">◆</span>
													{/if}{g.name || g.id}
												</span>
												{#if g.status === 'ended'}
													<span class="room-ended-badge">Slut (se resultat)</span>
												{:else}
													<span class="room-time-text">{timeAgo(g.updated_at)}</span>
												{/if}
											</div>

											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="room-chevron-icon"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2.5"
											>
												<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
											</svg>
										</div>
									</a>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Modals -->
<CreateProfileModal
	isOpen={lobby.showCreateModal}
	onClose={() => (lobby.showCreateModal = false)}
	bind:newProfileName={lobby.newProfileName}
	bind:newProfileColor={lobby.newProfileColor}
	createError={lobby.createError}
	onCreateProfile={(e) => {
		e.preventDefault();
		lobby.handleCreateProfile(lobby.newProfileName, lobby.newProfileColor);
	}}
/>

<StatsModal
	isOpen={lobby.showStatsModal}
	onClose={() => (lobby.showStatsModal = false)}
	profiles={lobby.profiles}
	allPlayersStats={lobby.allPlayersStats}
	activeProfileId={lobby.activeProfile?.id ?? ''}
	selectedStatsProfileId={lobby.selectedStatsProfileId}
	selectedPlayerBreakdown={lobby.selectedPlayerBreakdown}
	onSelectStatsProfile={(id) => lobby.handleSelectStatsProfile(id)}
	statsTab={lobby.statsTab}
	onTabChange={(tab) => (lobby.statsTab = tab)}
/>

<AccessLogsModal
	isOpen={lobby.showLogsModal}
	onClose={() => (lobby.showLogsModal = false)}
	accessLogs={lobby.accessLogs}
/>

<HistoryModal
	isOpen={lobby.showHistoryModal}
	onClose={() => (lobby.showHistoryModal = false)}
	skitgubbeHistory={lobby.skitgubbeHistory}
/>

<ArchiveModal
	isOpen={lobby.showArchiveModal}
	onClose={() => (lobby.showArchiveModal = false)}
	archivedGames={lobby.archivedGames}
	restoreGame={(roomId) => lobby.restoreGame(roomId)}
/>

<InviteModal
	isOpen={lobby.showInviteModal}
	onClose={() => (lobby.showInviteModal = false)}
	otherProfiles={lobby.otherProfiles}
	bind:selectedInviteIds={lobby.selectedInviteIds}
	bind:newRoomName={lobby.newRoomName}
	onCreateGameConfirm={() => lobby.handleCreateGameConfirm()}
/>

<style>
	.font-nanum {
		font-family: 'Nanum Brush Script', cursive;
	}

	.archive-selection-header {
		font-family: 'Cormorant Garamond', Georgia, serif;
	}

	.lobby-background {
		display: block;
		position: fixed;
		inset: 0;
		z-index: 0;
		pointer-events: none;
		user-select: none;
	}

	/* Premium Design Mockup Styles */
	.premium-room-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 0.5rem 0.75rem;
		/* Hide scrollbar for Chrome, Safari, and Opera */
		&::-webkit-scrollbar {
			display: none;
		}
		/* Hide scrollbar for IE, Edge, and Firefox */
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}

	.premium-room-card {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.1rem 2rem;
		background: linear-gradient(90deg, rgba(20, 20, 20, 0.85) 0%, rgba(28, 28, 28, 0.65) 100%);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transform: skewX(-15deg);
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		border: none;
		cursor: pointer;
		text-decoration: none;
		box-shadow:
			0 4px 25px rgba(255, 255, 255, 0.03),
			0 0 10px rgba(255, 255, 255, 0.01);
		overflow: hidden;
	}

	.premium-room-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 3.5px solid;
		border-image: linear-gradient(to bottom, #ffffff 0%, #cbd5e1 35%, #94a3b8 65%, #475569 100%) 1;
		pointer-events: none;
		transition: all 0.4s ease;
	}

	.premium-room-card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		border-right: 1px solid rgba(255, 255, 255, 0.03);
		pointer-events: none;
	}

	.premium-room-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		transform: skewX(15deg);
		font-family: 'Cormorant Garamond', Georgia, serif;
	}

	.room-info-block {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	.room-title-text {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
		transition: color 0.3s ease;
	}

	.room-time-text {
		font-size: 0.95rem;
		font-weight: 400;
		font-style: italic;
		color: rgba(255, 255, 255, 0.45);
		letter-spacing: 0.02em;
	}

	.room-ended-badge {
		font-size: 0.95rem;
		font-weight: 600;
		font-style: italic;
		color: #e3ba5a;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}

	.room-chevron-icon {
		width: 1.1rem;
		height: 1.1rem;
		color: rgba(255, 255, 255, 0.65);
		transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	}

	/* Turn glow states */
	.premium-room-card.my-turn::before {
		border-image: linear-gradient(
				to bottom,
				#ffe89e 0%,
				#e3ba5a 25%,
				#b88728 45%,
				#fceeac 55%,
				#d19f33 70%,
				#875c12 100%
			)
			1;
	}

	.premium-room-card.my-turn {
		background: linear-gradient(90deg, rgba(35, 25, 10, 0.85) 0%, rgba(20, 20, 20, 0.75) 100%);
		box-shadow:
			0 4px 25px rgba(217, 119, 6, 0.15),
			0 0 10px rgba(251, 191, 36, 0.05);
	}

	.premium-room-card.my-turn .room-title-text {
		color: #e3ba5a;
	}

	.gold-diamond {
		color: #e3ba5a;
		display: inline-block;
		margin-right: 0.5rem;
		font-size: 0.85em;
		vertical-align: middle;
	}

	.turn-pulse-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 10% 50%, rgba(251, 191, 36, 0.12) 0%, transparent 70%);
		opacity: 0;
		pointer-events: none;
		animation: premium-pulse 3s infinite alternate ease-in-out;
	}

	.premium-room-card.my-turn .turn-pulse-glow {
		opacity: 1;
	}

	@keyframes premium-pulse {
		0% {
			opacity: 0.3;
		}
		100% {
			opacity: 0.8;
		}
	}

	/* Card hover effects */
	.premium-room-card:hover {
		background: linear-gradient(90deg, rgba(30, 30, 30, 0.9) 0%, rgba(40, 40, 40, 0.75) 100%);
		transform: skewX(-15deg) translateY(-2px);
		box-shadow:
			0 8px 30px rgba(255, 255, 255, 0.08),
			0 0 15px rgba(255, 255, 255, 0.03);
	}

	.premium-room-card.my-turn:hover {
		box-shadow:
			0 8px 30px rgba(217, 119, 6, 0.25),
			0 0 15px rgba(251, 191, 36, 0.1);
	}

	.premium-room-card:hover::before {
		border-image: linear-gradient(
				to bottom,
				#ffffff 0%,
				#f1f5f9 20%,
				#cbd5e1 45%,
				#ffffff 60%,
				#94a3b8 80%,
				#475569 100%
			)
			1;
	}

	.premium-room-card.my-turn:hover::before {
		border-image: linear-gradient(
				to bottom,
				#ffffff 0%,
				#ffe89e 20%,
				#e3ba5a 45%,
				#fceeac 60%,
				#d19f33 80%,
				#875c12 100%
			)
			1;
	}

	.premium-room-card:hover .room-chevron-icon {
		color: #ffffff;
		transform: translateX(4px);
	}

	/* Premium Action Button for Create Game (Polished Gold Theme) */
	.premium-action-btn {
		position: relative;
		width: 100%;
		padding: 1rem 2rem;
		background: linear-gradient(
			135deg,
			#ffe89e 0%,
			#e3ba5a 25%,
			#b88728 45%,
			#fceeac 55%,
			#d19f33 70%,
			#875c12 100%
		);
		color: #261600;
		font-weight: 850;
		font-size: 1.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		transform: skewX(-15deg);
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		border: none;
		cursor: pointer;
		box-shadow:
			0 4px 20px rgba(135, 92, 18, 0.4),
			inset 0 1px 3px rgba(255, 255, 255, 0.6);
		font-family: 'Cormorant Garamond', Georgia, serif;
		overflow: hidden;
	}

	/* Inner golden rim light */
	.premium-action-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 2px solid rgba(255, 255, 255, 0.85);
		border-top: 2px solid rgba(255, 255, 255, 0.85);
		border-bottom: 2px solid rgba(138, 93, 2, 0.7);
		border-right: 2px solid rgba(138, 93, 2, 0.3);
		pointer-events: none;
		opacity: 0.65;
		transition: opacity 0.3s ease;
	}

	.premium-action-btn:hover {
		background: linear-gradient(
			135deg,
			#ffffff 0%,
			#ecc66b 20%,
			#cb9935 40%,
			#fff3be 55%,
			#e0ad3c 75%,
			#966919 100%
		);
		transform: skewX(-15deg) translateY(-2px);
		box-shadow:
			0 6px 25px rgba(212, 175, 55, 0.45),
			inset 0 1px 4px rgba(255, 255, 255, 0.8);
	}

	.premium-action-btn:hover::before {
		opacity: 0.95;
	}

	.premium-action-btn:active {
		transform: skewX(-15deg) translateY(0);
		box-shadow: 0 2px 10px rgba(212, 175, 55, 0.2);
	}

	.premium-action-btn-content {
		transform: skewX(15deg);
		display: inline-block;
		position: relative;
		z-index: 2;
		color: #261600;
		font-weight: 850;
		text-shadow: 0 1px 0px rgba(255, 255, 255, 0.3);
	}

	/* Periodic Diagonal Shimmer Animation */
	.btn-shimmer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
		overflow: hidden;
	}

	.btn-shimmer::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -150%;
		width: 100%;
		height: 200%;
		background: linear-gradient(
			115deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0) 35%,
			rgba(255, 255, 255, 0.7) 50%,
			rgba(255, 255, 255, 0) 65%,
			rgba(255, 255, 255, 0) 100%
		);
		transform: skewX(-15deg);
		animation: gold-shimmer-sweep 7s infinite ease-in-out;
	}

	@keyframes gold-shimmer-sweep {
		0% {
			left: -150%;
		}
		18%,
		100% {
			left: 150%;
		}
	}

	/* Premium Invite Cards */
	.premium-invite-card {
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.1rem 2rem;
		background: linear-gradient(90deg, rgba(217, 119, 6, 0.15) 0%, rgba(20, 20, 20, 0.75) 100%);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transform: skewX(-15deg);
		transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
		border: none;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}

	.premium-invite-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 2.5px solid;
		border-bottom: 2.5px solid;
		border-image: linear-gradient(
				135deg,
				#f59e0b 0%,
				#d97706 40%,
				rgba(217, 119, 6, 0.1) 90%,
				transparent 100%
			)
			2;
		pointer-events: none;
	}

	.premium-invite-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		transform: skewX(15deg);
		font-family: 'Cormorant Garamond', Georgia, serif;
	}
</style>
