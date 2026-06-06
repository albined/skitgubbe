<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';

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

	// Join Room State
	let joinCode = $state('');
	let joinError = $state('');
	let showJoinField = $state(false);

	// Statistics dashboard state
	let showStatsModal = $state(false);
	let showProfileDropdown = $state(false);

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
		isLoading = false;
	});

	// Check if authenticated
	async function checkAuth() {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				activeProfile = await res.json();
				// Sync to local/session storage for backward compatibility with the game room
				sessionStorage.setItem('skitgubbe_playerId', activeProfile.id);
				localStorage.setItem('skitgubbe_playerName', activeProfile.name);
				localStorage.setItem('skitgubbe_playerColor', activeProfile.color);
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
				localStorage.removeItem('skitgubbe_playerName');
				localStorage.removeItem('skitgubbe_playerColor');
				await loadProfiles();
			}
		} catch (e) {
			console.error('Logout failed:', e);
		}
	}

	// Create Game
	async function createGame() {
		try {
			const res = await fetch('/api/games/create', { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				window.location.href = `/lobby/${data.roomId}`;
			}
		} catch (e) {
			console.error('Failed to create game:', e);
		}
	}

	// Join Game
	async function joinGame(e: Event) {
		e.preventDefault();
		const code = joinCode.trim().toLowerCase();
		if (!code) return;
		joinError = '';

		try {
			const res = await fetch(`/api/games/${code}/join`, { method: 'POST' });
			if (res.ok) {
				window.location.href = `/lobby/${code}`;
			} else {
				const data = await res.json();
				joinError = data.error || 'Failed to join game room.';
			}
		} catch (e) {
			joinError = 'Failed to join. Check your code or server.';
		}
	}

	// Format timestamp helper
	function formatTime(timestamp: string) {
		if (!timestamp) return '';
		const d = new Date(timestamp);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}

	function timeAgo(timestamp: string) {
		if (!timestamp) return '';
		const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
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

<svelte:window onclick={handleWindowClick} />

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
							class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-5xl font-black uppercase text-white shadow-xl relative transition-all duration-300 border-2 border-transparent group-hover:border-yellow-400"
							style="background-color: {p.color}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.25);"
						>
							{p.name.charAt(0)}
							
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
						newProfileColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
						showCreateModal = true;
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
			
			<!-- Left column remains completely free/empty -->
			<div class="hidden md:block landscape:block"></div>
			
			<!-- Right column contains everything -->
			<div class="flex flex-col w-full relative">
				
				<!-- Fixed player chip in top right corner of window -->
				<div class="fixed top-4 right-4 z-50 profile-chip-container">
					<button 
						onclick={() => showProfileDropdown = !showProfileDropdown}
						class="flex items-center gap-2 px-2 py-1 bg-transparent border-0 cursor-pointer shadow-none focus:outline-none text-slate-200 hover:text-white"
					>
						<div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black uppercase text-white shadow-inner" style="background-color: {activeProfile.color}">
							{activeProfile.name.charAt(0)}
						</div>
						<span class="text-base font-semibold">{activeProfile.name}</span>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400 transition-transform duration-200 {showProfileDropdown ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					
					{#if showProfileDropdown}
						<div class="absolute right-0 mt-2 w-48 rounded-xl bg-slate-950 border border-white/10 shadow-xl z-50 py-1.5 backdrop-blur-md" transition:fade={{ duration: 100 }}>
							<button 
								onclick={() => { showStatsModal = true; showProfileDropdown = false; }} 
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
				<div class="flex flex-col gap-3 w-full mb-6">
					<div class="flex gap-3">
						<button 
							onclick={createGame} 
							class="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-3xl tracking-wide transition-all active:scale-95 cursor-pointer border border-yellow-500/20 shadow-md"
						>
							+ Create Game
						</button>
						<button 
							onclick={() => showJoinField = !showJoinField} 
							class="flex-1 py-3 px-5 rounded-xl bg-slate-900/80 hover:bg-slate-900/80 text-slate-200 border border-white/10 font-bold text-3xl tracking-wide transition-all active:scale-95 cursor-pointer shadow-md"
						>
							{showJoinField ? 'Cancel' : '→ Join Room'}
						</button>
					</div>
					
					{#if showJoinField}
						<form onsubmit={joinGame} class="flex gap-2 p-2 rounded-xl bg-slate-950/40 border border-white/5 shadow-inner" transition:fade={{ duration: 150 }}>
							<input
								type="text"
								bind:value={joinCode}
								placeholder="Code (e.g. 4rq8an)"
								maxlength="8"
								class="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-lg tracking-wider font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase"
								required
							/>
							<button 
								type="submit" 
								disabled={!joinCode.trim()} 
								class="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-900 disabled:text-slate-600 text-slate-950 font-bold text-2xl transition-all cursor-pointer"
							>
								Submit
							</button>
						</form>
						{#if joinError}
							<span class="text-red-400 text-sm pl-2">{joinError}</span>
						{/if}
					{/if}
				</div>

				<!-- Rooms List -->
				{#if games.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center gap-3">
						<div class="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-lg">
							📭
						</div>
						<p class="text-base text-slate-500">You aren't active on any game tables.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-160px)] md:max-h-[calc(100vh-200px)]">
						{#each games as g}
							<a 
								href={g.status === 'waiting' ? `/lobby/${g.id}` : `/room/${g.id}`}
								class="flex justify-between items-center py-6 px-5 rounded-xl border transition-all duration-300 bg-slate-950/60 hover:bg-slate-950/40 relative overflow-hidden group {g.is_my_turn && g.status === 'playing' ? 'border-amber-500/40 shadow-md shadow-amber-500/5 hover:border-amber-500/60' : 'border-white/5 hover:border-white/10'}"
							>
								<!-- Turn Pulsing Border Highlight -->
								{#if g.is_my_turn && g.status === 'playing'}
									<div class="absolute top-0 left-0 w-1 h-full bg-amber-500 animate-pulse"></div>
								{/if}

								<div class="flex items-baseline gap-3 max-w-[85%]">
									<span class="text-xl font-bold text-slate-100 group-hover:text-amber-400 transition-colors uppercase">
										Room {g.id}
									</span>
									<span class="text-sm text-slate-500">{timeAgo(g.updated_at)}</span>
								</div>

								<!-- Right Chevron Indicator -->
								<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-600 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
								</svg>
							</a>
						{/each}
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
							class="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-bold transition-all border border-white/5 cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-sm tracking-wide transition-all duration-300 border border-yellow-500/20 cursor-pointer"
						>
							Create & Play
						</button>
					</div>
			</form>
		</div>
	</div>
{/if}

<!-- Stats Dashboard Modal Overlay -->
{#if showStatsModal && activeProfile}
	<div class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
		<div class="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/10 flex flex-col gap-6 shadow-2xl" transition:scale={{ duration: 200, start: 0.95 }}>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100 flex items-center justify-center gap-2">
					📊 Player Stats
				</h2>
				<p class="text-slate-400 text-sm mt-1">Lifetime performance records for your profile</p>
			</div>

			<!-- Profile Card Summary -->
			<div class="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-white/5 shadow-inner">
				<div class="w-12 h-12 rounded-xl flex items-center justify-center text-3xl font-bold text-white shadow-md shadow-black/40" style="background-color: {activeProfile.color}">
					{activeProfile.name.charAt(0)}
				</div>
				<div class="flex flex-col">
					<span class="text-lg font-bold text-slate-200">{activeProfile.name}</span>
					<span class="text-xs text-slate-500">ID: {activeProfile.id.substring(0, 8)}...</span>
				</div>
			</div>

			<!-- Core Stats Grid -->
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-slate-950/50 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow">
					<span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Games Played</span>
					<span class="text-3xl font-black text-slate-100 mt-1">0</span>
				</div>
				<div class="bg-slate-950/50 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow">
					<span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Wins</span>
					<span class="text-3xl font-black text-amber-400 mt-1">0</span>
				</div>
				<div class="bg-slate-950/50 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow col-span-2">
					<span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Win Rate</span>
					<span class="text-2xl font-black text-emerald-400 mt-1">0%</span>
				</div>
			</div>

			<button
				type="button"
				onclick={() => showStatsModal = false}
				class="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-bold transition-all border border-white/5 cursor-pointer mt-2"
			>
				Close Stats
			</button>
		</div>
	</div>
{/if}

<style>
	@import url('https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap');

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
</style>
