<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { fade, scale } from 'svelte/transition';
	import { Spring } from 'svelte/motion';
	import Avatar from '$lib/Avatar.svelte';
	import { pwa } from '$lib/pwa.svelte';

	// 3D Swinging Notice Board state
	const boardRotation = new Spring(0, {
		stiffness: 0.13, // Heavy wood swing
		damping: 0.01    // Gentle oscillation
	});

	const tiltX = new Spring(0, { stiffness: 0.1, damping: 0.2 });
	const tiltY = new Spring(0, { stiffness: 0.1, damping: 0.2 });

	function handleBoardMouseMove(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		if (!target) return;
		const rect = target.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const normX = (x / rect.width) * 2 - 1;
		const normY = (y / rect.height) * 2 - 1;

		tiltX.target = -normY * 12; // Tilt up/down based on Y mouse pos
		tiltY.target = normX * 12;  // Tilt left/right based on X mouse pos
	}

	function handleBoardMouseLeave() {
		tiltX.target = 0;
		tiltY.target = 0;
	}

	let pushTimeout: any;

	function pushBoard(event: MouseEvent) {
		const target = event.currentTarget as HTMLElement;
		if (!target) return;
		const rect = target.getBoundingClientRect();
		const clickY = event.clientY - rect.top;

		// Calculate leverage: clicking lower down swings it harder
		const leverage = clickY / rect.height; // 0 to 1
		const force = -12 - (leverage * 18); // ranges from -12 to -30 degrees (away from viewer)

		// Keep the spring stiffness and damping constant for natural heavy wood oscillation
		boardRotation.stiffness = 0.003;
		boardRotation.damping = 0.008;

		if (pushTimeout) clearTimeout(pushTimeout);

		// Apply a short impulse by setting a large target to build up backward velocity
		boardRotation.target = force * 4.5;

		pushTimeout = setTimeout(() => {
			boardRotation.target = 0;
		}, 60);
	}

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

	// Archive state
	let showArchiveModal = $state(false);
	let archivedGames = $state<any[]>([]);
	let isArchiveMode = $state(false);
	let selectedGamesToArchive = $state<string[]>([]);

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
		'#f97316' // orange
	];

	// Initial Loader
	onMount(async () => {
		await checkAuth();
		await loadProfiles();
		await loadCurrentSkitgubbe();

		initNotifications();
		isLoading = false;
	});

	async function initNotifications() {
		notificationsSupported = 'serviceWorker' in navigator && 'PushManager' in window;
		if (!notificationsSupported) return;

		try {
			// Prevent hanging in dev mode where no service worker is registered
			const regs = await navigator.serviceWorker.getRegistrations();
			if (regs.length === 0 && dev) {
				notificationsSupported = false;
				return;
			}

			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			notificationsEnabled = !!sub;

			// If subscribed, sync with active profile to be sure
			if (sub && activeProfile) {
				const syncKey = `push_synced:${activeProfile.id}:${sub.endpoint}`;
				if (!localStorage.getItem(syncKey)) {
					const res = await fetch('/api/push/subscribe', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(sub)
					});
					if (res.ok) {
						localStorage.setItem(syncKey, 'true');
					}
				}
			}
		} catch (e) {
			console.warn('Failed to check notification status:', e);
		}
	}

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
				await loadCurrentSkitgubbe();
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

	// Load archived games for the current profile
	async function loadArchivedGames() {
		try {
			const res = await fetch('/api/games/archived');
			if (res.ok) {
				archivedGames = await res.json();
			}
		} catch (e) {
			console.error('Failed to load archived games:', e);
		}
	}

	async function openArchiveModal() {
		await loadArchivedGames();
		showArchiveModal = true;
	}

	function toggleArchiveSelection(roomId: string) {
		if (selectedGamesToArchive.includes(roomId)) {
			selectedGamesToArchive = selectedGamesToArchive.filter((id) => id !== roomId);
		} else {
			selectedGamesToArchive = [...selectedGamesToArchive, roomId];
		}
	}

	async function handleArchiveSelected() {
		if (selectedGamesToArchive.length === 0) return;
		try {
			const res = await fetch('/api/games/archive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameIds: selectedGamesToArchive })
			});
			if (res.ok) {
				selectedGamesToArchive = [];
				isArchiveMode = false;
				await loadGames();
			}
		} catch (e) {
			console.error('Failed to archive games:', e);
		}
	}

	async function restoreGame(roomId: string) {
		try {
			const res = await fetch('/api/games/unarchive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameIds: [roomId] })
			});
			if (res.ok) {
				await loadArchivedGames();
				await loadGames();
			}
		} catch (e) {
			console.error('Failed to restore game:', e);
		}
	}

	// Profile Creation
	async function handleCreateProfile(e: Event) {
		e.preventDefault();
		const name = newProfileName.trim();
		if (!name) {
			createError = 'Skriv in ett namn.';
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

				// Sync existing push subscription to the newly selected profile
				if (notificationsSupported) {
					try {
						const reg = await navigator.serviceWorker.ready;
						const sub = await reg.pushManager.getSubscription();
						if (sub && activeProfile) {
							const syncKey = `push_synced:${activeProfile.id}:${sub.endpoint}`;
							if (!localStorage.getItem(syncKey)) {
								const syncRes = await fetch('/api/push/subscribe', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify(sub)
								});
								if (syncRes.ok) {
									localStorage.setItem(syncKey, 'true');
								}
							}
						}
					} catch (err) {
						console.warn('Failed to sync push subscription on profile change:', err);
					}
				}
			}
		} catch (e) {
			console.error('Failed to select profile:', e);
		}
	}

	let notificationsSupported = $state(false);
	let notificationsEnabled = $state(false);
	let isTogglingNotifications = $state(false);

	function urlBase64ToUint8Array(base64String: string) {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	async function toggleNotifications() {
		if (!notificationsSupported || isTogglingNotifications) return;
		isTogglingNotifications = true;
		try {
			const reg = await navigator.serviceWorker.ready;
			if (notificationsEnabled) {
				const sub = await reg.pushManager.getSubscription();
				if (sub) {
					const unsubscribeRes = await fetch('/api/push/unsubscribe', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ endpoint: sub.endpoint })
					});
					if (unsubscribeRes.ok) {
						try {
							await sub.unsubscribe();
						} catch (unsubErr) {
							console.warn('Browser push unsubscribe failed, proceeding anyway:', unsubErr);
						}
						notificationsEnabled = false;
						if (activeProfile) {
							localStorage.removeItem(`push_synced:${activeProfile.id}:${sub.endpoint}`);
						}
					} else {
						console.error('Failed to unsubscribe from server');
					}
				} else {
					notificationsEnabled = false;
				}
			} else {
				const permission = await Notification.requestPermission();
				if (permission !== 'granted') {
					return;
				}

				const vapidRes = await fetch('/api/push/vapid-public-key');
				const { publicKey } = await vapidRes.json();

				const sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(publicKey)
				});

				const subscribeRes = await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(sub)
				});

				if (subscribeRes.ok) {
					notificationsEnabled = true;
					if (activeProfile) {
						localStorage.setItem(`push_synced:${activeProfile.id}:${sub.endpoint}`, 'true');
					}
				} else {
					console.error('Failed to register push subscription on server');
					try {
						await sub.unsubscribe();
					} catch (unsubErr) {
						console.warn('Failed to clean up browser subscription:', unsubErr);
					}
				}
			}
		} catch (e) {
			console.error('Failed to toggle notifications:', e);
		} finally {
			isTogglingNotifications = false;
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
		if (selectedInviteIds.length === 0) return;
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

	const pendingInvitations = $derived(games.filter((g) => g.invite_status === 'pending'));
	const activeGames = $derived(games.filter((g) => g.invite_status === 'accepted'));
	const otherProfiles = $derived(profiles.filter((p) => p.id !== activeProfile?.id));

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
		return (
			d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
			' ' +
			d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
		);
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

<svelte:window
	onclick={handleWindowClick}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
/>

<div class="felt-overlay"></div>

<div
	class="font-nanum relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-4 text-white md:py-8"
>
	{#if isLoading}
		<!-- Simple Elegant loading spinner -->
		<div class="flex animate-pulse flex-col items-center gap-4">
			<div
				class="h-12 w-12 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500"
			></div>
			<span class="text-sm font-bold tracking-widest text-amber-500/80 uppercase"
				>Loading Skitgubbe...</span
			>
		</div>
	{:else if !activeProfile}
		<!-- Netflix-Style Profile Selector Screen -->
		<div
			class="profile-selector-container flex w-full max-w-4xl flex-col items-center gap-10"
			in:fade={{ duration: 300 }}
		>
			<div class="text-center">
				<h1
					class="bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-5xl font-bold text-transparent drop-shadow-md sm:text-6xl md:text-7xl"
				>
					Skitgubbe
				</h1>
				<p class="mt-3 text-lg tracking-wide text-slate-300 sm:text-xl md:text-2xl">Vem spelar?</p>
			</div>

			<!-- Profile Select Grid -->
			<div
				class="profile-select-list grid grid-cols-2 items-center justify-center gap-8 py-6 sm:grid-cols-3 md:grid-cols-4"
			>
				{#each profiles as p}
					<button
						onclick={() => selectProfile(p.id)}
						class="group flex cursor-pointer flex-col items-center gap-3 border-0 bg-transparent transition-transform duration-200 hover:scale-105 focus:outline-none"
					>
						<div
							class="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-transparent text-5xl font-black text-white uppercase shadow-xl transition-all duration-300 group-hover:border-yellow-400 sm:h-28 sm:w-28"
							style="background-color: {p.color}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.25);"
						>
							<Avatar
								avatarConfig={p.avatar_config}
								fallbackColor={p.color}
								fallbackName={p.name}
								class="h-full w-full rounded-2xl"
							/>

							<!-- Soft Inner Radial Glow -->
							<div
								class="absolute inset-0 rounded-2xl bg-radial from-white/10 to-transparent"
							></div>
						</div>
						<span
							class="w-24 truncate text-center text-xl text-slate-300 transition-colors duration-200 group-hover:text-white sm:w-28"
						>
							{p.name}
						</span>
					</button>
				{/each}

				<!-- Add New Profile Button -->
				<button
					onclick={() => {
						window.location.href = '/avatar?new=true';
					}}
					class="group flex cursor-pointer flex-col items-center gap-3 border-0 bg-transparent transition-transform duration-200 hover:scale-105 focus:outline-none"
				>
					<div
						class="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900/30 text-slate-500 shadow-lg transition-all duration-300 group-hover:border-slate-300 group-hover:bg-slate-900/50 group-hover:text-slate-300 sm:h-28 sm:w-28"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-10 w-10"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</div>
					<span
						class="text-xl text-slate-500 transition-colors duration-200 group-hover:text-slate-300"
					>
						Ny profil
					</span>
				</button>
			</div>
		</div>
	{:else}
		<!-- Main Game Hub View -->
		<div class="lobby-background" transition:fade={{ duration: 300 }}></div>
		<div
			class="relative grid w-full max-w-5xl grid-cols-1 items-start gap-8 md:grid-cols-2 landscape:grid-cols-2"
			in:fade={{ duration: 300 }}
		>
			<!-- Left column: Global Skitgubbe Calling Card / Poster -->
			<div
				class="skitgubbe-left-col flex w-full flex-col items-center justify-center pt-8 text-center md:pt-16"
				in:fade={{ duration: 300 }}
			>
				<div class="notice-board-container">
					<div
						role="button"
						tabindex="0"
						class="notice-board-3d"
						style="--tilt-x: {tiltX.current}deg; --tilt-y: {tiltY.current}deg; --swing-x: {boardRotation.current}deg;"
						onmousemove={handleBoardMouseMove}
						onmouseleave={handleBoardMouseLeave}
						onclick={pushBoard}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								pushBoard(e as any);
							}
						}}
					>
						<!-- Rope Extensions to the ceiling (real texture stacked segments) -->
						{#each Array(6) as _, i}
							<div class="rope-segment-container" style="bottom: calc(99% + {i * 28}cqw);">
								<div class="rope-segment-image"></div>
							</div>
						{/each}

						<!-- 3D Extrusion Layers (Stack of images shifted back in Z-axis) -->
						<div class="board-layer board-layer-back-3"></div>
						<div class="board-layer board-layer-back-2"></div>
						<div class="board-layer board-layer-back-1"></div>
						<div class="board-layer board-layer-front"></div>

						<!-- Poster attached to the front of the board -->
						{#if currentSkitgubbe}
							<button
								onclick={(e) => {
									e.stopPropagation();
									openSkitgubbeHistory();
								}}
								class="skitgubbe-poster on-board group focus:outline-none"
							>
								<div
									class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]"
								>
									<div
										class="relative flex aspect-square w-[48%] items-center justify-center overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950/85 p-0 transition-all duration-300 group-hover:border-slate-500"
									>
										<Avatar
											avatarConfig={currentSkitgubbe.avatar_config}
											fallbackColor={currentSkitgubbe.color}
											fallbackName={currentSkitgubbe.name}
											class="h-full w-full rounded-2xl"
										/>

										<div class="absolute inset-0 bg-radial from-white/5 to-transparent"></div>
									</div>
									<span class="skitgubbe-poster-name max-w-[85%] truncate leading-none select-none">
										{currentSkitgubbe.name}
									</span>
								</div>
							</button>
						{:else}
							<button
								onclick={(e) => {
									e.stopPropagation();
									openSkitgubbeHistory();
								}}
								class="skitgubbe-poster on-board default-poster group focus:outline-none"
							>
								<div
									class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]"
								>
									<div
										class="relative flex aspect-square w-[48%] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-650 bg-slate-950/50 p-0 flex-col"
									>
										<span class="text-4xl font-black text-slate-500/60 select-none">?</span>
									</div>
									<span class="skitgubbe-poster-name max-w-[85%] truncate leading-none select-none text-slate-450!">
										Vem blir nästa?
									</span>
								</div>
							</button>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right column contains everything -->
			<div class="relative flex w-full flex-col pt-12 md:pt-16">
				<!-- Fixed player chip in top right corner of window -->
				<div class="profile-chip-container fixed top-4 right-4 z-50">
					<button
						onclick={() => (showProfileDropdown = !showProfileDropdown)}
						class="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-1 text-slate-200 shadow-none hover:text-white focus:outline-none"
					>
						<Avatar
							avatarConfig={activeProfile.avatar_config}
							fallbackColor={activeProfile.color}
							fallbackName={activeProfile.name}
							class="h-5 w-5 rounded-full"
						/>
						<span class="text-base font-semibold">{activeProfile.name}</span>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-3 w-3 text-slate-400 transition-transform duration-200 {showProfileDropdown
								? 'rotate-180'
								: ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</button>

					{#if showProfileDropdown}
						<div
							class="premium-modal-container absolute right-0 z-50 mt-2 w-48 py-1.5"
							style="position: absolute;"
							transition:fade={{ duration: 100 }}
						>
							{#if pwa.installPrompt}
								<button
									onclick={() => {
										pwa.install();
										showProfileDropdown = false;
									}}
									class="hover:text-amber-250 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-amber-400 transition-colors hover:bg-white/5"
								>
									Installera app
								</button>
								<div class="my-1 h-[1px] bg-white/5"></div>
							{/if}
							{#if notificationsSupported}
								<button
									disabled={isTogglingNotifications}
									onclick={() => {
										toggleNotifications();
										showProfileDropdown = false;
									}}
									class="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									<span class="flex items-center gap-2"> Notiser </span>
									<span
										class="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider {notificationsEnabled
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-slate-700/30 text-slate-500'}"
									>
										{isTogglingNotifications ? '...' : notificationsEnabled ? 'På' : 'Av'}
									</span>
								</button>
								<div class="my-1 h-[1px] bg-white/5"></div>
							{/if}
							<button
								onclick={() => {
									window.location.href = '/avatar';
									showProfileDropdown = false;
								}}
								class="hover:text-amber-250 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-amber-400 transition-colors hover:bg-white/5"
							>
								Ändra din avatar
							</button>
							<div class="my-1 h-[1px] bg-white/5"></div>
							<button
								onclick={() => {
									loadAccessLogs();
									showLogsModal = true;
									showProfileDropdown = false;
								}}
								class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
							>
								Senaste inloggningarna
							</button>
							<div class="my-1 h-[1px] bg-white/5"></div>
							<button
								onclick={() => {
									openStatsDashboard();
									showProfileDropdown = false;
								}}
								class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
							>
								Profil Stats
							</button>
							<div class="my-1 h-[1px] bg-white/5"></div>
							<button
								onclick={() => {
									openArchiveModal();
									showProfileDropdown = false;
								}}
								class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
							>
								Spel arkiv
							</button>
							<div class="my-1 h-[1px] bg-white/5"></div>
							<button
								onclick={() => {
									isArchiveMode = true;
									selectedGamesToArchive = [];
									showProfileDropdown = false;
								}}
								class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
							>
								Arkivera rum
							</button>
							<div class="my-1 h-[1px] bg-white/5"></div>
							<button
								onclick={handleLogout}
								class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/5"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-3.5 w-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1"
									/>
								</svg>
								Logga ut / Byt konto
							</button>
						</div>
					{/if}
				</div>

				<!-- Matchmaking Quick Actions at the top -->
				<div class="mb-6 flex w-full flex-col gap-3 px-3">
					<button
						onclick={() => {
							selectedInviteIds = [];
							newRoomName = '';
							showInviteModal = true;
						}}
						class="premium-action-btn"
					>
						<div class="btn-shimmer"></div>
						<span class="premium-action-btn-content">+ Skapa spel</span>
					</button>
				</div>

				<!-- Invitations List -->
				{#if pendingInvitations.length > 0}
					<div class="mb-8 flex flex-col gap-3">
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
												onclick={() => acceptGame(g.id)}
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
				{#if activeGames.length === 0}
					{#if pendingInvitations.length === 0}
						<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
							<div
								class="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-700 text-lg text-slate-500"
							>
								📭
							</div>
							<p class="text-base text-slate-500">Du är inte aktiv vid något spelbord.</p>
						</div>
					{/if}
				{:else}
					<div class="flex flex-col gap-3">
						{#if isArchiveMode}
							<!-- Archive selection controls header -->
							<div
								class="modal-inner-glass archive-selection-header mb-2 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-2.5"
							>
								<span class="text-xs font-bold tracking-wider text-red-400 uppercase">
									Välj rum att arkivera ({selectedGamesToArchive.length})
								</span>
								<div class="flex gap-2">
									<button
										onclick={() => {
											isArchiveMode = false;
											selectedGamesToArchive = [];
										}}
										class="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 transition-all hover:text-white active:scale-95"
									>
										Avbryt
									</button>
									<button
										onclick={handleArchiveSelected}
										disabled={selectedGamesToArchive.length === 0}
										class="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/25 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
									>
										Arkivera valda
									</button>
								</div>
							</div>
						{/if}

						<div class="premium-room-list max-h-[calc(var(--app-height)-200px)] overflow-y-auto">
							{#each activeGames as g}
								{#if isArchiveMode}
									<button
										onclick={() => toggleArchiveSelection(g.id)}
										class="premium-room-card text-left transition-all duration-200 {selectedGamesToArchive.includes(
											g.id
										)
											? 'border-red-500/40 bg-red-950/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
											: ''}"
									>
										<div class="premium-room-content flex items-center justify-between">
											<div class="room-info-block flex items-center gap-3">
												<!-- Checkbox indicator -->
												<div
													class="flex h-5 w-5 items-center justify-center rounded border transition-all {selectedGamesToArchive.includes(
														g.id
													)
														? 'border-red-500 bg-red-500 text-white'
														: 'border-slate-600 bg-slate-950/50'}"
												>
													{#if selectedGamesToArchive.includes(g.id)}
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
												<span class="room-time-text">{timeAgo(g.updated_at)}</span>
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

<!-- Add Profile Modal Overlay -->
{#if showCreateModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="glass-panel flex w-full max-w-md flex-col gap-6 rounded-2xl border border-white/10 p-8 shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100">Create New Profile</h2>
				<p class="mt-1 text-sm text-slate-400">Select a name and pick your player color theme</p>
			</div>

			<form onsubmit={handleCreateProfile} class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<label
						for="new_username"
						class="text-xs font-bold tracking-wider text-slate-400 uppercase">Display Name</label
					>
					<input
						id="new_username"
						type="text"
						bind:value={newProfileName}
						placeholder="E.g. Spade Ace"
						class="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
						maxlength="15"
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<span class="text-xs font-bold tracking-wider text-slate-400 uppercase">Color Theme</span>
					<div class="grid grid-cols-4 gap-3">
						{#each PRESET_COLORS as color}
							<button
								type="button"
								onclick={() => (newProfileColor = color)}
								class="aspect-square w-full cursor-pointer rounded-xl border-2 shadow-md transition-all duration-200 hover:scale-105"
								style="background-color: {color}; border-color: {newProfileColor === color
									? '#ffd700'
									: 'transparent'};"
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
				</div>

				{#if createError}
					<span class="text-center text-xs font-semibold text-red-400">{createError}</span>
				{/if}

				<div class="mt-2 flex gap-3">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="premium-modal-btn premium-modal-btn-secondary flex-1"
					>
						<span class="premium-modal-btn-content">Cancel</span>
					</button>
					<button type="submit" class="premium-modal-btn premium-modal-btn-primary flex-1">
						<span class="premium-modal-btn-content">Create & Play</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Stats Dashboard Modal Overlay -->
{#if showStatsModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.9)] w-full max-w-4xl flex-col gap-6 overflow-hidden p-6 md:p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				onclick={() => (showStatsModal = false)}
				class="absolute top-4 right-4 z-10 cursor-pointer text-slate-400 transition-colors hover:text-white md:top-6 md:right-6"
				aria-label="Close stats"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<!-- Modal Header -->
			<div
				class="flex flex-col items-center justify-between gap-4 border-b border-white/5 pr-10 pb-4 sm:flex-row sm:pr-12"
			>
				<div class="text-center sm:text-left">
					<h2
						class="flex items-center gap-2 font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase"
					>
						Topplista & Stats
					</h2>
				</div>

				<!-- Tabs -->
				<div class="premium-tab-container">
					<button
						type="button"
						onclick={() => (statsTab = 'all')}
						class="premium-tab-btn {statsTab === 'all'
							? 'premium-tab-btn-active'
							: 'premium-tab-btn-inactive'}"
					>
						Alla spelare
					</button>
					<button
						type="button"
						onclick={() => (statsTab = 'personal')}
						class="premium-tab-btn {statsTab === 'personal'
							? 'premium-tab-btn-active'
							: 'premium-tab-btn-inactive'}"
					>
						Personliga resultat
					</button>
				</div>
			</div>

			<!-- Modal Content (Scrollable Container) -->
			<div class="flex-1 overflow-y-auto pr-1">
				{#if statsTab === 'all'}
					<!-- All Players Table -->
					<div class="premium-table-container w-full overflow-x-auto">
						<table class="premium-table">
							<thead>
								<tr class="stats-table-header">
									<th class="px-4 py-3">Spelare</th>
									<th class="px-4 py-3 text-center">Spel</th>
									<th class="px-4 py-3 text-center text-red-400">Skitgubbe</th>
									<th class="px-4 py-3 text-center text-pink-400">Sweetgubbe</th>
									<th class="px-4 py-3 text-center text-blue-400">Trumfman</th>
									<th class="px-4 py-3 text-center text-amber-400">Förstoppad</th>
								</tr>
							</thead>
							<tbody class="">
								{#each allPlayersStats as row}
									<tr
										class="stats-table-row cursor-pointer {row.id === activeProfile?.id
											? 'bg-amber-500/5'
											: ''}"
										onclick={() => {
											statsTab = 'personal';
											handleSelectStatsProfile(row.id);
										}}
									>
										<td class="flex items-center gap-3 px-4 py-3 font-semibold">
											<Avatar
												avatarConfig={row.avatar_config}
												fallbackColor={row.color}
												fallbackName={row.name}
												class="h-8 w-8 rounded-lg"
											/>
											<span>{row.name}</span>
										</td>
										<td class="px-4 py-3 text-center font-bold text-slate-100">{row.games}</td>
										<td class="px-4 py-3 text-center font-bold text-red-400/90">{row.skitgubbe}</td>
										<td class="px-4 py-3 text-center font-bold text-pink-400/90"
											>{row.sweetgubbe}</td
										>
										<td class="px-4 py-3 text-center font-bold text-blue-400/90">{row.trumfman}</td>
										<td class="px-4 py-3 text-center font-bold text-amber-400/90">
											{row.constipated}
											<span class="text-[10px] font-medium text-amber-500/60"
												>(Mega: {row.mega_constipated})</span
											>
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
						<div
							class="modal-inner-glass flex flex-col items-center justify-between gap-4 p-4 sm:flex-row"
						>
							<div class="flex items-center gap-3">
								{#if selectedStatsProfile}
									<Avatar
										avatarConfig={selectedStatsProfile.avatar_config}
										fallbackColor={selectedStatsProfile.color}
										fallbackName={selectedStatsProfile.name}
										class="h-12 w-12 rounded-xl"
									/>
									<div class="flex flex-col">
										<span class="text-lg font-bold text-slate-100">{selectedStatsProfile.name}</span
										>
									</div>
								{/if}
							</div>

							<select
								value={selectedStatsProfileId}
								onchange={(e) => handleSelectStatsProfile((e.target as HTMLSelectElement).value)}
								class="modal-inner-glass cursor-pointer px-4 py-2 text-sm font-semibold text-slate-200 focus:ring-1 focus:ring-amber-500 focus:outline-none"
							>
								{#each profiles as p}
									<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</div>

						<!-- Personal Breakdown Table -->
						{#if selectedPlayerBreakdown}
							<div class="premium-table-container w-full overflow-x-auto">
								<table class="premium-table">
									<thead>
										<tr class="stats-table-header">
											<th class="px-4 py-3">Tidsfönster</th>
											<th class="px-4 py-3 text-center">Spel</th>
											<th class="px-4 py-3 text-center text-red-400">Skitgubbe</th>
											<th class="px-4 py-3 text-center text-pink-400">Sweetgubbe</th>
											<th class="px-4 py-3 text-center text-blue-400">Trumfman</th>
											<th class="px-4 py-3 text-center text-amber-400">Förstoppad</th>
										</tr>
									</thead>
									<tbody class="">
										<!-- Last 10 games row -->
										<tr class="transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-slate-300">Senaste 10</td>
											<td class="px-4 py-3 text-center font-bold text-slate-100"
												>{selectedPlayerBreakdown.last10.games}</td
											>
											<td class="px-4 py-3 text-center font-bold text-red-400/90"
												>{selectedPlayerBreakdown.last10.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-pink-400/90"
												>{selectedPlayerBreakdown.last10.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-blue-400/90"
												>{selectedPlayerBreakdown.last10.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last10.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.last10.mega_constipated})</span
												>
											</td>
										</tr>
										<!-- Last 50 games row -->
										<tr class="transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-slate-300">Senaste 50</td>
											<td class="px-4 py-3 text-center font-bold text-slate-100"
												>{selectedPlayerBreakdown.last50.games}</td
											>
											<td class="px-4 py-3 text-center font-bold text-red-400/90"
												>{selectedPlayerBreakdown.last50.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-pink-400/90"
												>{selectedPlayerBreakdown.last50.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-bold text-blue-400/90"
												>{selectedPlayerBreakdown.last50.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-bold text-amber-400/90">
												{selectedPlayerBreakdown.last50.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.last50.mega_constipated})</span
												>
											</td>
										</tr>
										<!-- All-time games row -->
										<tr class="bg-white/5 transition-colors hover:bg-white/5">
											<td class="px-4 py-3 font-bold text-amber-400">All-Time</td>
											<td class="px-4 py-3 text-center font-extrabold text-slate-100"
												>{selectedPlayerBreakdown.all.games}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-red-400/90"
												>{selectedPlayerBreakdown.all.skitgubbe}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-pink-400/90"
												>{selectedPlayerBreakdown.all.sweetgubbe}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-blue-400/90"
												>{selectedPlayerBreakdown.all.trumfman}</td
											>
											<td class="px-4 py-3 text-center font-extrabold text-amber-400/90">
												{selectedPlayerBreakdown.all.constipated}
												<span class="text-[10px] font-medium text-amber-500/60"
													>(Mega: {selectedPlayerBreakdown.all.mega_constipated})</span
												>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Skitgubbe History Log Modal Overlay -->
{#if showHistoryModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.8)] w-full max-w-md flex-col gap-6 overflow-hidden p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				onclick={() => (showHistoryModal = false)}
				class="absolute top-4 right-4 z-10 cursor-pointer text-slate-400 transition-colors hover:text-white md:top-6 md:right-6"
				aria-label="Close log"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<div class="px-10 text-center">
				<h2
					class="flex items-center justify-center gap-2 font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase"
				>
					Skitgubbe Log
				</h2>
			</div>

			<div class="flex-1 overflow-y-auto pr-1">
				{#if skitgubbeHistory.length === 0}
					<p class="py-8 text-center text-sm font-medium text-slate-500">
						No history entries found.
					</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each skitgubbeHistory as entry}
							<div
								class="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/50 p-3 transition-colors hover:bg-slate-900/80"
							>
								<div class="flex items-center gap-3">
									<Avatar
										avatarConfig={entry.profile_avatar}
										fallbackColor={entry.profile_color}
										fallbackName={entry.profile_name}
										class="h-10 w-10 rounded-xl"
									/>
									<div class="flex flex-col">
										<span class="text-sm font-bold text-slate-200">{entry.profile_name}</span>
									</div>
								</div>
								<span class="text-[11px] font-medium text-slate-400">
									{timeAgo(entry.acquired_at)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Access Logs Modal -->
{#if showLogsModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.8)] w-full max-w-md flex-col gap-6 overflow-hidden p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<button
				type="button"
				onclick={() => (showLogsModal = false)}
				class="absolute top-4 right-4 z-10 cursor-pointer text-slate-400 transition-colors hover:text-white md:top-6 md:right-6"
				aria-label="Close logins"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<div class="px-10 text-center">
				<h2
					class="flex items-center justify-center gap-2 font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase"
				>
					Senaste inloggningarna
				</h2>
			</div>

			<div class="custom-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
				{#if accessLogs.length === 0}
					<p class="py-8 text-center text-sm font-medium text-slate-500">No access logs found.</p>
				{:else}
					<div class="flex flex-col gap-3">
						{#each accessLogs as log}
							<div class="modal-inner-glass flex flex-col gap-2 p-4">
								<div class="flex items-start justify-between gap-2">
									<span class="text-sm font-semibold break-all text-slate-200"
										>{log.ip_address}</span
									>
									<span class="text-xs whitespace-nowrap text-slate-400">
										{new Date(normalizeTimestamp(log.accessed_at)).toLocaleString()}
									</span>
								</div>
								<p class="line-clamp-2 text-xs text-slate-400" title={log.device_info}>
									{log.device_info}
								</p>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Invite Players Modal Overlay -->
{#if showInviteModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex w-full max-w-md flex-col gap-6 p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="text-center">
				<h2 class="font-serif text-3xl font-bold text-slate-100">Bjud in spelare</h2>
			</div>

			<div class="flex flex-col gap-2 text-left">
				<label for="new_room_name" class="text-xs font-bold tracking-wider text-slate-400 uppercase"
					>Namn på spelet</label
				>
				<input
					id="new_room_name"
					type="text"
					bind:value={newRoomName}
					placeholder=""
					class="rounded-none border border-amber-900/40 bg-slate-950/60 px-4 py-3 text-base text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
					maxlength="20"
				/>
			</div>

			{#if otherProfiles.length === 0}
				<div class="flex flex-col items-center gap-2 py-4">
					<p class="text-center text-sm font-semibold text-amber-500/80">
						Inga andra konton finns.
					</p>
					<p class="text-center text-xs text-slate-400">
						Det måste finnas minst en annan spelare för att skapa ett spel.
					</p>
				</div>
			{:else}
				<div
					bind:this={scrollContainer}
					onmousedown={handleMouseDown}
					role="presentation"
					class="no-scrollbar flex w-full cursor-grab snap-x gap-4 overflow-x-auto pb-4 select-none active:cursor-grabbing"
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
									selectedInviteIds = selectedInviteIds.filter((id) => id !== p.id);
								} else {
									if (selectedInviteIds.length >= 9) return;
									selectedInviteIds = [...selectedInviteIds, p.id];
								}
							}}
							class="flex shrink-0 cursor-pointer snap-center flex-col items-center gap-2 border p-3 text-center transition-all {isSelected
								? 'border-amber-500 bg-amber-500/10'
								: 'border-transparent hover:bg-slate-900/50'}"
						>
							<div class="relative">
								<Avatar
									avatarConfig={p.avatar_config}
									fallbackColor={p.color}
									fallbackName={p.name}
									class="h-14 w-14 rounded-full {isSelected ? 'ring-2 ring-amber-500' : ''}"
								/>
								{#if isSelected}
									<div
										class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-500"
									>
										<span class="text-[10px] font-bold text-slate-950">✓</span>
									</div>
								{/if}
							</div>
							<span class="w-16 truncate text-xs font-semibold text-slate-200">{p.name}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div class="mt-2 flex gap-3">
				<button
					type="button"
					onclick={() => {
						showInviteModal = false;
						selectedInviteIds = [];
						newRoomName = '';
						isDragging = false;
						dragMoved = false;
					}}
					class="premium-modal-btn premium-modal-btn-secondary flex-1"
				>
					<span class="premium-modal-btn-content">Avbryt</span>
				</button>
				<button
					type="button"
					onclick={handleCreateGameConfirm}
					disabled={selectedInviteIds.length === 0}
					class="premium-modal-btn premium-modal-btn-primary flex-1"
				>
					<span class="premium-modal-btn-content">Skapa spelet</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Game Archive Modal Overlay -->
{#if showArchiveModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.9)] w-full max-w-2xl flex-col gap-6 overflow-hidden p-6 md:p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between border-b border-white/5 pb-4">
				<div class="flex items-center gap-2">
					<h2 class="font-serif text-3xl font-bold tracking-wide text-slate-100 uppercase">
						Arkiverade spel
					</h2>
				</div>
				<button
					onclick={() => (showArchiveModal = false)}
					class="cursor-pointer text-slate-400 transition-colors hover:text-white"
					aria-label="Close archive"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Modal Content -->
			<div class="flex-1 overflow-y-auto pr-1">
				{#if archivedGames.length === 0}
					<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
						<p class="text-slate-450 text-sm">Du har inga arkiverade spel.</p>
					</div>
				{:else}
					<div class="flex flex-col gap-3">
						{#each archivedGames as g}
							<div
								class="modal-inner-glass flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-all hover:border-white/10"
							>
								<div class="min-w-0 flex-1">
									<div class="mb-1.5 flex items-center gap-2">
										<span
											class="max-w-[180px] truncate font-semibold text-slate-200 sm:max-w-[280px]"
										>
											{g.name || g.id}
										</span>
										<span
											class="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase {g.status ===
											'ended'
												? 'border border-red-500/20 bg-red-500/10 text-red-400'
												: 'border border-amber-500/20 bg-amber-500/10 text-amber-400'}"
										>
											{g.status === 'ended' ? 'Finished' : 'Archived'}
										</span>
									</div>

									{#if g.status === 'ended' && g.loser_name}
										<div class="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
											<span>Skitgubbe:</span>
											<span
												class="flex items-center gap-1 font-bold"
												style="color: {g.loser_color || '#ef4444'}"
											>
												<Avatar
													avatarConfig={g.loser_avatar_config}
													fallbackColor={g.loser_color || '#ef4444'}
													fallbackName={g.loser_name}
													class="h-3.5 w-3.5 rounded-full"
												/>
												{g.loser_name}
											</span>
										</div>
									{/if}

									<div class="mt-1.5 font-mono text-[10px] text-slate-500">
										Last played {formatTime(g.updated_at)}
									</div>
								</div>

								<div class="flex items-center gap-2">
									{#if g.status === 'ended'}
										<a
											href={`/room/${g.id}`}
											class="text-slate-350 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold transition-all hover:text-white active:scale-95"
										>
											View Board
										</a>
									{:else}
										<button
											onclick={() => restoreGame(g.id)}
											class="text-emerald-450 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-emerald-500/20 hover:text-white active:scale-95"
										>
											Restore
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
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

	.profile-chip-container {
		font-family: 'Cormorant Garamond', Georgia, serif;
	}

	.archive-selection-header {
		font-family: 'Cormorant Garamond', Georgia, serif;
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
				/* Soft white-gold highlight */ #e3ba5a 25%,
				/* Mid-tone warm gold */ #b88728 45%,
				/* Deeper bronze reflection */ #fceeac 55%,
				/* Sharp metallic light streak */ #d19f33 70%,
				/* Rich gold */ #875c12 100% /* Deep shadow for weight */
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
		/* Deep multi-stop gradient mimicking reflective metallic chrome/gold */
		background: linear-gradient(
			135deg,
			#ffe89e 0%,
			/* Soft white-gold highlight */ #e3ba5a 25%,
			/* Mid-tone warm gold */ #b88728 45%,
			/* Deeper bronze reflection */ #fceeac 55%,
			/* Sharp metallic light streak */ #d19f33 70%,
			/* Rich gold */ #875c12 100% /* Deep shadow for weight */
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
		/* Shifting the gradient stops slightly on hover creates a "shimmer" effect */
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

	@keyframes shimmer-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	/* 3D Swinging Notice Board Display */
	.notice-board-container {
		perspective: 1200px;
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.notice-board-3d {
		position: relative;
		width: 100%;
		max-width: 580px; /* Scaled up from 360px */
		aspect-ratio: 1 / 1;
		transform-style: preserve-3d;
		transform-origin: 50% -35%; /* pivot from the top of extended ropes (ceiling) */
		transform: rotateX(calc(var(--tilt-x, 0deg) + var(--swing-x, 0deg))) rotateY(var(--tilt-y, 0deg)) rotateZ(0deg);
		cursor: pointer;
		background-color: transparent;
		border: none;
		padding: 0;
		display: block;
		user-select: none;
		container-type: inline-size;
		touch-action: none;
	}

	/* Stacked real texture rope segments up to ceiling */
	.rope-segment-container {
		position: absolute;
		left: 0;
		width: 100%;
		height: 30cqw;
		overflow: hidden;
		pointer-events: none;
		transform: translateZ(-2px); /* place behind front board layer to mask connections */
		transform-style: preserve-3d;
	}

	.rope-segment-image {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 333.3%; /* 100 / 30 = 333.3% to scale ropes up */
		background-image: url('/notice_board.png');
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center top;
	}

	.board-layer {
		position: absolute;
		inset: 0;
		background-image: url('/notice_board.png');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		pointer-events: none;
	}

	/* Layered sandwich depth */
	.board-layer-back-3 {
		transform: translateZ(-6px);
		filter: brightness(0.35) contrast(1.1);
	}
	.board-layer-back-2 {
		transform: translateZ(-4px);
		filter: brightness(0.55);
	}
	.board-layer-back-1 {
		transform: translateZ(-2px);
		filter: brightness(0.75);
	}
	.board-layer-front {
		transform: translateZ(0px);
		filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.5));
	}

	.skitgubbe-poster.on-board {
		position: absolute;
		top: 67%;
		left: 50%;
		width: 36%;
		aspect-ratio: 1792 / 2400;
		background-image: url('/skitgubbe_transparent.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		background-color: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		transform: translate3d(-50%, -50%, 2px) rotate(-1.5deg);
		transform-style: preserve-3d;
		transition:
			transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
			filter 0.2s ease;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.35));
	}

	.skitgubbe-poster.on-board.default-poster {
		transform: translate3d(-50%, -50%, 2px) rotate(1deg);
	}

	.skitgubbe-poster.on-board:hover {
		transform: translate3d(-50%, -50%, 8px) rotate(-2.5deg) scale(1.05);
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.5));
	}

	.skitgubbe-poster.on-board.default-poster:hover {
		transform: translate3d(-50%, -50%, 8px) rotate(2deg) scale(1.05);
	}

	.skitgubbe-poster-name {
		font-family: 'Nanum Brush Script', cursive;
		font-size: 8.5cqw; /* Auto-scales based on board size */
		font-weight: 700;
		color: #2e2315; /* Dark ink on parchment */
		margin-top: 0.35rem;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	/* Adjust padding & notice board sizing on short screens for landscape mobile layout */
	@media (max-height: 540px) {
		.skitgubbe-left-col {
			padding-top: 0.5rem !important;
		}
		.notice-board-3d {
			max-width: 360px;
		}
	}

	@media (max-height: 420px) {
		.skitgubbe-left-col {
			padding-top: 0.25rem !important;
		}
		.notice-board-3d {
			max-width: 300px;
		}
	}

	@media (max-height: 340px) {
		.skitgubbe-left-col {
			padding-top: 0.1rem !important;
		}
		.notice-board-3d {
			max-width: 220px;
		}
	}

	/* Profile Select Screen - Mobile Responsiveness & Scrolling */
	.profile-select-list {
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: rgba(245, 158, 11, 0.3) rgba(255, 255, 255, 0.03);
	}

	/* Premium scrollbar for the profile list when scrollable */
	.profile-select-list::-webkit-scrollbar {
		height: 6px;
		width: 6px;
	}
	.profile-select-list::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 3px;
	}
	.profile-select-list::-webkit-scrollbar-thumb {
		background: rgba(245, 158, 11, 0.3); /* Amber accent color */
		border-radius: 3px;
	}
	.profile-select-list::-webkit-scrollbar-thumb:hover {
		background: rgba(245, 158, 11, 0.6);
	}

	/* Mobile Landscape (Horizontal) */
	@media (max-width: 932px) and (orientation: landscape) {
		.profile-selector-container {
			gap: 1.5rem !important;
		}

		.profile-select-list {
			display: flex !important;
			flex-direction: row !important;
			flex-wrap: nowrap !important;
			overflow-x: auto !important;
			overflow-y: hidden !important;
			width: 100%;
			max-width: 100%;
			padding: 1rem 2rem !important;
			gap: 1.5rem !important;
			justify-content: flex-start !important;
			scroll-snap-type: x mandatory;
		}

		.profile-select-list > button {
			flex: 0 0 auto !important;
			scroll-snap-align: center;
		}
	}

	/* Mobile Portrait (Vertical) */
	@media (max-width: 640px) and (orientation: portrait) {
		.profile-select-list {
			max-height: calc(var(--app-height) * 0.6);
			overflow-y: auto !important;
			padding: 1rem 0.5rem !important;
		}
	}
</style>
