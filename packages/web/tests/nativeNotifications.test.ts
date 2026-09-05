import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Capacitor } from '@capacitor/core';

let store = new Map<string, string>();
let addedListeners: Array<{ event: string; remove: () => Promise<void>; removed: boolean }> = [];
let deleteTokenCallCount = 0;
let deleteTokenShouldFail = false;
let createChannelShouldFail = false;
let registerCallCount = 0;
let fetchCalls: Array<{ url: string; body: unknown; headers?: HeadersInit }> = [];
let fetchShouldFail = false;

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
	},
	checkPermissions: async () => ({ receive: 'granted' }),
	requestPermissions: async () => ({ receive: 'granted' })
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
	PUSH_TOKEN_KEY,
	disableNativeNotifications,
	ensureNativeNotificationsRegistered,
	installNativeNotificationListeners,
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
