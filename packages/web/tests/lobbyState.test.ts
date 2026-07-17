import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { compileModule } from 'svelte/compiler';

const STATE_FILE_PATH = path.join(__dirname, '../src/lib/state/lobbyState.svelte.ts');
const COMPILED_FILE_PATH = path.join(__dirname, 'lobbyState.test-compiled.js');

function mockResponse(ok: boolean, data: any, status = 200) {
	return {
		ok,
		status,
		json: () => Promise.resolve(data),
		text: () => Promise.resolve(data !== null && data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : '')
	} as any;
}

let LobbyState: any;
let PRESET_COLORS: string[];

// Store original navigator and window properties to restore them
const originalServiceWorker = Object.getOwnPropertyDescriptor(
	globalThis.navigator,
	'serviceWorker'
);

beforeAll(async () => {
	// 1. Read the source of lobbyState.svelte.ts
	let source = fs.readFileSync(STATE_FILE_PATH, 'utf8');

	// 2. Remove the SvelteKit environment import
	source = source.replace("import { dev } from '$app/environment';", '');

	// 3. Replace the 'dev' variable reference dynamically using word boundaries
	source = source.replace(/\bdev\b/g, '((globalThis as any).__DEV_MODE__ !== false)');

	// 4. Transpile TypeScript to pure JavaScript using Bun's Transpiler to strip TS annotations
	const transpiler = new Bun.Transpiler({ loader: 'ts' });
	const pureJs = transpiler.transformSync(source);

	// 5. Compile the module using Svelte 5 compiler
	const result = compileModule(pureJs, {
		filename: 'lobbyState.svelte.js',
		dev: true
	});

	// 6. Write the compiled JavaScript to disk
	fs.writeFileSync(COMPILED_FILE_PATH, result.js.code, 'utf8');

	// 7. Setup mocks for browser globals before importing Svelte runtime
	globalThis.window = {
		atob: (str: string) => Buffer.from(str, 'base64').toString('binary')
	} as any;

	Object.defineProperty(globalThis.navigator, 'serviceWorker', {
		value: undefined,
		configurable: true,
		writable: true
	});

	globalThis.localStorage = {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {}
	} as any;
	globalThis.sessionStorage = {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {}
	} as any;

	// 8. Dynamically import the compiled module
	const mod = await import('./lobbyState.test-compiled.js');
	LobbyState = mod.LobbyState;
	PRESET_COLORS = mod.PRESET_COLORS;
});

afterAll(() => {
	// Clean up temporary compiled file
	if (fs.existsSync(COMPILED_FILE_PATH)) {
		fs.unlinkSync(COMPILED_FILE_PATH);
	}
	// Restore navigator.serviceWorker
	if (originalServiceWorker) {
		Object.defineProperty(globalThis.navigator, 'serviceWorker', originalServiceWorker);
	} else {
		Object.defineProperty(globalThis.navigator, 'serviceWorker', { value: undefined });
	}
});

function setBrowserMocks(serviceWorkerMock: any, pushManagerMock: any) {
	if (pushManagerMock) {
		globalThis.window = {
			PushManager: pushManagerMock,
			atob: (str: string) => Buffer.from(str, 'base64').toString('binary')
		} as any;
	} else {
		globalThis.window = {
			atob: (str: string) => Buffer.from(str, 'base64').toString('binary')
		} as any;
	}

	Object.defineProperty(globalThis.navigator, 'serviceWorker', {
		value: serviceWorkerMock,
		configurable: true,
		writable: true
	});
}

describe('LobbyState Controller - Empirical Robustness Tests', () => {
	test('SSR Safety: Constructor and property initialization do not touch browser globals', () => {
		// Temporarily delete window/navigator to simulate server environment
		const oldWindow = globalThis.window;
		const oldLocalStorage = globalThis.localStorage;
		const oldSessionStorage = globalThis.sessionStorage;

		(globalThis as any).window = undefined;
		(globalThis as any).localStorage = undefined;
		(globalThis as any).sessionStorage = undefined;

		Object.defineProperty(globalThis.navigator, 'serviceWorker', {
			value: undefined,
			configurable: true,
			writable: true
		});

		try {
			const state = new LobbyState();
			expect(state).toBeDefined();
			expect(state.isLoading).toBe(true);
			expect(state.showCreateModal).toBe(false);
			expect(Array.isArray(state.profiles)).toBe(true);
			expect(Array.isArray(state.games)).toBe(true);
			expect(Array.isArray(state.pendingInvitations)).toBe(true);
			expect(Array.isArray(state.activeGames)).toBe(true);
		} finally {
			// Restore globals
			globalThis.window = oldWindow;
			globalThis.localStorage = oldLocalStorage;
			globalThis.sessionStorage = oldSessionStorage;
		}
	});

	test('Graceful Degradation: Fetch exceptions are caught without throwing unhandled errors', async () => {
		const oldConsoleError = console.error;
		console.error = () => {};
		try {
			const state = new LobbyState();

			// Mock fetch to reject (throw network error)
			globalThis.fetch = () => Promise.reject(new Error('Network failure'));

			// Call key methods that make network requests and ensure they do not throw
			await expect(state.checkAuth()).resolves.toBeUndefined();
			await expect(state.loadProfiles()).resolves.toBeUndefined();
			await expect(state.loadCurrentSkitgubbe()).resolves.toBeUndefined();
			await expect(state.loadGames()).resolves.toBeUndefined();
			await expect(state.loadArchivedGames()).resolves.toBeUndefined();
			await expect(state.loadAccessLogs()).resolves.toBeUndefined();
			await expect(state.restoreGame('room123')).resolves.toBeUndefined();
			await expect(state.acceptGame('room123')).resolves.toBeUndefined();
			await expect(state.declineGame('room123')).resolves.toBeUndefined();

			// Verify state fallback behaviors
			expect(state.activeProfile).toBeNull();
			expect(state.profiles).toEqual([]);
			expect(state.games).toEqual([]);
		} finally {
			console.error = oldConsoleError;
		}
	});

	test('Graceful Degradation: Handles API non-OK statuses (e.g. 500, 404, 401)', async () => {
		const oldConsoleError = console.error;
		console.error = () => {};
		try {
			const state = new LobbyState();

			// Mock fetch returning status 500
			globalThis.fetch = () =>
				Promise.resolve(mockResponse(false, { error: 'Internal Server Error' }, 500));

			await state.checkAuth();
			expect(state.activeProfile).toBeNull();

			await state.loadProfiles();
			expect(state.profiles).toEqual([]);

			// Create profile handles error response
			await state.handleCreateProfile('Test Profile', '#3b82f6');
			expect(state.createError).toBe('Internal Server Error');
		} finally {
			console.error = oldConsoleError;
		}
	});

	test('Notification Setup: Handles lack of browser push support safely', async () => {
		const state = new LobbyState();

		// Case 1: missing serviceWorker and PushManager
		setBrowserMocks(undefined, undefined);

		await state.initNotifications();
		expect(state.notificationsSupported).toBe(false);
		expect(state.notificationsEnabled).toBe(false);
	});

	test('Notification Setup: Aborts in dev mode when no service worker is registered (avoids hanging)', async () => {
		const state = new LobbyState();

		// Simulate dev mode
		(globalThis as any).__DEV_MODE__ = true;

		// Mock serviceWorker interface with 0 registrations
		setBrowserMocks(
			{
				getRegistrations: () => Promise.resolve([])
			},
			{}
		);

		await state.initNotifications();
		expect(state.notificationsSupported).toBe(false);
		expect(state.notificationsEnabled).toBe(false);
	});

	test('Notification Setup: Proceeds to ready promise in production mode even with 0 registrations', async () => {
		const state = new LobbyState();

		// Simulate production mode
		(globalThis as any).__DEV_MODE__ = false;

		let readyCalled = false;
		// Mock serviceWorker interface with 0 registrations, but ready promise defined
		setBrowserMocks(
			{
				getRegistrations: () => Promise.resolve([]),
				get ready() {
					readyCalled = true;
					return Promise.resolve({
						pushManager: {
							getSubscription: () => Promise.resolve(null)
						}
					});
				}
			},
			{}
		);

		await state.initNotifications();
		expect(state.notificationsSupported).toBe(true);
		expect(state.notificationsEnabled).toBe(false);
		expect(readyCalled).toBe(true);
	});

	test('Profile creation input validation and edge cases', async () => {
		const state = new LobbyState();

		// Case 1: Empty name
		await state.handleCreateProfile('', '#3b82f6');
		expect(state.createError).toBe('Skriv in ett namn.');

		// Case 2: Whitespace only name
		await state.handleCreateProfile('    ', '#3b82f6');
		expect(state.createError).toBe('Skriv in ett namn.');

		// Case 3: Valid name - successful response
		let postPayload: any = null;
		globalThis.fetch = (url: any, init: any) => {
			if (url === '/api/profiles' && init?.method === 'POST') {
				postPayload = JSON.parse(init.body);
				return Promise.resolve(mockResponse(true, { id: 'p123', name: 'Name', color: '#3b82f6' }));
			}
			return Promise.resolve(mockResponse(true, []));
		};

		state.newProfileName = 'Name';
		state.newProfileColor = '#3b82f6';
		await state.handleCreateProfile('Name', '#3b82f6');

		expect(state.createError).toBe('');
		expect(state.newProfileName).toBe('');
		expect(postPayload).toEqual({ name: 'Name', color: '#3b82f6' });
	});

	test('Logout clears storage and states correctly', async () => {
		const state = new LobbyState();
		state.activeProfile = { id: 'p123', name: 'Name' };
		state.games = [{ id: 'game1' }];

		let clearedKeys: string[] = [];
		const oldSessionStorage = globalThis.sessionStorage;
		(globalThis as any).sessionStorage = {
			getItem: () => null,
			setItem: () => {},
			removeItem: (key: string) => clearedKeys.push(key)
		};

		globalThis.fetch = (url: any, init: any) => {
			if (url === '/api/profiles/logout' && init?.method === 'POST') {
				return Promise.resolve(mockResponse(true, null));
			}
			return Promise.resolve(mockResponse(true, []));
		};

		try {
			await state.handleLogout();
		} finally {
			globalThis.sessionStorage = oldSessionStorage;
		}

		expect(state.activeProfile).toBeNull();
		expect(state.games).toEqual([]);
		expect(clearedKeys).toContain('skitgubbe_playerId');
		expect(clearedKeys).toContain('skitgubbe_playerName');
		expect(clearedKeys).toContain('skitgubbe_playerColor');
	});

	test('Game batch archiving selection mechanisms', async () => {
		const state = new LobbyState();

		expect(state.selectedGamesToArchive).toEqual([]);

		// Toggle to add
		state.toggleArchiveSelection('roomA');
		expect(state.selectedGamesToArchive).toEqual(['roomA']);

		state.toggleArchiveSelection('roomB');
		expect(state.selectedGamesToArchive).toEqual(['roomA', 'roomB']);

		// Toggle to remove
		state.toggleArchiveSelection('roomA');
		expect(state.selectedGamesToArchive).toEqual(['roomB']);

		// Call archive when selection is empty
		state.selectedGamesToArchive = [];
		let fetchCalled = false;
		globalThis.fetch = () => {
			fetchCalled = true;
			return Promise.resolve(mockResponse(true, null));
		};
		await state.handleArchiveSelected();
		expect(fetchCalled).toBe(false);

		// Call archive with selection
		state.selectedGamesToArchive = ['roomB'];
		let archivePayload: any = null;
		globalThis.fetch = (url: any, init: any) => {
			fetchCalled = true;
			if (init?.body) {
				archivePayload = JSON.parse(init.body);
			}
			return Promise.resolve(mockResponse(true, []));
		};

		await state.handleArchiveSelected();
		expect(fetchCalled).toBe(true);
		expect(archivePayload).toEqual({ gameIds: ['roomB'] });
		expect(state.selectedGamesToArchive).toEqual([]);
		expect(state.isArchiveMode).toBe(false);
	});

	test('checkAuth, init, and selectProfile fetch behavior', async () => {
		globalThis.sessionStorage = {
			getItem: () => null,
			setItem: () => {},
			removeItem: () => {}
		} as any;
		const state = new LobbyState();

		const fetchedUrls: string[] = [];
		globalThis.fetch = (url: any, init?: any) => {
			fetchedUrls.push(url);
			if (url === '/api/profiles/me') {
				return Promise.resolve(mockResponse(true, { id: 'p123', name: 'Albin', color: '#10b981' }));
			}
			return Promise.resolve(mockResponse(true, []));
		};

		// 1. checkAuth should only fetch /api/profiles/me and not load games/current
		await state.checkAuth();
		expect(fetchedUrls).toEqual(['/api/profiles/me']);
		expect(state.activeProfile).toEqual({ id: 'p123', name: 'Albin', color: '#10b981' });

		// Clear tracked URLs
		fetchedUrls.length = 0;

		// 2. init should checkAuth and then loadProfiles, loadGames, loadCurrentSkitgubbe, initNotifications (via Promise.all)
		setBrowserMocks(
			{
				getRegistrations: () => Promise.resolve([])
			},
			{}
		);
		(globalThis as any).__DEV_MODE__ = true;

		await state.init();
		expect(fetchedUrls).toContain('/api/profiles/me');
		expect(fetchedUrls).toContain('/api/profiles');
		expect(fetchedUrls).toContain('/api/games');
		expect(fetchedUrls).toContain('/api/skitgubbe/current');

		// Clear tracked URLs
		fetchedUrls.length = 0;

		// 3. selectProfile should checkAuth and loadGames and loadCurrentSkitgubbe in parallel
		await state.selectProfile('p123');
		expect(fetchedUrls).toContain('/api/profiles/p123/select');
		expect(fetchedUrls).toContain('/api/profiles/me');
		expect(fetchedUrls).toContain('/api/games');
		expect(fetchedUrls).toContain('/api/skitgubbe/current');
	});

	test('pruneLocalStorageKeys removes stale keys but keeps valid ones', async () => {
		const state = new LobbyState();

		state.games = [{ id: 'active-game-1' }, { id: 'active-game-2' }];
		state.profiles = [{ id: 'profile-1' }, { id: 'profile-2' }];

		const storage: Record<string, string> = {
			'skitgubbe_last_seq_active-game-1': '10',
			'skitgubbe_last_seq_archived-game-1': '20', // Should keep as it will be fetched from archived
			'skitgubbe_last_seq_stale-game-1': '30', // Should be removed
			'skitgubbe_last_seen_chat_id_active-game-2': 'chat-1',
			'skitgubbe_last_seen_chat_id_stale-game-2': 'chat-2', // Should be removed
			'push_synced:profile-1:endpoint-url': 'true',
			'push_synced:stale-profile-1:endpoint-url': 'true' // Should be removed
		};

		// Mock localStorage methods
		const oldLocalStorage = globalThis.localStorage;
		const mockStorage = {
			get length() {
				return Object.keys(storage).length;
			},
			key(index: number) {
				return Object.keys(storage)[index] || null;
			},
			getItem(key: string) {
				return storage[key] || null;
			},
			setItem(key: string, value: string) {
				storage[key] = value;
			},
			removeItem(key: string) {
				delete storage[key];
			}
		} as any;

		globalThis.localStorage = mockStorage;
		if (globalThis.window) {
			(globalThis.window as any).localStorage = mockStorage;
		}

		// Mock archived games fetch to return archived-game-1
		globalThis.fetch = (url: any) => {
			if (url === '/api/games/archived') {
				return Promise.resolve(mockResponse(true, [{ id: 'archived-game-1' }]));
			}
			return Promise.resolve(mockResponse(true, []));
		};

		try {
			await state.pruneLocalStorageKeys();
		} finally {
			globalThis.localStorage = oldLocalStorage;
			if (globalThis.window) {
				delete (globalThis.window as any).localStorage;
			}
		}

		// Check what keys are left in storage
		const keys = Object.keys(storage);
		expect(keys).toContain('skitgubbe_last_seq_active-game-1');
		expect(keys).toContain('skitgubbe_last_seq_archived-game-1');
		expect(keys).not.toContain('skitgubbe_last_seq_stale-game-1');
		expect(keys).toContain('skitgubbe_last_seen_chat_id_active-game-2');
		expect(keys).not.toContain('skitgubbe_last_seen_chat_id_stale-game-2');
		expect(keys).toContain('push_synced:profile-1:endpoint-url');
		expect(keys).not.toContain('push_synced:stale-profile-1:endpoint-url');
	});
});
