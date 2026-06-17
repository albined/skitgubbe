import { dev } from '$app/environment';

export const PRESET_COLORS = [
	'#3b82f6', // blue
	'#10b981', // emerald
	'#f59e0b', // amber
	'#ef4444', // red
	'#8b5cf6', // violet
	'#ec4899', // pink
	'#14b8a6', // teal
	'#f97316' // orange
];

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

export class LobbyState {
	activeProfile = $state<any>(null);
	profiles = $state<any[]>([]);
	games = $state<any[]>([]);
	isLoading = $state<boolean>(true);

	// Modal visibility
	showCreateModal = $state(false);
	showLogsModal = $state(false);
	showStatsModal = $state(false);
	showHistoryModal = $state(false);
	showArchiveModal = $state(false);
	showInviteModal = $state(false);
	showProfileDropdown = $state(false);

	// Modal sub-states
	accessLogs = $state<any[]>([]);
	skitgubbeHistory = $state<any[]>([]);
	archivedGames = $state<any[]>([]);
	selectedGamesToArchive = $state<string[]>([]);
	isArchiveMode = $state(false);

	statsTab = $state<'all' | 'personal'>('all');
	allPlayersStats = $state<any[]>([]);
	selectedStatsProfileId = $state<string>('');
	selectedPlayerBreakdown = $state<any>(null);

	// Form fields
	newProfileName = $state('');
	newProfileColor = $state('#3b82f6');
	createError = $state('');

	selectedInviteIds = $state<string[]>([]);
	newRoomName = $state('');

	notificationsSupported = $state(false);
	notificationsEnabled = $state(false);
	isTogglingNotifications = $state(false);

	currentSkitgubbe = $state<any>(null);

	private isFetchingGames = false;

	selectedStatsProfile = $derived(this.profiles.find((p) => p.id === this.selectedStatsProfileId));
	pendingInvitations = $derived(this.games.filter((g) => g.invite_status === 'pending'));
	activeGames = $derived(this.games.filter((g) => g.invite_status === 'accepted'));
	otherProfiles = $derived(this.profiles.filter((p) => p.id !== this.activeProfile?.id));

	async init(): Promise<void> {
		await this.checkAuth();
		await this.loadProfiles();
		await this.loadCurrentSkitgubbe();
		await this.initNotifications();
		this.isLoading = false;
	}

	async checkAuth(): Promise<void> {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				this.activeProfile = await res.json();
				// Sync to local/session storage for backward compatibility with the game room
				sessionStorage.setItem('skitgubbe_playerId', this.activeProfile.id);
				sessionStorage.setItem('skitgubbe_playerName', this.activeProfile.name);
				sessionStorage.setItem('skitgubbe_playerColor', this.activeProfile.color);
				await this.loadGames();
				await this.loadCurrentSkitgubbe();
			} else {
				this.activeProfile = null;
			}
		} catch (e) {
			console.error('Auth check failed:', e);
			this.activeProfile = null;
		}
	}

	async loadProfiles(): Promise<void> {
		try {
			const res = await fetch('/api/profiles');
			if (res.ok) {
				this.profiles = await res.json();
			}
		} catch (e) {
			console.error('Failed to load profiles:', e);
		}
	}

	async loadCurrentSkitgubbe(): Promise<void> {
		try {
			const res = await fetch('/api/skitgubbe/current');
			if (res.ok) {
				this.currentSkitgubbe = await res.json();
			}
		} catch (e) {
			console.error('Failed to load current skitgubbe:', e);
		}
	}

	async initNotifications(): Promise<void> {
		this.notificationsSupported = 'serviceWorker' in navigator && 'PushManager' in window;
		if (!this.notificationsSupported) return;

		try {
			// Prevent hanging in dev mode where no service worker is registered
			const regs = await navigator.serviceWorker.getRegistrations();
			if (regs.length === 0 && dev) {
				this.notificationsSupported = false;
				return;
			}

			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			this.notificationsEnabled = !!sub;

			// If subscribed, sync with active profile to be sure
			if (sub && this.activeProfile) {
				const syncKey = `push_synced:${this.activeProfile.id}:${sub.endpoint}`;
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

	async selectProfile(id: string): Promise<void> {
		try {
			const res = await fetch(`/api/profiles/${id}/select`, { method: 'POST' });
			if (res.ok) {
				await this.checkAuth();

				// Sync existing push subscription to the newly selected profile
				if (this.notificationsSupported) {
					try {
						const reg = await navigator.serviceWorker.ready;
						const sub = await reg.pushManager.getSubscription();
						if (sub && this.activeProfile) {
							const syncKey = `push_synced:${this.activeProfile.id}:${sub.endpoint}`;
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

	async handleCreateProfile(name: string, color: string): Promise<void> {
		const trimmedName = name.trim();
		if (!trimmedName) {
			this.createError = 'Skriv in ett namn.';
			return;
		}
		this.createError = '';

		try {
			const res = await fetch('/api/profiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmedName, color })
			});

			if (res.ok) {
				const profile = await res.json();
				this.newProfileName = '';
				this.newProfileColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
				this.showCreateModal = false;
				await this.loadProfiles();
				// Automatically select the newly created profile
				await this.selectProfile(profile.id);
			} else {
				const data = await res.json();
				this.createError = data.error || 'Failed to create profile.';
			}
		} catch (e) {
			this.createError = 'Server error occurred.';
		}
	}

	async handleLogout(): Promise<void> {
		try {
			const res = await fetch('/api/profiles/logout', { method: 'POST' });
			if (res.ok) {
				this.activeProfile = null;
				this.games = [];
				// Clear storage helpers
				sessionStorage.removeItem('skitgubbe_playerId');
				sessionStorage.removeItem('skitgubbe_playerName');
				sessionStorage.removeItem('skitgubbe_playerColor');
				await this.loadProfiles();
			}
		} catch (e) {
			console.error('Logout failed:', e);
		}
	}

	async openSkitgubbeHistory(): Promise<void> {
		this.showHistoryModal = true;
		try {
			const res = await fetch('/api/skitgubbe/history');
			if (res.ok) {
				this.skitgubbeHistory = await res.json();
			}
		} catch (e) {
			console.error('Failed to load skitgubbe history:', e);
		}
	}

	async openStatsDashboard(): Promise<void> {
		this.showStatsModal = true;
		this.statsTab = 'all';
		this.selectedStatsProfileId = this.activeProfile?.id || '';
		await this.loadAllStats();
		if (this.selectedStatsProfileId) {
			await this.loadPlayerBreakdown(this.selectedStatsProfileId);
		}
	}

	async loadAllStats(): Promise<void> {
		try {
			const res = await fetch('/api/statistics');
			if (res.ok) {
				this.allPlayersStats = await res.json();
			}
		} catch (e) {
			console.error('Failed to load all stats:', e);
		}
	}

	async loadPlayerBreakdown(profileId: string): Promise<void> {
		if (!profileId) return;
		try {
			const res = await fetch(`/api/statistics/${profileId}`);
			if (res.ok) {
				this.selectedPlayerBreakdown = await res.json();
			}
		} catch (e) {
			console.error('Failed to load player breakdown:', e);
		}
	}

	handleSelectStatsProfile(profileId: string): void {
		this.selectedStatsProfileId = profileId;
		this.loadPlayerBreakdown(profileId);
	}

	async loadAccessLogs(): Promise<void> {
		try {
			const res = await fetch('/api/profiles/me/logs');
			if (res.ok) {
				this.accessLogs = await res.json();
			}
		} catch (e) {
			console.error('Failed to load access logs:', e);
		}
	}

	toggleArchiveSelection(roomId: string): void {
		if (this.selectedGamesToArchive.includes(roomId)) {
			this.selectedGamesToArchive = this.selectedGamesToArchive.filter((id) => id !== roomId);
		} else {
			this.selectedGamesToArchive = [...this.selectedGamesToArchive, roomId];
		}
	}

	async handleArchiveSelected(): Promise<void> {
		if (this.selectedGamesToArchive.length === 0) return;
		try {
			const res = await fetch('/api/games/archive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameIds: this.selectedGamesToArchive })
			});
			if (res.ok) {
				this.selectedGamesToArchive = [];
				this.isArchiveMode = false;
				await this.loadGames();
			}
		} catch (e) {
			console.error('Failed to archive games:', e);
		}
	}

	async restoreGame(roomId: string): Promise<void> {
		try {
			const res = await fetch('/api/games/unarchive', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gameIds: [roomId] })
			});
			if (res.ok) {
				await this.loadArchivedGames();
				await this.loadGames();
			}
		} catch (e) {
			console.error('Failed to restore game:', e);
		}
	}

	async acceptGame(roomId: string): Promise<void> {
		try {
			const res = await fetch(`/api/games/${roomId}/accept`, { method: 'POST' });
			if (res.ok) {
				await this.loadGames();
				window.location.href = `/room/${roomId}`;
			}
		} catch (e) {
			console.error('Failed to accept game:', e);
		}
	}

	async declineGame(roomId: string): Promise<void> {
		try {
			const res = await fetch(`/api/games/${roomId}/decline`, { method: 'POST' });
			if (res.ok) {
				await this.loadGames();
			}
		} catch (e) {
			console.error('Failed to decline game:', e);
		}
	}

	async loadGames(): Promise<void> {
		if (this.isFetchingGames) return;
		this.isFetchingGames = true;
		try {
			const res = await fetch('/api/games');
			if (res.ok) {
				this.games = await res.json();
			}
		} catch (e) {
			console.error('Failed to load games:', e);
		} finally {
			this.isFetchingGames = false;
		}
	}

	async loadArchivedGames(): Promise<void> {
		try {
			const res = await fetch('/api/games/archived');
			if (res.ok) {
				this.archivedGames = await res.json();
			}
		} catch (e) {
			console.error('Failed to load archived games:', e);
		}
	}

	async openArchiveModal(): Promise<void> {
		await this.loadArchivedGames();
		this.showArchiveModal = true;
	}

	async handleCreateGameConfirm(): Promise<void> {
		if (this.selectedInviteIds.length === 0) return;
		try {
			const res = await fetch('/api/games/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: this.newRoomName, invitedProfileIds: this.selectedInviteIds })
			});
			if (res.ok) {
				const data = await res.json();
				this.showInviteModal = false;
				this.selectedInviteIds = [];
				this.newRoomName = '';
				window.location.href = `/room/${data.roomId}`;
			}
		} catch (e) {
			console.error('Failed to create game:', e);
		}
	}

	async toggleNotifications(): Promise<void> {
		if (!this.notificationsSupported || this.isTogglingNotifications) return;
		this.isTogglingNotifications = true;
		try {
			const reg = await navigator.serviceWorker.ready;
			if (this.notificationsEnabled) {
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
						this.notificationsEnabled = false;
						if (this.activeProfile) {
							localStorage.removeItem(`push_synced:${this.activeProfile.id}:${sub.endpoint}`);
						}
					} else {
						console.error('Failed to unsubscribe from server');
					}
				} else {
					this.notificationsEnabled = false;
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
					this.notificationsEnabled = true;
					if (this.activeProfile) {
						localStorage.setItem(`push_synced:${this.activeProfile.id}:${sub.endpoint}`, 'true');
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
			this.isTogglingNotifications = false;
		}
	}
}
