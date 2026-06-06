<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	const roomId = $page.params.roomId;

	// Active Profile & Session
	let activeProfile = $state<any>(null);
	let isLoading = $state(true);

	// Profile creation for guest invitees
	let tempName = $state('');
	let tempColor = $state('#3b82f6');
	let profileError = $state('');

	// Lobby Status
	let lobbyPlayers = $state<any[]>([]);
	let gameStatus = $state('waiting');
	let lobbyError = $state('');
	let isHost = $derived(lobbyPlayers.find(p => p.profile_id === activeProfile?.id)?.role === 'host');
	let currentReady = $derived(lobbyPlayers.find(p => p.profile_id === activeProfile?.id)?.is_ready === 1);

	// Share code helpers
	let copyText = $state('Copy Link');
	const lobbyUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');

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

	let pollInterval: number | undefined;

	onMount(async () => {
		await checkAuthAndInitialize();
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});

	// Check authentication and setup lobby polling
	async function checkAuthAndInitialize() {
		try {
			const authRes = await fetch('/api/profiles/me');
			if (authRes.ok) {
				activeProfile = await authRes.json();
				// Ensure synced to storage for the game WebSocket page later
				sessionStorage.setItem('skitgubbe_playerId', activeProfile.id);
				localStorage.setItem('skitgubbe_playerName', activeProfile.name);
				localStorage.setItem('skitgubbe_playerColor', activeProfile.color);

				// Join the database lobby automatically
				await joinLobby();
				// Start polling lobby state
				await fetchLobbyData();
				pollInterval = window.setInterval(fetchLobbyData, 2000);
			} else {
				activeProfile = null;
			}
		} catch (e) {
			console.error('Initialization failed:', e);
		} finally {
			isLoading = false;
		}
	}

	// Guest Profile Creation
	async function handleCreateProfile(e: Event) {
		e.preventDefault();
		const name = tempName.trim();
		if (!name) {
			profileError = 'Please enter a name.';
			return;
		}
		profileError = '';

		try {
			const res = await fetch('/api/profiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, color: tempColor })
			});

			if (res.ok) {
				const profile = await res.json();
				// Select it to set JWT cookie
				const selectRes = await fetch(`/api/profiles/${profile.id}/select`, { method: 'POST' });
				if (selectRes.ok) {
					isLoading = true;
					await checkAuthAndInitialize();
				}
			} else {
				const data = await res.json();
				profileError = data.error || 'Failed to create profile.';
			}
		} catch (e) {
			profileError = 'Server error occurred.';
		}
	}

	// Register player in DB lobby
	async function joinLobby() {
		try {
			const res = await fetch(`/api/games/${roomId}/join`, { method: 'POST' });
			if (!res.ok) {
				const data = await res.json();
				lobbyError = data.error || 'Failed to join lobby.';
			}
		} catch (e) {
			console.error('Join lobby request failed:', e);
		}
	}

	// Fetch lobby player ready states and status
	async function fetchLobbyData() {
		try {
			const res = await fetch(`/api/games/${roomId}`);
			if (res.ok) {
				const data = await res.json();
				lobbyPlayers = data.players;
				gameStatus = data.game.status;

				// If host started the game, clear poll and go to play room!
				if (gameStatus === 'playing') {
					if (pollInterval) clearInterval(pollInterval);
					window.location.href = `/room/${roomId}`;
				}
			} else {
				lobbyError = 'Lobby details not found. It might have been deleted.';
				if (pollInterval) clearInterval(pollInterval);
			}
		} catch (e) {
			console.error('Polling lobby state failed:', e);
		}
	}

	// Toggle Ready state
	async function toggleReady() {
		try {
			const nextReady = !currentReady;
			const res = await fetch(`/api/games/${roomId}/ready`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isReady: nextReady })
			});
			if (res.ok) {
				await fetchLobbyData();
			}
		} catch (e) {
			console.error('Failed to toggle ready:', e);
		}
	}

	// Leave Lobby
	async function leaveLobby() {
		try {
			await fetch(`/api/games/${roomId}/leave`, { method: 'POST' });
			window.location.href = '/';
		} catch (e) {
			console.error('Failed to leave lobby:', e);
			window.location.href = '/';
		}
	}

	// Start Game (Host only)
	async function startGame() {
		try {
			const res = await fetch(`/api/games/${roomId}/start`, { method: 'POST' });
			if (res.ok) {
				window.location.href = `/room/${roomId}`;
			} else {
				const data = await res.json();
				lobbyError = data.error || 'Failed to start game.';
			}
		} catch (e) {
			console.error('Start game failed:', e);
		}
	}

	// Copy Invite URL
	function copyLobbyUrl() {
		navigator.clipboard.writeText(lobbyUrl);
		copyText = 'Copied!';
		setTimeout(() => copyText = 'Copy Link', 2000);
	}
</script>

<div class="felt-overlay"></div>

<div class="relative z-10 w-full min-h-screen flex items-center justify-center p-4">
	{#if isLoading}
		<div class="flex flex-col items-center gap-4 animate-pulse">
			<div class="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
			<span class="text-xs font-bold text-amber-500/80 tracking-widest font-mono uppercase">Initializing Lobby...</span>
		</div>
	{:else if !activeProfile}
		<!-- Guest Profile Registration Form -->
		<div class="glass-panel max-w-md w-full p-8 rounded-2xl border border-white/5 flex flex-col gap-6 shadow-2xl" in:fade={{ duration: 150 }}>
			<div class="text-center">
				<h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 tracking-tight font-serif drop-shadow-md">
					Skitgubbe
				</h1>
				<p class="text-slate-300 text-xs mt-2 font-medium tracking-wide">You've been invited! Create a profile to join lobby {roomId}</p>
			</div>

			<form onsubmit={handleCreateProfile} class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<label for="invite_username" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
					<input
						id="invite_username"
						type="text"
						bind:value={tempName}
						placeholder="E.g. Hasty King"
						class="px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-medium"
						maxlength="15"
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Player Theme Color</span>
					<div class="grid grid-cols-4 gap-3">
						{#each PRESET_COLORS as color}
							<button
								type="button"
								onclick={() => tempColor = color}
								class="w-full aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-105 cursor-pointer shadow-md"
								style="background-color: {color}; border-color: {tempColor === color ? '#ffd700' : 'transparent'};"
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
				</div>

				{#if profileError}
					<span class="text-red-400 text-xs text-center font-semibold">{profileError}</span>
				{/if}

				<button
					type="submit"
					class="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-xs tracking-wide transition-all duration-300 border border-yellow-500/20 cursor-pointer shadow-lg"
				>
					Join Game Room
				</button>
			</form>
		</div>
	{:else}
		<!-- Lobby Waiting Screen -->
		<div class="glass-panel max-w-xl w-full p-8 rounded-2xl border border-white/5 flex flex-col gap-8 shadow-2xl" in:fade={{ duration: 150 }}>
			
			<!-- Header -->
			<div class="text-center relative">
				<span class="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
					Room Lobby
				</span>
				<h2 class="text-2xl font-extrabold text-white mt-3">Waiting for players...</h2>
				
				<!-- Share link panel -->
				<div class="mt-4 flex items-center justify-center gap-2 bg-slate-950/60 border border-slate-900 rounded-xl p-2 max-w-sm mx-auto shadow-inner">
					<span class="text-xs font-mono text-slate-400 select-all truncate">{lobbyUrl}</span>
					<button
						onclick={copyLobbyUrl}
						class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 active:scale-95 transition-all cursor-pointer shadow border border-white/5"
					>
						{copyText}
					</button>
				</div>
			</div>

			<!-- Player Grid / List -->
			<div class="flex flex-col gap-3">
				<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Players ({lobbyPlayers.length}/6)</span>
				<div class="flex flex-col gap-2 bg-slate-950/40 border border-slate-900 rounded-xl p-4 shadow-inner">
					{#each lobbyPlayers as p}
						<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
							<div class="flex items-center gap-3">
								<div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black uppercase text-white shadow" style="background-color: {p.color};">
									{p.name?.charAt(0)}
								</div>
								<span class="text-sm font-semibold text-slate-100 flex items-center gap-2">
									{p.name}
									{#if p.profile_id === activeProfile.id}
										<span class="text-[9px] text-amber-400 font-mono font-bold uppercase tracking-widest">(You)</span>
									{/if}
									{#if p.role === 'host'}
										<span class="text-[9px] text-yellow-500 font-mono font-bold uppercase tracking-widest bg-yellow-950/30 border border-yellow-800/20 px-1.5 py-0.5 rounded">Host</span>
									{/if}
								</span>
							</div>

							<!-- Player Ready Status -->
							<div>
								{#if p.is_ready === 1}
									<span class="text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2.5 py-0.5 rounded">Ready</span>
								{:else}
									<span class="text-[9px] font-semibold text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded">Not Ready</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>

			{#if lobbyError}
				<div class="text-center py-2.5 px-4 text-xs text-red-400 font-semibold bg-red-950/20 border border-red-900/25 rounded-xl">
					{lobbyError}
				</div>
			{/if}

			<!-- Action Controls Panel -->
			<div class="flex gap-4">
				<!-- Exit Lobby -->
				<button
					onclick={leaveLobby}
					class="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all border border-white/5 cursor-pointer"
				>
					Leave Lobby
				</button>

				{#if isHost}
					<!-- Host start -->
					<button
						onclick={startGame}
						disabled={lobbyPlayers.length < 2 || lobbyPlayers.some(p => p.is_ready === 0)}
						class="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:from-slate-850 disabled:to-slate-900 disabled:text-slate-500 text-slate-950 font-bold text-xs tracking-wide transition-all duration-300 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-lg border border-yellow-500/20"
					>
						{lobbyPlayers.length < 2 
							? 'NEED 2+ PLAYERS' 
							: lobbyPlayers.some(p => p.is_ready === 0) 
								? 'WAITING FOR READY' 
								: 'START GAME'}
					</button>
				{:else}
					<!-- Player ready status switch -->
					<button
						onclick={toggleReady}
						class="flex-1 py-3 rounded-xl text-xs font-bold tracking-wide transition-all active:scale-95 cursor-pointer shadow-lg border {currentReady ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/20' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500/20'}"
					>
						{currentReady ? 'READY!' : 'SET READY'}
					</button>
				{/if}
			</div>

		</div>
	{/if}
</div>
