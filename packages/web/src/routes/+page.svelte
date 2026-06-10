<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';

	// State Variables
	let activeProfile = $state<any>(null);
	let profiles = $state<any[]>([]);
	let games = $state<any[]>([]);
	let isLoading = $state(true);

	// Profile Creation Form State
	let showCreateModal = $state(false);
	let newProfileName = $state('');
	let newProfileColor = $state('#3b82f6');
	let createError = $state('');

	// Access Logs State
	let showLogsModal = $state(false);
	let accessLogs = $state<any[]>([]);

	// Statistics dashboard state
	let showStatsModal = $state(false);
	let showProfileDropdown = $state(false);
	let statsTab = $state<'all' | 'personal'>('all');
	let allPlayersStats = $state<any[]>([]);
	let selectedStatsProfileId = $state<string>('');
	let selectedPlayerBreakdown = $state<any>(null);
	const selectedStatsProfile = $derived(profiles.find((p: any) => p.id === selectedStatsProfileId));

	// Skitgubbe dashboard state
	let currentSkitgubbe = $state<any>(null);
	let showHistoryModal = $state(false);
	let skitgubbeHistory = $state<any[]>([]);

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (showProfileDropdown && !target.closest('.profile-chip-container')) {
			showProfileDropdown = false;
		}
	}

	const PRESET_COLORS = [
		'#3b82f6', // blue
		'#10b981', // emerald
		'#f59e0b', // amber
		'#ef4444', // red
		'#8b5cf6', // violet
		'#ec4899', // pink
		'#14b8a6', // teal
		'#f97316', // orange
	];

	// Initial Loader
	onMount(async () => {
		await checkAuth();
		await loadProfiles();
		await loadCurrentSkitgubbe();
		isLoading = false;
	});

	async function loadCurrentSkitgubbe() {
		try {
			const res = await fetch('/api/skitgubbe/current');
			if (res.ok) {
				currentSkitgubbe = await res.json();
			}
		} catch (e) {
			console.error('Failed to load current skitgubbe:', e);
		}
	}

	async function openSkitgubbeHistory() {
		showHistoryModal = true;
		try {
			const res = await fetch('/api/skitgubbe/history');
			if (res.ok) {
				skitgubbeHistory = await res.json();
			}
		} catch (e) {
			console.error('Failed to load skitgubbe history:', e);
		}
	}

	async function openStatsDashboard() {
		showStatsModal = true;
		statsTab = 'all';
		selectedStatsProfileId = activeProfile?.id || '';
		await loadAllStats();
		await loadPlayerBreakdown(selectedStatsProfileId);
	}

	async function loadAllStats() {
		try {
			const res = await fetch('/api/statistics');
			if (res.ok) {
				allPlayersStats = await res.json();
			}
		} catch (e) {
			console.error('Failed to load all stats:', e);
		}
	}

	async function loadAccessLogs() {
		try {
			const res = await fetch('/api/profiles/me/logs');
			if (res.ok) {
				accessLogs = await res.json();
			}
		} catch (e) {
			console.error('Failed to load access logs:', e);
		}
	}

	async function loadPlayerBreakdown(profileId: string) {
		if (!profileId) return;
		try {
			const res = await fetch(`/api/statistics/${profileId}`);
			if (res.ok) {
				selectedPlayerBreakdown = await res.json();
			}
		} catch (e) {
			console.error('Failed to load player breakdown:', e);
		}
	}

	function handleSelectStatsProfile(profileId: string) {
		selectedStatsProfileId = profileId;
		loadPlayerBreakdown(profileId);
	}

	// Check if authenticated
	async function checkAuth() {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				activeProfile = await res.json();
				// Sync to local/session storage for backward compatibility with the game room
				sessionStorage.setItem('skitgubbe_playerId', activeProfile.id);
				sessionStorage.setItem('skitgubbe_playerName', activeProfile.name);
				sessionStorage.setItem('skitgubbe_playerColor', activeProfile.color);
				await loadGames();
			} else {
				activeProfile = null;
			}
		} catch (e) {
			console.error('Auth check failed:', e);
			activeProfile = null;
		}
	}

	// Load list of profiles
	async function loadProfiles() {
		try {
			const res = await fetch('/api/profiles');
			if (res.ok) {
				profiles = await res.json();
			}
		} catch (e) {
			console.error('Failed to load profiles:', e);
		}
	}

	// Load active games for the current profile
	async function loadGames() {
		try {
			const res = await fetch('/api/games');
			if (res.ok) {
				games = await res.json();
			}
		} catch (e) {
			console.error('Failed to load games:', e);
		}
	}

	// Profile Creation
	async function handleCreateProfile(e: Event) {
		e.preventDefault();
		const name = newProfileName.trim();
		if (!name) {
			createError = 'Please enter a name.';
			return;
		}
		createError = '';

		try {
			const res = await fetch('/api/profiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, color: newProfileColor })
			});

			if (res.ok) {
				const profile = await res.json();
				newProfileName = '';
				newProfileColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
				showCreateModal = false;
				await loadProfiles();
				// Automatically select the newly created profile
				await selectProfile(profile.id);
			} else {
				const data = await res.json();
				createError = data.error || 'Failed to create profile.';
			}
		} catch (e) {
			createError = 'Server error occurred.';
		}
	}

	// Select a profile and enter the hub
	async function selectProfile(id: string) {
		try {
			const res = await fetch(`/api/profiles/${id}/select`, { method: 'POST' });
			if (res.ok) {
				await checkAuth();
			}
		} catch (e) {
			console.error('Failed to select profile:', e);
		}
	}

	// Logout
	async function handleLogout() {
		try {
			const res = await fetch('/api/profiles/logout', { method: 'POST' });
			if (res.ok) {
				activeProfile = null;
				games = [];
				// Clear storage helpers
				sessionStorage.removeItem('skitgubbe_playerId');
				sessionStorage.removeItem('skitgubbe_playerName');
				sessionStorage.removeItem('skitgubbe_playerColor');
				await loadProfiles();
			}
		} catch (e) {
			console.error('Logout failed:', e);
		}
	}

	// State for invite modal
	let showInviteModal = $state(false);
	let selectedInviteIds = $state<string[]>([]);
	let newRoomName = $state('');

	// State for invite modal drag-to-scroll
	let isDragging = $state(false);
	let dragMoved = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragScrollLeft = 0;
	let scrollContainer = $state<HTMLDivElement | null>(null);

	function handleMouseDown(e: MouseEvent) {
		if (!scrollContainer) return;
		isDragging = true;
		dragMoved = false;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragScrollLeft = scrollContainer.scrollLeft;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !scrollContainer) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
			dragMoved = true;
		}
		if (dragMoved) {
			scrollContainer.style.scrollSnapType = 'none';
			scrollContainer.scrollLeft = dragScrollLeft - dx;
		}
	}

	function handleMouseUp() {
		if (isDragging && scrollContainer) {
			scrollContainer.style.scrollSnapType = '';
		}
		isDragging = false;
	}

	// Create Game
	async function handleCreateGameConfirm() {
		try {
			const res = await fetch('/api/games/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newRoomName, invitedProfileIds: selectedInviteIds })
			});
			if (res.ok) {
				const data = await res.json();
				showInviteModal = false;
				selectedInviteIds = [];
				newRoomName = '';
				window.location.href = `/room/${data.roomId}`;
			}
		} catch (e) {
			console.error('Failed to create game:', e);
		}
	}



	async function acceptGame(roomId: string) {
		try {
			const res = await fetch(`/api/games/${roomId}/accept`, { method: 'POST' });
			if (res.ok) {
				await loadGames();
				window.location.href = `/room/${roomId}`;
			}
		} catch (e) {
			console.error('Failed to accept game:', e);
		}
	}

	async function declineGame(roomId: string) {
		try {
			const res = await fetch(`/api/games/${roomId}/decline`, { method: 'POST' });
			if (res.ok) {
				await loadGames();
			}
		} catch (e) {
			console.error('Failed to decline game:', e);
		}
	}

	const pendingInvitations = $derived(games.filter(g => g.invite_status === 'pending'));
	const activeGames = $derived(games.filter(g => g.invite_status === 'accepted'));
	const otherProfiles = $derived(profiles.filter(p => p.id !== activeProfile?.id));

	// Normalize a SQLite UTC timestamp (no 'Z') to proper ISO 8601 so JS parses it as UTC
	function normalizeTimestamp(timestamp: string): string {
		if (!timestamp) return timestamp;
		// SQLite CURRENT_TIMESTAMP: "2026-06-07 17:56:52" — no Z, space instead of T
		// Without Z, JS parses it as local time, causing a timezone offset bug
		if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
			return timestamp.replace(' ', 'T') + 'Z';
		}
		return timestamp;
	}

	// Format timestamp helper
	function formatTime(timestamp: string) {
		if (!timestamp) return '';
		const d = new Date(normalizeTimestamp(timestamp));
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function timeAgo(timestamp: string) {
		if (!timestamp) return '';
		const seconds = Math.floor((new Date().getTime() - new Date(normalizeTimestamp(timestamp)).getTime()) / 1000);
		let interval = Math.floor(seconds / 31536000);
		if (interval >= 1) return interval + 'y ago';
		interval = Math.floor(seconds / 2592000);
		if (interval >= 1) return interval + 'mo ago';
		interval = Math.floor(seconds / 86400);
		if (interval >= 1) return interval + 'd ago';
		interval = Math.floor(seconds / 3600);
		if (interval >= 1) return interval + 'h ago';
		interval = Math.floor(seconds / 60);
		if (interval >= 1) return interval + 'm ago';
		return 'just now';
	}
</script>

<svelte:window 
	onclick={handleWindowClick} 
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
/>

<div class="felt-overlay"></div>

<div class="relative z-10 w-full min-h-screen flex flex-col justify-center items-center text-white px-4 py-4 md:py-8 font-nanum">
	{#if isLoading}
		<!-- Simple Elegant loading spinner -->
		<div class="flex flex-col items-center gap-4 animate-pulse">
			<div class="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
			<span class="text-sm font-bold text-amber-500/80 tracking-widest uppercase">Loading Skitgubbe...</span>
		</div>
	{:else if !activeProfile}
		<!-- Netflix-Style Profile Selector Screen -->
		<div class="w-full max-w-4xl flex flex-col items-center gap-10" in:fade={{ duration: 300 }}>
			<div class="text-center">
				<h1 class="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 drop-shadow-md">
					Skitgubbe
				</h1>
				<p class="text-slate-300 text-2xl mt-3 tracking-wide">Who's playing today?</p>
			</div>

			<!-- Profile Select Grid -->
			<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 justify-center items-center py-6">
				{#each profiles as p}
					<button
						onclick={() => selectProfile(p.id)}
						class="group flex flex-col items-center gap-3 bg-transparent border-0 cursor-pointer focus:outline-none transition-transform duration-200 hover:scale-105"
					>
						<div
							class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-5xl font-black uppercase text-white shadow-xl relative transition-all duration-300 border-2 border-transparent group-hover:border-yellow-400 overflow-hidden"
							style="background-color: {p.color}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.25);"
						>
							<Avatar avatarConfig={p.avatar_config} fallbackColor={p.color} fallbackName={p.name} class="w-full h-full rounded-2xl" />
							
							<!-- Soft Inner Radial Glow -->
							<div class="absolute inset-0 bg-radial from-white/10 to-transparent rounded-2xl"></div>
						</div>
						<span class="text-xl text-slate-300 group-hover:text-white transition-colors duration-200 truncate w-24 sm:w-28 text-center">
							{p.name}
						</span>
					</button>
				{/each}

				<!-- Add New Profile Button -->
				<button
					onclick={() => {
						window.location.href = '/avatar?new=true';
					}}
					class="group flex flex-col items-center gap-3 bg-transparent border-0 cursor-pointer focus:outline-none transition-transform duration-200 hover:scale-105"
				>
					<div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-slate-600 group-hover:border-slate-300 bg-slate-900/30 group-hover:bg-slate-900/50 flex items-center justify-center text-slate-500 group-hover:text-slate-300 transition-all duration-300 shadow-lg">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</div>
					<span class="text-xl text-slate-500 group-hover:text-slate-300 transition-colors duration-200">
						Add Profile
					</span>
				</button>
			</div>
		</div>
	{:else}
		<!-- Main Game Hub View -->
		<div class="lobby-background" transition:fade={{ duration: 300 }}></div>
		<div class="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 landscape:grid-cols-2 gap-8 items-start relative" in:fade={{ duration: 300 }}>
			
			<!-- Left column: Global Skitgubbe Calling Card / Poster -->
			<div class="skitgubbe-left-col flex flex-col items-center justify-center pt-8 md:pt-16 w-full text-center" in:fade={{ duration: 300 }}>
				{#if currentSkitgubbe}
					<button
						onclick={openSkitgubbeHistory}
						class="skitgubbe-poster group focus:outline-none"
					>
						<div class="absolute inset-x-0 bottom-0 h-[75%] flex flex-col items-center justify-center pb-[12%] gap-2">
							<div
								class="relative w-[48%] aspect-square rounded-2xl flex items-center justify-center p-0 overflow-hidden border border-slate-700/50 group-hover:border-slate-500 transition-all duration-300 bg-slate-950/85"							>
								<Avatar avatarConfig={currentSkitgubbe.avatar_config} fallbackColor={currentSkitgubbe.color} fallbackName={currentSkitgubbe.name} class="w-full h-full rounded-2xl" />
								
								<div class="absolute inset-0 bg-radial from-white/5 to-transparent"></div>
							</div>
							<span class="skitgubbe-poster-name truncate max-w-[85%] select-none leading-none">
								{currentSkitgubbe.name}
							</span>
						</div>
					</button>
				{:else}
					<div class="relative w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/60 p-6 md:p-8 backdrop-blur-md shadow-2xl flex flex-col items-center gap-6 overflow-hidden group">
						<div class="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 flex items-center justify-center text-slate-500 text-5xl">
							👑
						</div>
						<div class="flex flex-col items-center gap-1">
							<span class="text-lg font-semibold text-slate-400 font-serif">No Skitgubbe Crowned</span>
							<span class="text-xs text-slate-500 max-w-[200px]">Play a game to completion to crown the first Skitgubbe!</span>
						</div>
					</div>
				{/if}
			</div>
			
			<!-- Right column contains everything -->
			<div class="flex flex-col w-full relative pt-12 md:pt-16">
				
				<!-- Fixed player chip in top right corner of window -->
				<div class="fixed top-4 right-4 z-50 profile-chip-container">
					<button 
						onclick={() => showProfileDropdown = !showProfileDropdown}
						class="flex items-center gap-2 px-2 py-1 bg-transparent border-0 cursor-pointer shadow-none focus:outline-none text-slate-200 hover:text-white"
					>
						<Avatar avatarConfig={activeProfile.avatar_config} fallbackColor={activeProfile.color} fallbackName={activeProfile.name} class="w-5 h-5 rounded-full" />
						<span class="text-base font-semibold">{activeProfile.name}</span>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400 transition-transform duration-200 {showProfileDropdown ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					
					{#if showProfileDropdown}
						<div class="absolute right-0 mt-2 w-48 premium-modal-container z-50 py-1.5" style="position: absolute;" transition:fade={{ duration: 100 }}>
							<button 
								onclick={() => { window.location.href = '/avatar'; showProfileDropdown = false; }} 
								class="w-full text-left px-4 py-2 text-sm text-amber-400 hover:text-amber-250 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 font-semibold"
							>
								🎨 Avatar Editor
							</button>
							<div class="h-[1px] bg-white/5 my-1"></div>
							<button
								onclick={() => { loadAccessLogs(); showLogsModal = true; showProfileDropdown = false; }}
								class="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
								Recent Logins
							</button>
							<div class="h-[1px] bg-white/5 my-1"></div>
							<button 
								onclick={() => { openStatsDashboard(); showProfileDropdown = false; }} 
								class="w-full text-left px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
							>
								📊 Profile Stats
							</button>
							<div class="h-[1px] bg-white/5 my-1"></div>
							<button 
								onclick={handleLogout} 
								class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2"
							>
								<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1" />
								</svg>
								Logout / Switch
							</button>
						</div>
					{/if}
				</div>

				<!-- Matchmaking Quick Actions at the top -->
				<div class="flex flex-col gap-3 w-full mb-6 px-3">
					<button 
						onclick={() => { selectedInviteIds = []; newRoomName = ''; showInviteModal = true; }} 
						class="premium-action-btn"
					>
						<div class="btn-shimmer"></div>
						<span class="premium-action-btn-content">+ Create Game</span>
					</button>
				</div>

				<!-- Invitations List -->
				{#if pendingInvitations.length > 0}
					<div class="flex flex-col gap-3 mb-8">
						<div class="premium-room-list">
							{#each pendingInvitations as g}
								<div class="premium-invite-card">
									<div class="premium-invite-content">
										<div class="room-info-block">
											<span class="room-title-text">
												{g.name || g.id}
											</span>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => declineGame(g.id)}
												class="w-12 h-12 rounded-full hover:bg-red-500/20 text-red-500 cursor-pointer transition-all duration-200 flex items-center justify-center active:scale-90"
												title="Decline"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
													<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
											<button
												onclick={() => acceptGame(g.id)}
												class="w-12 h-12 rounded-full hover:bg-emerald-500/20 text-emerald-500 cursor-pointer transition-all duration-200 flex items-center justify-center active:scale-90"
												title="Accept"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
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
				{#if activeGames.length === 0}
					{#if pendingInvitations.length === 0}
						<div class="flex flex-col items-center justify-center py-16 text-center gap-3">
							<div class="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-lg">
								📭
							</div>
							<p class="text-base text-slate-500">You aren't active on any game tables.</p>
						</div>
					{/if}
				{:else}
					<div class="flex flex-col gap-3">
						<div class="premium-room-list overflow-y-auto max-h-[calc(100vh-200px)]">
							{#each activeGames as g}
								<a 
									href={`/room/${g.id}`}
									class="premium-room-card {g.is_my_turn && g.status === 'playing' ? 'my-turn' : ''}"
								>
									<div class="turn-pulse-glow"></div>
									<div class="premium-room-content">
										<div class="room-info-block">
											<span class="room-title-text">
												{#if g.is_my_turn && g.status === 'playing'}
													<span class="gold-diamond">◆</span>
												{/if}{g.name || g.id}
											</span>
											<span class="room-time-text">{timeAgo(g.updated_at)}</span>
										</div>

										<svg xmlns="http://www.w3.org/2000/svg" class="room-chevron-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/if}

			</div>
		</div>
	{/if}
</div>

<!-- Add Profile Modal Overlay -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/10 flex flex-col gap-6 shadow-2xl" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100">Create New Profile</h2>
				<p class="text-slate-400 text-sm mt-1">Select a name and pick your player color theme</p>
			</div>

			<form onsubmit={handleCreateProfile} class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<label for="new_username" class="text-xs font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
					<input
						id="new_username"
						type="text"
						bind:value={newProfileName}
						placeholder="E.g. Spade Ace"
						class="px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-lg"
						maxlength="15"
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Color Theme</span>
					<div class="grid grid-cols-4 gap-3">
						{#each PRESET_COLORS as color}
							<button
								type="button"
								onclick={() => newProfileColor = color}
								class="w-full aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-105 cursor-pointer shadow-md"
								style="background-color: {color}; border-color: {newProfileColor === color ? '#ffd700' : 'transparent'};"
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
				</div>

				{#if createError}
					<span class="text-red-400 text-xs text-center font-semibold">{createError}</span>
				{/if}

				<div class="flex gap-3 mt-2">
						<button
							type="button"
							onclick={() => showCreateModal = false}
							class="flex-1 premium-modal-btn premium-modal-btn-secondary"
						>
							<span class="premium-modal-btn-content">Cancel</span>
						</button>
						<button
							type="submit"
							class="flex-1 premium-modal-btn premium-modal-btn-primary"
						>
							<span class="premium-modal-btn-content">Create & Play</span>
						</button>
					</div>
			</form>
		</div>
	</div>
{/if}

<!-- Stats Dashboard Modal Overlay -->
{#if showStatsModal}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="premium-modal-container max-w-4xl w-full p-6 md:p-8 flex flex-col gap-6 max-h-[90vh] overflow-hidden" transition:scale={{ duration: 200, start: 0.95 }}>
			
			<!-- Modal Header -->
			<div class="flex flex-col sm:flex-row justify-between items-center pb-4 border-b border-white/5 gap-4">
				<div class="text-center sm:text-left">
					<h2 class="text-3xl font-bold text-slate-100 flex items-center gap-2 font-serif uppercase tracking-wide">
						Leaderboard & Stats
					</h2>
				</div>
				
				<!-- Tabs -->
				<div class="premium-tab-container">
					<button
						type="button"
						onclick={() => statsTab = 'all'}
						class="premium-tab-btn {statsTab === 'all' ? 'premium-tab-btn-active' : 'premium-tab-btn-inactive'}"
					>
						All Players
					</button>
					<button
						type="button"
						onclick={() => statsTab = 'personal'}
						class="premium-tab-btn {statsTab === 'personal' ? 'premium-tab-btn-active' : 'premium-tab-btn-inactive'}"
					>
						Personal Breakdown
					</button>
				</div>
			</div>

			<!-- Modal Content (Scrollable Container) -->
			<div class="flex-1 overflow-y-auto pr-1">
				{#if statsTab === 'all'}
					<!-- All Players Table -->
					<div class="premium-table-container overflow-x-auto w-full">
						<table class="premium-table">
							<thead>
								<tr class="stats-table-header">
									<th class="py-3 px-4">Player</th>
									<th class="py-3 px-4 text-center">Games</th>
									<th class="py-3 px-4 text-center text-red-400">Skitgubbe</th>
									<th class="py-3 px-4 text-center text-pink-400">Sweetgubbe</th>
									<th class="py-3 px-4 text-center text-blue-400">Trumfman</th>
									<th class="py-3 px-4 text-center text-amber-400">Constipated</th>
								</tr>
							</thead>
							<tbody class="">
								{#each allPlayersStats as row}
									<tr 
										class="stats-table-row cursor-pointer {row.id === activeProfile?.id ? 'bg-amber-500/5' : ''}"
										onclick={() => { statsTab = 'personal'; handleSelectStatsProfile(row.id); }}
									>
										<td class="py-3 px-4 flex items-center gap-3 font-semibold">
											<Avatar avatarConfig={row.avatar_config} fallbackColor={row.color} fallbackName={row.name} class="w-8 h-8 rounded-lg" />
											<span>{row.name}</span>
										</td>
										<td class="py-3 px-4 text-center font-bold text-slate-100">{row.games}</td>
										<td class="py-3 px-4 text-center font-bold text-red-400/90">{row.skitgubbe}</td>
										<td class="py-3 px-4 text-center font-bold text-pink-400/90">{row.sweetgubbe}</td>
										<td class="py-3 px-4 text-center font-bold text-blue-400/90">{row.trumfman}</td>
										<td class="py-3 px-4 text-center font-bold text-amber-400/90">
											{row.constipated} <span class="text-[10px] text-amber-500/60 font-medium">(Mega: {row.mega_constipated})</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<!-- Personal Breakdown -->
					<div class="flex flex-col gap-6">
						<!-- Profile Selector Dropdown inside Breakdown -->
						<div class="flex flex-col sm:flex-row justify-between items-center modal-inner-glass p-4 gap-4">
							<div class="flex items-center gap-3">
								{#if selectedStatsProfile}
									<Avatar avatarConfig={selectedStatsProfile.avatar_config} fallbackColor={selectedStatsProfile.color} fallbackName={selectedStatsProfile.name} class="w-12 h-12 rounded-xl" />
									<div class="flex flex-col">
										<span class="text-lg font-bold text-slate-100">{selectedStatsProfile.name}</span>
										<span class="text-xs text-slate-500">View detailed statistics timeline</span>
									</div>
								{/if}
							</div>
							
							<select 
								value={selectedStatsProfileId}
								onchange={(e) => handleSelectStatsProfile((e.target as HTMLSelectElement).value)}
								class="px-4 py-2 modal-inner-glass text-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer font-semibold"
							>
								{#each profiles as p}
									<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</div>

						<!-- Personal Breakdown Table -->
						{#if selectedPlayerBreakdown}
							<div class="premium-table-container overflow-x-auto w-full">
								<table class="premium-table">
									<thead>
										<tr class="stats-table-header">
											<th class="py-3 px-4">Time Window</th>
											<th class="py-3 px-4 text-center">Games</th>
											<th class="py-3 px-4 text-center text-red-400">Skitgubbe</th>
											<th class="py-3 px-4 text-center text-pink-400">Sweetgubbe</th>
											<th class="py-3 px-4 text-center text-blue-400">Trumfman</th>
											<th class="py-3 px-4 text-center text-amber-400">Constipated</th>
										</tr>
									</thead>
									<tbody class="">
										<!-- Last 10 games row -->
										<tr class="hover:bg-white/5 transition-colors">
											<td class="py-3 px-4 font-bold text-slate-300">Last 10 Games</td>
											<td class="py-3 px-4 text-center font-bold text-slate-100">{selectedPlayerBreakdown.last10.games}</td>
											<td class="py-3 px-4 text-center font-bold text-red-400/90">{selectedPlayerBreakdown.last10.skitgubbe}</td>
											<td class="py-3 px-4 text-center font-bold text-pink-400/90">{selectedPlayerBreakdown.last10.sweetgubbe}</td>
											<td class="py-3 px-4 text-center font-bold text-blue-400/90">{selectedPlayerBreakdown.last10.trumfman}</td>
											<td class="py-3 px-4 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last10.constipated} <span class="text-[10px] text-amber-500/60 font-medium">(Mega: {selectedPlayerBreakdown.last10.mega_constipated})</span>
											</td>
										</tr>
										<!-- Last 50 games row -->
										<tr class="hover:bg-white/5 transition-colors">
											<td class="py-3 px-4 font-bold text-slate-300">Last 50 Games</td>
											<td class="py-3 px-4 text-center font-bold text-slate-100">{selectedPlayerBreakdown.last50.games}</td>
											<td class="py-3 px-4 text-center font-bold text-red-400/90">{selectedPlayerBreakdown.last50.skitgubbe}</td>
											<td class="py-3 px-4 text-center font-bold text-pink-400/90">{selectedPlayerBreakdown.last50.sweetgubbe}</td>
											<td class="py-3 px-4 text-center font-bold text-blue-400/90">{selectedPlayerBreakdown.last50.trumfman}</td>
											<td class="py-3 px-4 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last50.constipated} <span class="text-[10px] text-amber-500/60 font-medium">(Mega: {selectedPlayerBreakdown.last50.mega_constipated})</span>
											</td>
										</tr>
										<!-- All-time games row -->
										<tr class="hover:bg-white/5 transition-colors bg-white/5">
											<td class="py-3 px-4 font-bold text-amber-400">All-Time</td>
											<td class="py-3 px-4 text-center font-extrabold text-slate-100">{selectedPlayerBreakdown.all.games}</td>
											<td class="py-3 px-4 text-center font-extrabold text-red-400/90">{selectedPlayerBreakdown.all.skitgubbe}</td>
											<td class="py-3 px-4 text-center font-extrabold text-pink-400/90">{selectedPlayerBreakdown.all.sweetgubbe}</td>
											<td class="py-3 px-4 text-center font-extrabold text-blue-400/90">{selectedPlayerBreakdown.all.trumfman}</td>
											<td class="py-3 px-4 text-center font-extrabold text-amber-400/90">
												{selectedPlayerBreakdown.all.constipated} <span class="text-[10px] text-amber-500/60 font-medium">(Mega: {selectedPlayerBreakdown.all.mega_constipated})</span>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="pt-4 border-t border-white/5 flex">
				<button
					type="button"
					onclick={() => showStatsModal = false}
					class="w-full premium-modal-btn premium-modal-btn-secondary"
				>
					<span class="premium-modal-btn-content">Close Dashboard</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Skitgubbe History Log Modal Overlay -->
{#if showHistoryModal}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="premium-modal-container max-w-md w-full p-8 flex flex-col gap-6 max-h-[80vh] overflow-hidden" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100 flex items-center justify-center gap-2 font-serif uppercase tracking-wide">
					Skitgubbe Log
				</h2>
			</div>

			<div class="flex-1 overflow-y-auto pr-1">
				{#if skitgubbeHistory.length === 0}
					<p class="text-slate-500 text-center text-sm font-medium py-8">No history entries found.</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each skitgubbeHistory as entry}
							<div class="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-900/80 transition-colors">
								<div class="flex items-center gap-3">
									<Avatar avatarConfig={entry.profile_avatar} fallbackColor={entry.profile_color} fallbackName={entry.profile_name} class="w-10 h-10 rounded-xl" />
									<div class="flex flex-col">
										<span class="text-sm font-bold text-slate-200">{entry.profile_name}</span>
									</div>
								</div>
								<span class="text-[11px] text-slate-400 font-medium">
									{timeAgo(entry.acquired_at)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex">
				<button
					type="button"
					onclick={() => showHistoryModal = false}
					class="w-full mt-2 premium-modal-btn premium-modal-btn-secondary"
				>
					<span class="premium-modal-btn-content">Close Log</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Access Logs Modal -->
{#if showLogsModal}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="premium-modal-container max-w-md w-full p-8 flex flex-col gap-6 max-h-[80vh] overflow-hidden" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100 flex items-center justify-center gap-2 font-serif uppercase tracking-wide">
					Recent Logins
				</h2>
			</div>

			<div class="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 custom-scrollbar">
				{#if accessLogs.length === 0}
					<p class="text-slate-500 text-center text-sm font-medium py-8">No access logs found.</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each accessLogs as log}
							<div class="modal-inner-glass p-4 flex flex-col gap-2">
								<div class="flex justify-between items-start gap-2">
									<span class="text-sm font-semibold text-slate-200 break-all">{log.ip_address}</span>
									<span class="text-xs text-slate-400 whitespace-nowrap">
										{new Date(normalizeTimestamp(log.accessed_at)).toLocaleString()}
									</span>
								</div>
								<p class="text-xs text-slate-400 line-clamp-2" title={log.device_info}>{log.device_info}</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex">
				<button
					type="button"
					onclick={() => showLogsModal = false}
					class="w-full mt-2 premium-modal-btn premium-modal-btn-secondary"
				>
					<span class="premium-modal-btn-content">Close Logins</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Invite Players Modal Overlay -->
{#if showInviteModal}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="premium-modal-container max-w-md w-full p-8 flex flex-col gap-6" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100 font-serif">Invite Players</h2>
				<p class="text-slate-400 text-xs mt-1 font-medium pb-2 border-b border-white/5">Select friends to invite to this game table (max 5)</p>
			</div>

			<div class="flex flex-col gap-2 text-left">
				<label for="new_room_name" class="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Name</label>
				<input
					id="new_room_name"
					type="text"
					bind:value={newRoomName}
					placeholder="E.g. Friday Poker (Optional)"
					class="px-4 py-3 bg-slate-950/60 border border-amber-900/40 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-base rounded-none"
					maxlength="20"
				/>
			</div>

			{#if otherProfiles.length === 0}
				<p class="text-slate-405 text-center text-sm font-medium">No other registered profiles found.</p>
			{:else}
				<div 
					bind:this={scrollContainer}
					onmousedown={handleMouseDown}
					role="presentation"
					class="flex gap-4 overflow-x-auto pb-4 snap-x w-full no-scrollbar cursor-grab active:cursor-grabbing select-none"
				>
					{#each otherProfiles as p}
						{@const isSelected = selectedInviteIds.includes(p.id)}
						<button
							type="button"
							onclick={(e) => {
								if (dragMoved) {
									e.preventDefault();
									return;
								}
								if (isSelected) {
									selectedInviteIds = selectedInviteIds.filter(id => id !== p.id);
								} else {
									if (selectedInviteIds.length >= 5) return;
									selectedInviteIds = [...selectedInviteIds, p.id];
								}
							}}
							class="flex flex-col items-center gap-2 p-3 shrink-0 snap-center transition-all text-center cursor-pointer border {isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-transparent hover:bg-slate-900/50'}"
						>
							<div class="relative">
								<Avatar avatarConfig={p.avatar_config} fallbackColor={p.color} fallbackName={p.name} class="w-14 h-14 rounded-full {isSelected ? 'ring-2 ring-amber-500' : ''}" />
								{#if isSelected}
									<div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center border-2 border-slate-900">
										<span class="text-[10px] text-slate-950 font-bold">✓</span>
									</div>
								{/if}
							</div>
							<span class="text-xs font-semibold text-slate-200 truncate w-16">{p.name}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex gap-3 mt-2">
				<button
					type="button"
					onclick={() => { showInviteModal = false; selectedInviteIds = []; newRoomName = ''; isDragging = false; dragMoved = false; }}
					class="flex-1 premium-modal-btn premium-modal-btn-secondary"
				>
					<span class="premium-modal-btn-content">Cancel</span>
				</button>
				<button
					type="button"
					onclick={handleCreateGameConfirm}
					class="flex-1 premium-modal-btn premium-modal-btn-primary"
				>
					<span class="premium-modal-btn-content">Create Table</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@import url('https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap');
	@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');

	.font-nanum {
		font-family: 'Nanum Brush Script', cursive;
	}

	.lobby-background {
		display: none;
	}

	@media (orientation: landscape) and (max-height: 540px) {
		.lobby-background {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 0;
			background-image: url('/kiryu_lobby.jpg');
			background-size: cover;
			background-position: left center;
			background-repeat: no-repeat;
		}
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
		-ms-overflow-style: none;  /* IE and Edge */
		scrollbar-width: none;  /* Firefox */
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
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.premium-room-card::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 3.5px solid;
		border-image: linear-gradient(to bottom, 
			#ffffff 0%,
			#cbd5e1 35%,
			#94a3b8 65%,
			#475569 100%
		) 1;
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

	.room-chevron-icon {
		width: 1.1rem;
		height: 1.1rem;
		color: rgba(255, 255, 255, 0.65);
		transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
	}

	/* Turn glow states */
	.premium-room-card.my-turn::before {
		border-image: linear-gradient(to bottom,
			#ffe89e 0%,    /* Soft white-gold highlight */
			#e3ba5a 25%,   /* Mid-tone warm gold */
			#b88728 45%,   /* Deeper bronze reflection */
			#fceeac 55%,   /* Sharp metallic light streak */
			#d19f33 70%,   /* Rich gold */
			#875c12 100%   /* Deep shadow for weight */
		) 1;
	}

	.premium-room-card.my-turn {
		background: linear-gradient(90deg, rgba(35, 25, 10, 0.85) 0%, rgba(20, 20, 20, 0.75) 100%);
		box-shadow: 0 4px 25px rgba(217, 119, 6, 0.15), 0 0 10px rgba(251, 191, 36, 0.05);
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
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
	}

	.premium-room-card:hover::before {
		border-image: linear-gradient(to bottom, 
			#ffffff 0%,
			#f1f5f9 20%,
			#cbd5e1 45%,
			#ffffff 60%,
			#94a3b8 80%,
			#475569 100%
		) 1;
	}

	.premium-room-card.my-turn:hover::before {
		border-image: linear-gradient(to bottom,
			#ffffff 0%,
			#ffe89e 20%,
			#e3ba5a 45%,
			#fceeac 60%,
			#d19f33 80%,
			#875c12 100%
		) 1;
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
		/* Deep multi-stop gradient mimicking reflective metallic chrome/gold */
		background: linear-gradient(135deg, 
			#ffe89e 0%,    /* Soft white-gold highlight */
			#e3ba5a 25%,   /* Mid-tone warm gold */
			#b88728 45%,   /* Deeper bronze reflection */
			#fceeac 55%,   /* Sharp metallic light streak */
			#d19f33 70%,   /* Rich gold */
			#875c12 100%   /* Deep shadow for weight */
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
		/* Slightly deeper shadow to ground the button into the UI */
		box-shadow: 0 4px 20px rgba(135, 92, 18, 0.4), inset 0 1px 3px rgba(255, 255, 255, 0.6);
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
		/* Shifting the gradient stops slightly on hover creates a "shimmer" effect */
		background: linear-gradient(135deg, 
			#ffffff 0%, 
			#ecc66b 20%, 
			#cb9935 40%, 
			#fff3be 55%, 
			#e0ad3c 75%, 
			#966919 100%
		);
		transform: skewX(-15deg) translateY(-2px);
		box-shadow: 0 6px 25px rgba(212, 175, 55, 0.45), inset 0 1px 4px rgba(255, 255, 255, 0.8);
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
		18%, 100% {
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
		border-image: linear-gradient(135deg, 
			#f59e0b 0%,
			#d97706 40%,
			rgba(217, 119, 6, 0.1) 90%,
			transparent 100%
		) 2;
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

	@keyframes shimmer-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	/* Skitgubbe Poster Display */
	.skitgubbe-poster {
		position: relative;
		width: 100%;
		max-width: 290px;
		aspect-ratio: 1792 / 2400;
		background-image: url('/skitgubbe_transparent.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.6));
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
		cursor: pointer;
		background-color: transparent;
		border: none;
		padding: 0;
		display: block;
	}

	.skitgubbe-poster:hover {
		transform: scale(1.04);
		filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.75));
	}

	.skitgubbe-poster:active {
		transform: scale(0.98);
	}

	.skitgubbe-poster-name {
		font-family: 'Nanum Brush Script', cursive;
		font-size: 2.2rem;
		font-weight: 700;
		color: #2e2315; /* dark ink color on parchment */
		margin-top: 0.35rem;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	/* Adjust padding of column on short screens */
	@media (max-height: 540px) {
		.skitgubbe-left-col {
			padding-top: 1rem !important;
		}
		.skitgubbe-poster {
			max-width: 220px; /* scaled up from 180px */
		}
		.skitgubbe-poster-name {
			font-size: 1.6rem;
			margin-top: 0.2rem;
		}
	}

	@media (max-height: 420px) {
		.skitgubbe-poster {
			max-width: 200px; /* scaled up from 140px */
		}
		.skitgubbe-poster-name {
			font-size: 1.3rem;
		}
	}

	@media (max-height: 340px) {
		.skitgubbe-poster {
			max-width: 140px;
		}
		.skitgubbe-poster-name {
			font-size: 1.1rem;
		}
	}
</style>

