import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

let store = new Map<string, string>();
let addedListeners: Array<{ event: string; remove: () => Promise<void>; removed: boolean }> = [];
let unregisterCallCount = 0;
let unregisterShouldFail = false;
let createChannelShouldFail = false;
let fetchCalls: Array<{ url: string; body: unknown }> = [];
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
	addListener: async (eventName: string, callback: any) => {
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
		unregisterCallCount += 1;
		if (unregisterShouldFail) {
			throw new Error('FCM unregister failed (offline)');
		}
	},
	register: async () => {},
	checkPermissions: async () => ({ receive: 'granted' }),
	requestPermissions: async () => ({ receive: 'granted' })
};

mock.module('@capacitor/preferences', () => ({
	Preferences: mockPreferences
}));

mock.module('@capacitor/push-notifications', () => ({
	PushNotifications: mockPushNotifications
}));

const {
	INSTALLATION_ID_KEY,
	PENDING_PUSH_CLEANUP_KEY,
	PUSH_ENABLED_KEY,
	PUSH_TOKEN_KEY,
	disableNativeNotifications,
	installNativeNotificationListeners,
	onServerOriginChanged,
	onServerOriginCleared,
	reconcileNativeNotifications
} = await import('../src/lib/platform/nativeNotifications');

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalIsNativePlatform = Capacitor.isNativePlatform;
const originalGetPlatform = Capacitor.getPlatform;

beforeEach(() => {
	store = new Map<string, string>();
	addedListeners = [];
	unregisterCallCount = 0;
	unregisterShouldFail = false;
	createChannelShouldFail = false;
	fetchCalls = [];
	fetchShouldFail = false;

	Capacitor.isNativePlatform = () => true;
	Capacitor.getPlatform = () => 'android';

	globalThis.window = {
		dispatchEvent: () => true,
		addEventListener: () => {},
		removeEventListener: () => {},
		location: { assign: () => {} }
	} as unknown as Window & typeof globalThis;

	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input.toString();
		const body = init?.body ? JSON.parse(init.body as string) : undefined;
		fetchCalls.push({ url, body });
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

describe('server origin changes and FCM invalidation', () => {
	test('unregisters previous origin, invalidates FCM token, and clears token while keeping opt-in', async () => {
		store.set(INSTALLATION_ID_KEY, 'inst-12345');
		store.set(PUSH_TOKEN_KEY, 'fcm-token-old');
		store.set(PUSH_ENABLED_KEY, 'true');

		await onServerOriginChanged({
			previousOrigin: 'https://server-a.example.com',
			newOrigin: 'https://server-b.example.com'
		});

		// Detach requested on previous server
		expect(fetchCalls.length).toBe(1);
		expect(fetchCalls[0].url).toBe('https://server-a.example.com/api/push/native/unregister');
		expect(fetchCalls[0].body).toEqual({ installationId: 'inst-12345' });

		// FCM token invalidated locally
		expect(unregisterCallCount).toBe(1);

		// Stored token and installationId cleared so next server gets a fresh pair
		expect(store.get(PUSH_TOKEN_KEY)).toBeUndefined();
		expect(store.get(INSTALLATION_ID_KEY)).toBeUndefined();

		// User opt-in is preserved!
		expect(store.get(PUSH_ENABLED_KEY)).toBe('true');

		// No pending cleanups since everything succeeded
		expect(store.get(PENDING_PUSH_CLEANUP_KEY)).toBeUndefined();
	});

	test('queues durable retry in preferences if unregister or FCM invalidate fails', async () => {
		store.set(INSTALLATION_ID_KEY, 'inst-offline');
		store.set(PUSH_TOKEN_KEY, 'fcm-token-old');
		store.set(PUSH_ENABLED_KEY, 'true');

		fetchShouldFail = true;
		unregisterShouldFail = true;

		await onServerOriginChanged({
			previousOrigin: 'https://unreachable.example.com',
			newOrigin: 'https://server-b.example.com'
		});

		// Both calls attempted
		expect(fetchCalls.length).toBe(1);
		expect(unregisterCallCount).toBe(1);

		// Pending cleanups recorded durably
		const cleanupRaw = store.get(PENDING_PUSH_CLEANUP_KEY);
		expect(cleanupRaw).toBeDefined();
		const cleanup = JSON.parse(cleanupRaw!);
		expect(cleanup.pendingFcmUnregister).toBe(true);
		expect(cleanup.pendingDetaches).toEqual([
			{ origin: 'https://unreachable.example.com', installationId: 'inst-offline' }
		]);

		// Now simulate network recovery and reconciliation
		fetchShouldFail = false;
		unregisterShouldFail = false;
		fetchCalls = [];

		await reconcileNativeNotifications();

		expect(unregisterCallCount).toBe(2);
		expect(fetchCalls.length).toBe(1);
		expect(fetchCalls[0].url).toBe('https://unreachable.example.com/api/push/native/unregister');

		// Cleanup resolved and removed from preferences
		expect(store.get(PENDING_PUSH_CLEANUP_KEY)).toBeUndefined();
	});
});

describe('disableNativeNotifications', () => {
	test('clears opt-in immediately and queues retry on failure', async () => {
		store.set(INSTALLATION_ID_KEY, 'inst-disable');
		store.set(PUSH_TOKEN_KEY, 'fcm-token');
		store.set(PUSH_ENABLED_KEY, 'true');

		fetchShouldFail = true;
		unregisterShouldFail = true;

		await disableNativeNotifications();

		// Opt-in removed immediately
		expect(store.get(PUSH_ENABLED_KEY)).toBeUndefined();
		expect(store.get(PUSH_TOKEN_KEY)).toBeUndefined();

		// Pending retry queued
		const cleanupRaw = store.get(PENDING_PUSH_CLEANUP_KEY);
		expect(cleanupRaw).toBeDefined();
		const cleanup = JSON.parse(cleanupRaw!);
		expect(cleanup.pendingFcmUnregister).toBe(true);
	});
});
