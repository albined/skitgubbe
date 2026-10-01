import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Capacitor } from '@capacitor/core';
import fs from 'node:fs';
import { compileModule } from 'svelte/compiler';

let store = new Map<string, string>();
let addedListeners: Array<{ event: string; remove: () => Promise<void>; removed: boolean }> = [];
let deleteTokenCallCount = 0;
let deleteTokenShouldFail = false;
let createChannelShouldFail = false;
let registerCallCount = 0;
let fetchCalls: Array<{ url: string; body: unknown; headers?: HeadersInit }> = [];
let fetchShouldFail = false;
type Permission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
let permission: Permission = 'granted';
let requestedPermission: Permission = 'granted';
let requestPermissionCallCount = 0;
let registrationCallback: ((token: { value: string }) => void) | undefined;

const mockPreferences = {
	get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
	set: async ({ key, value }: { key: string; value: string }) => {
		store.set(key, value);
	},
	remove: async ({ key }: { key: string }) => {
		store.delete(key);
	}
};

const mockPushNotifications = {
	addListener: async (eventName: string, _callback: any) => {
		if (eventName === 'registration') registrationCallback = _callback;
		const entry = {
			event: eventName,
			removed: false,
			remove: async () => {
				entry.removed = true;
			}
		};
		addedListeners.push(entry);
		return { remove: entry.remove };
	},
	createChannel: async () => {
		if (createChannelShouldFail) {
			throw new Error('Simulated channel creation failure');
		}
	},
	unregister: async () => {
		throw new Error(
			'Capacitor PushNotifications.unregister() should not be used; use nativePush.deleteToken()'
		);
	},
	register: async () => {
		registerCallCount += 1;
		registrationCallback?.({ value: 'fcm-token-new' });
	},
	checkPermissions: async () => ({ receive: permission }),
	requestPermissions: async () => {
		requestPermissionCallCount += 1;
		permission = requestedPermission;
		return { receive: permission };
	}
};

mock.module('@capacitor/preferences', () => ({
	Preferences: mockPreferences
}));

mock.module('@capacitor/push-notifications', () => ({
	PushNotifications: mockPushNotifications
}));

import { SERVER_ORIGIN_KEY } from '../src/lib/platform/serverConfig';

const {
	INSTALLATION_ID_KEY,
	INSTALLATION_SECRET_KEY,
	PENDING_PUSH_CLEANUP_KEY,
	PUSH_ENABLED_KEY,
	PUSH_DEFAULT_APPLIED_KEY,
	PUSH_TOKEN_KEY,
	disableNativeNotifications,
	ensureNativeNotificationsRegistered,
	installNativeNotificationListeners,
	initializeNativeNotifications,
	nativePushWeb,
	onServerOriginChanged,
	onServerOriginCleared,
	reconcileNativeNotifications
} = await import('../src/lib/platform/nativeNotifications');

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalDocument = (globalThis as any).document;
const originalLocalStorage = globalThis.localStorage;
const originalIsNativePlatform = Capacitor.isNativePlatform;
const originalGetPlatform = Capacitor.getPlatform;

let localStore = new Map<string, string>();

beforeEach(() => {
	store = new Map<string, string>();
	localStore = new Map<string, string>();
	addedListeners = [];
	deleteTokenCallCount = 0;
	deleteTokenShouldFail = false;
	createChannelShouldFail = false;
	registerCallCount = 0;
	fetchCalls = [];
	fetchShouldFail = false;
	permission = 'granted';
	requestedPermission = 'granted';
	requestPermissionCallCount = 0;
	registrationCallback = undefined;

	Capacitor.isNativePlatform = () => true;
	Capacitor.getPlatform = () => 'android';

	globalThis.localStorage = {
		getItem: (key: string) => localStore.get(key) ?? null,
		setItem: (key: string, value: string) => {
			localStore.set(key, value);
		},
		removeItem: (key: string) => {
			localStore.delete(key);
		},
		clear: () => {
			localStore.clear();
		}
	} as any;

	(globalThis as any).document = {
		cookie: 'skitgubbe_session=auth-cookie-123'
	};

	nativePushWeb.deleteToken = async () => {
		deleteTokenCallCount += 1;
		if (deleteTokenShouldFail) {
			throw new Error('Firebase deleteToken failed (offline)');
		}
	};

	globalThis.window = {
		setTimeout,
		dispatchEvent: () => true,
		addEventListener: () => {},
		removeEventListener: () => {},
		location: { assign: () => {} }
	} as unknown as Window & typeof globalThis;

	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input.toString();
		const body = init?.body ? JSON.parse(init.body as string) : undefined;
		fetchCalls.push({ url, body, headers: init?.headers });
		if (fetchShouldFail) {
			throw new Error('Network unreachable');
		}
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}) as typeof fetch;
});

afterEach(() => {
	Capacitor.isNativePlatform = originalIsNativePlatform;
	Capacitor.getPlatform = originalGetPlatform;
	globalThis.fetch = originalFetch;
	globalThis.window = originalWindow;
	(globalThis as any).document = originalDocument;
	globalThis.localStorage = originalLocalStorage;
});

describe('default Android notifications', () => {
	let uninstall: () => Promise<void>;
	let LobbyState: any;
	const compiledLobbyPath = new URL('./lobbyState.native-test-compiled.js', import.meta.url);
	beforeAll(async () => {
		// Compile the real Svelte state, keeping its native notification dependencies.
		const source = fs
			.readFileSync(new URL('../src/lib/state/lobbyState.svelte.ts', import.meta.url), 'utf8')
			.replace("import { dev } from '$app/environment';", 'const dev = false;');
		const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(source);
		fs.writeFileSync(
			compiledLobbyPath,
			compileModule(js, { filename: 'lobbyState.svelte.js' }).js.code
		);
		({ LobbyState } = await import('./lobbyState.native-test-compiled.js'));
	});
	afterAll(() => {
		fs.rmSync(compiledLobbyPath, { force: true });
	});
	beforeEach(async () => {
		store.set(SERVER_ORIGIN_KEY, 'https://server.example.com');
		localStore.set(SERVER_ORIGIN_KEY, 'https://server.example.com');
		uninstall = await installNativeNotificationListeners();
	});
	afterEach(async () => {
		await uninstall();
	});

	test('lobby keeps notifications on after registration fails and retries on the next visit', async () => {
		const state = new LobbyState();
		state.activeProfile = { id: 'player-123', name: 'Player', color: '#fff' };
		fetchShouldFail = true;

		await state.initNotifications();

		expect(store.get(PUSH_DEFAULT_APPLIED_KEY)).toBe('true');
		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');
		expect(state.notificationsEnabled).toBe(true);
		expect(state.isTogglingNotifications).toBe(false);

		fetchShouldFail = false;
		const previousRegisterCalls = registerCallCount;
		await state.initNotifications();
		expect(registerCallCount).toBe(previousRegisterCalls + 1);
		expect(state.notificationsEnabled).toBe(true);
		expect(requestPermissionCallCount).toBe(0);
	});

	test('lobby shows the enabled preference while token cleanup postpones registration', async () => {
		const state = new LobbyState();
		state.activeProfile = { id: 'player-123', name: 'Player', color: '#fff' };
		store.set(PENDING_PUSH_CLEANUP_KEY, JSON.stringify({ pendingFcmUnregister: true }));
		deleteTokenShouldFail = true;

		await state.initNotifications();

		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');
		expect(state.notificationsEnabled).toBe(true);
		expect(state.isTogglingNotifications).toBe(false);
		expect(registerCallCount).toBe(0);
	});

	test('lobby still shows notifications off when Android permission is denied', async () => {
		const state = new LobbyState();
		state.activeProfile = { id: 'player-123', name: 'Player', color: '#fff' };
		permission = 'denied';

		await state.initNotifications();

		expect(state.notificationsEnabled).toBe(false);
		expect(state.isTogglingNotifications).toBe(false);
		expect(registerCallCount).toBe(0);
	});

	test('requests permission and registers a fresh installation with the server', async () => {
		permission = 'prompt';
		expect(await initializeNativeNotifications()).toBe(true);
		expect(requestPermissionCallCount).toBe(1);
		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');
		expect(store.get(PUSH_DEFAULT_APPLIED_KEY)).toBe('true');
		expect(fetchCalls.some((call) => call.url.endsWith('/api/push/native/register'))).toBe(true);
	});

	test.each([undefined, 'false', 'true'])(
		'enables existing installs once, including previous preference %s',
		async (previousPreference) => {
			if (previousPreference) store.set(PUSH_ENABLED_KEY, previousPreference);
			expect(await initializeNativeNotifications()).toBe(true);
			expect(requestPermissionCallCount).toBe(0);
			expect(store.get(PUSH_ENABLED_KEY)).toBe('true');

			await disableNativeNotifications();
			const previousRegisterCalls = registerCallCount;
			expect(await initializeNativeNotifications()).toBe(false);
			expect(registerCallCount).toBe(previousRegisterCalls);
			expect(store.get(PUSH_ENABLED_KEY)).toBeUndefined();
		}
	);

	test.each(['denied', 'prompt'] as const)(
		'does not repeat the automatic prompt after a %s response',
		async (response) => {
			permission = 'prompt';
			requestedPermission = response;
			expect(await initializeNativeNotifications()).toBe(false);
			expect(await initializeNativeNotifications()).toBe(false);
			expect(requestPermissionCallCount).toBe(1);
			expect(registerCallCount).toBe(0);

			// If permission is later enabled in Android settings, registration recovers.
			permission = 'granted';
			expect(await initializeNativeNotifications()).toBe(true);
			expect(requestPermissionCallCount).toBe(1);
		}
	);

	test('leaves an Android system block in place', async () => {
		permission = 'denied';
		expect(await initializeNativeNotifications()).toBe(false);
		expect(requestPermissionCallCount).toBe(0);
		expect(registerCallCount).toBe(0);
	});

	test('can request permission once when Android permits asking again', async () => {
		permission = 'prompt-with-rationale';
		expect(await initializeNativeNotifications()).toBe(true);
		expect(requestPermissionCallCount).toBe(1);
	});

	test('retries registration after a network failure without losing the default', async () => {
		permission = 'prompt';
		fetchShouldFail = true;
		await expect(initializeNativeNotifications()).rejects.toThrow('The server request failed.');
		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');
		fetchShouldFail = false;
		expect(await initializeNativeNotifications()).toBe(true);
		expect(requestPermissionCallCount).toBe(1);
	});

	test('coalesces concurrent initialization so permission is only requested once', async () => {
		permission = 'prompt';
		expect(
			await Promise.all([initializeNativeNotifications(), initializeNativeNotifications()])
		).toEqual([true, true]);
		expect(requestPermissionCallCount).toBe(1);
		expect(registerCallCount).toBe(1);
	});

	test('does not change browser notification preferences', async () => {
		Capacitor.isNativePlatform = () => false;
		expect(await initializeNativeNotifications()).toBe(false);
		expect(store.get(PUSH_DEFAULT_APPLIED_KEY)).toBeUndefined();
		expect(store.get(PUSH_ENABLED_KEY)).toBeUndefined();
		expect(requestPermissionCallCount).toBe(0);
	});
});

describe('installNativeNotificationListeners', () => {
	test('rolls back partially registered listeners on error and permits clean retry', async () => {
		createChannelShouldFail = true;

		// First call should fail and remove all listeners created so far
		await expect(installNativeNotificationListeners()).rejects.toThrow(
			'Simulated channel creation failure'
		);
		expect(addedListeners.length).toBe(4);
		expect(addedListeners.every((l) => l.removed)).toBe(true);

		// Second call should retry cleanly and succeed
		createChannelShouldFail = false;
		addedListeners = [];
		const uninstall = await installNativeNotificationListeners();
		expect(addedListeners.length).toBe(4);
		expect(addedListeners.every((l) => !l.removed)).toBe(true);

		// Cleanup removes all handles
		await uninstall();
		expect(addedListeners.every((l) => l.removed)).toBe(true);
	});
});

describe('server origin changes, credentials preservation, and FCM token invalidation', () => {
	test('unregisters previous origin with secret & cookie, invalidates FCM token, and rotates identity', async () => {
		store.set(INSTALLATION_ID_KEY, 'inst-12345');
		store.set(INSTALLATION_SECRET_KEY, 'secret-67890');
		store.set(PUSH_TOKEN_KEY, 'fcm-token-old');
		store.set(PUSH_ENABLED_KEY, 'true');

		await onServerOriginChanged({
			previousOrigin: 'https://server-a.example.com',
			newOrigin: 'https://server-b.example.com'
		});

		// Detach requested on previous server with secret and preserved cookie
		expect(fetchCalls.length).toBe(1);
		expect(fetchCalls[0].url).toBe('https://server-a.example.com/api/push/native/unregister');
		expect(fetchCalls[0].body).toEqual({
			installationId: 'inst-12345',
			secret: 'secret-67890'
		});
		expect(fetchCalls[0].headers).toEqual(
			expect.objectContaining({
				Cookie: 'skitgubbe_session=auth-cookie-123'
			})
		);

		// Native FCM deleteToken was awaited
		expect(deleteTokenCallCount).toBe(1);

		// Stored token, installationId, and secret cleared so next server gets a fresh set
		expect(store.get(PUSH_TOKEN_KEY)).toBeUndefined();
		expect(store.get(INSTALLATION_ID_KEY)).toBeUndefined();
		expect(store.get(INSTALLATION_SECRET_KEY)).toBeUndefined();

		// User opt-in is preserved
		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');

		// No pending cleanups since everything succeeded
		expect(store.get(PENDING_PUSH_CLEANUP_KEY)).toBeUndefined();
	});

	test('preserves cleanup credentials and blocks registration until FCM deleteToken succeeds', async () => {
		store.set(SERVER_ORIGIN_KEY, 'https://server-b.example.com');
		localStore.set(SERVER_ORIGIN_KEY, 'https://server-b.example.com');
		store.set(INSTALLATION_ID_KEY, 'inst-offline');
		store.set(INSTALLATION_SECRET_KEY, 'secret-offline');
		store.set(PUSH_TOKEN_KEY, 'fcm-token-old');
		store.set(PUSH_ENABLED_KEY, 'true');

		fetchShouldFail = true;
		deleteTokenShouldFail = true;

		await onServerOriginChanged({
			previousOrigin: 'https://unreachable.example.com',
			newOrigin: 'https://server-b.example.com'
		});

		// Detach and native delete were attempted
		expect(fetchCalls.length).toBe(1);
		expect(deleteTokenCallCount).toBe(1);

		// Pending cleanups recorded durably with preserved installation secret and cookie
		const cleanupRaw = store.get(PENDING_PUSH_CLEANUP_KEY);
		expect(cleanupRaw).toBeDefined();
		const cleanup = JSON.parse(cleanupRaw!);
		expect(cleanup.pendingFcmUnregister).toBe(true);
		expect(cleanup.pendingDetaches).toEqual([
			{
				origin: 'https://unreachable.example.com',
				installationId: 'inst-offline',
				secret: 'secret-offline',
				cookie: 'skitgubbe_session=auth-cookie-123'
			}
		]);

		// While pendingFcmUnregister is active, ensureNativeNotificationsRegistered MUST NOT
		// call PushNotifications.register() to avoid racing or acquiring the old token on server B!
		const registeredWhilePending = await ensureNativeNotificationsRegistered();
		expect(registeredWhilePending).toBe(false);
		expect(registerCallCount).toBe(0);

		// Now simulate network recovery
		fetchShouldFail = false;
		deleteTokenShouldFail = false;
		fetchCalls = [];

		// Reconcile retries token deletion and detach with preserved credentials
		await reconcileNativeNotifications();

		expect(deleteTokenCallCount).toBe(3); // 1 initial + 1 during ensure + 1 during reconcile
		expect(fetchCalls.length).toBe(1);
		expect(fetchCalls[0].url).toBe('https://unreachable.example.com/api/push/native/unregister');
		expect(fetchCalls[0].body).toEqual({
			installationId: 'inst-offline',
			secret: 'secret-offline'
		});
		expect(fetchCalls[0].headers).toEqual(
			expect.objectContaining({
				Cookie: 'skitgubbe_session=auth-cookie-123'
			})
		);

		// Cleanup queue is now completely resolved
		expect(store.get(PENDING_PUSH_CLEANUP_KEY)).toBeUndefined();

		// Now ensureNativeNotificationsRegistered can proceed safely
		store.set(PUSH_TOKEN_KEY, 'fcm-token-fresh-b');
		const registeredAfterRecovery = await ensureNativeNotificationsRegistered();
		expect(registeredAfterRecovery).toBe(true);
		expect(registerCallCount).toBe(1);
	});
});

describe('disableNativeNotifications', () => {
	test('clears opt-in immediately and queues retry on failure with preserved secret and cookie', async () => {
		store.set(SERVER_ORIGIN_KEY, 'https://current-server.example.com');
		localStore.set(SERVER_ORIGIN_KEY, 'https://current-server.example.com');
		store.set(INSTALLATION_ID_KEY, 'inst-disable');
		store.set(INSTALLATION_SECRET_KEY, 'secret-disable');
		store.set(PUSH_TOKEN_KEY, 'fcm-token');
		store.set(PUSH_ENABLED_KEY, 'true');

		fetchShouldFail = true;
		deleteTokenShouldFail = true;

		await disableNativeNotifications();

		// Opt-in and token removed immediately
		expect(store.get(PUSH_ENABLED_KEY)).toBeUndefined();
		expect(store.get(PUSH_TOKEN_KEY)).toBeUndefined();

		// Pending retry queued
		const cleanupRaw = store.get(PENDING_PUSH_CLEANUP_KEY);
		expect(cleanupRaw).toBeDefined();
		const cleanup = JSON.parse(cleanupRaw!);
		expect(cleanup.pendingFcmUnregister).toBe(true);
		expect(cleanup.pendingDetaches).toHaveLength(1);
		expect(cleanup.pendingDetaches![0].secret).toBe('secret-disable');
		expect(cleanup.pendingDetaches![0].cookie).toBe('skitgubbe_session=auth-cookie-123');
	});
});
