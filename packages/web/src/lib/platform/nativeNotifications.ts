import type { PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiRequest } from './api';
import { platformRequest } from './http';
import { isAndroidApp } from './runtime';
import { getApiUrl } from './urls';
import { getConfiguredServerOrigin } from './serverConfig';

export const INSTALLATION_ID_KEY = 'skitgubbe_installation_id';
export const PUSH_TOKEN_KEY = 'skitgubbe_native_push_token';
export const PUSH_ENABLED_KEY = 'skitgubbe_native_push_enabled';
export const PENDING_PUSH_CLEANUP_KEY = 'skitgubbe_pending_native_push_cleanup';
const REGISTRATION_TIMEOUT_MS = 15_000;

interface PendingPushCleanup {
	pendingFcmUnregister?: boolean;
	pendingDetaches?: Array<{
		origin: string;
		installationId: string;
	}>;
}

let listeners: PluginListenerHandle[] = [];
let listenersInstalled = false;
let installPromise: Promise<() => Promise<void>> | null = null;
let resumeListener: (() => void) | null = null;

interface PendingTokenWaiter {
	resolve: (token: string) => void;
	reject: (error: Error) => void;
}

let pendingTokenWaiters: PendingTokenWaiter[] = [];

function createInstallationId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function getInstallationId(): Promise<string> {
	const existing = await Preferences.get({ key: INSTALLATION_ID_KEY });
	if (existing.value) return existing.value;
	const value = createInstallationId();
	await Preferences.set({ key: INSTALLATION_ID_KEY, value });
	return value;
}

async function isOptedIn(): Promise<boolean> {
	return (await Preferences.get({ key: PUSH_ENABLED_KEY })).value === 'true';
}

async function storedToken(): Promise<string | null> {
	return (await Preferences.get({ key: PUSH_TOKEN_KEY })).value;
}

function notifyStateChanged(): void {
	window.dispatchEvent(new CustomEvent('skitgubbe:native-push-state'));
}

function trustedRoute(value: unknown): string | null {
	if (value === '/') return '/';
	if (typeof value !== 'string' || value.length > 160) return null;
	return /^\/room\/[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

function waitForFreshToken(): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let settled = false;
		let timeout = 0;
		let waiter: PendingTokenWaiter;
		const removeWaiter = () => {
			pendingTokenWaiters = pendingTokenWaiters.filter((candidate) => candidate !== waiter);
		};
		const finish = (token: string) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			removeWaiter();
			resolve(token);
		};
		const fail = (error: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			removeWaiter();
			reject(error);
		};
		waiter = { resolve: finish, reject: fail };
		timeout = window.setTimeout(
			() => fail(new Error('Timed out while registering for Android notifications.')),
			REGISTRATION_TIMEOUT_MS
		);
		pendingTokenWaiters.push(waiter);
	});
}

async function handleRegistration(token: string): Promise<void> {
	try {
		await Preferences.set({ key: PUSH_TOKEN_KEY, value: token });
	} catch (cause) {
		const error =
			cause instanceof Error ? cause : new Error('Could not store the Android push token.');
		const waiters = pendingTokenWaiters;
		pendingTokenWaiters = [];
		waiters.forEach((waiter) => waiter.reject(error));
		console.warn('Could not store the refreshed Android push token.', cause);
		return;
	}
	const waiters = pendingTokenWaiters;
	pendingTokenWaiters = [];
	waiters.forEach((waiter) => waiter.resolve(token));
	try {
		await syncNativePushRegistration();
	} catch (error) {
		console.warn('Could not sync refreshed Android push token.', error);
	}
	notifyStateChanged();
}

async function getPendingCleanup(): Promise<PendingPushCleanup> {
	try {
		const raw = (await Preferences.get({ key: PENDING_PUSH_CLEANUP_KEY })).value;
		return raw ? (JSON.parse(raw) as PendingPushCleanup) : {};
	} catch {
		return {};
	}
}

async function savePendingCleanup(cleanup: PendingPushCleanup): Promise<void> {
	const hasDetaches = Boolean(cleanup.pendingDetaches && cleanup.pendingDetaches.length > 0);
	if (!cleanup.pendingFcmUnregister && !hasDetaches) {
		await Preferences.remove({ key: PENDING_PUSH_CLEANUP_KEY });
	} else {
		await Preferences.set({
			key: PENDING_PUSH_CLEANUP_KEY,
			value: JSON.stringify(cleanup)
		});
	}
}

async function recordPendingDetach(origin: string, installationId: string): Promise<void> {
	const cleanup = await getPendingCleanup();
	const detaches = cleanup.pendingDetaches ?? [];
	if (!detaches.some((d) => d.origin === origin && d.installationId === installationId)) {
		detaches.push({ origin, installationId });
	}
	cleanup.pendingDetaches = detaches;
	await savePendingCleanup(cleanup);
}

async function recordPendingFcmUnregister(): Promise<void> {
	const cleanup = await getPendingCleanup();
	cleanup.pendingFcmUnregister = true;
	await savePendingCleanup(cleanup);
}

export async function reconcileNativeNotifications(): Promise<void> {
	if (!isAndroidApp()) return;
	try {
		const cleanup = await getPendingCleanup();
		if (cleanup.pendingFcmUnregister) {
			try {
				await PushNotifications.unregister();
				cleanup.pendingFcmUnregister = false;
			} catch (e) {
				console.warn('Retry of FCM token unregistration failed:', e);
			}
		}
		if (cleanup.pendingDetaches && cleanup.pendingDetaches.length > 0) {
			const remaining: Array<{ origin: string; installationId: string }> = [];
			for (const item of cleanup.pendingDetaches) {
				try {
					const response = await platformRequest(`${item.origin}/api/push/native/unregister`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ installationId: item.installationId })
					});
					if (!response.ok && response.status !== 401 && response.status !== 404) {
						remaining.push(item);
					}
				} catch {
					remaining.push(item);
				}
			}
			cleanup.pendingDetaches = remaining;
		}
		await savePendingCleanup(cleanup);
	} catch (error) {
		console.warn('Native notification reconciliation failed:', error);
	}
}

export async function onServerOriginChanged({
	previousOrigin,
	newOrigin
}: {
	previousOrigin: string;
	newOrigin: string;
}): Promise<void> {
	if (!isAndroidApp()) return;

	const installationId = (await Preferences.get({ key: INSTALLATION_ID_KEY })).value;
	if (installationId) {
		try {
			await detachNativePushRegistration(previousOrigin);
		} catch (error) {
			console.warn('Could not detach native push registration from previous server:', error);
			await recordPendingDetach(previousOrigin, installationId);
		}
	}

	try {
		await PushNotifications.unregister();
	} catch (error) {
		console.warn('Could not unregister FCM token during server switch:', error);
		await recordPendingFcmUnregister();
	}

	const waiters = pendingTokenWaiters;
	pendingTokenWaiters = [];
	waiters.forEach((waiter) => waiter.reject(new Error('Server origin changed.')));

	await Preferences.remove({ key: PUSH_TOKEN_KEY });
	await Preferences.remove({ key: INSTALLATION_ID_KEY });
	notifyStateChanged();
}

export async function onServerOriginCleared({
	previousOrigin
}: {
	previousOrigin: string;
}): Promise<void> {
	if (!isAndroidApp()) return;

	const installationId = (await Preferences.get({ key: INSTALLATION_ID_KEY })).value;
	if (installationId) {
		try {
			await detachNativePushRegistration(previousOrigin);
		} catch (error) {
			console.warn('Could not detach native push registration on server clear:', error);
			await recordPendingDetach(previousOrigin, installationId);
		}
	}

	try {
		await PushNotifications.unregister();
	} catch (error) {
		console.warn('Could not unregister FCM token on server clear:', error);
		await recordPendingFcmUnregister();
	}

	const waiters = pendingTokenWaiters;
	pendingTokenWaiters = [];
	waiters.forEach((waiter) => waiter.reject(new Error('Server origin cleared.')));

	await Promise.all([
		Preferences.remove({ key: PUSH_TOKEN_KEY }),
		Preferences.remove({ key: INSTALLATION_ID_KEY }),
		Preferences.remove({ key: PUSH_ENABLED_KEY })
	]);
	notifyStateChanged();
}

async function uninstallNativeNotificationListeners(): Promise<void> {
	if (resumeListener) {
		window.removeEventListener('skitgubbe:native-resume', resumeListener);
		resumeListener = null;
	}
	await Promise.all(listeners.map((listener) => listener.remove().catch(() => {})));
	listeners = [];
	listenersInstalled = false;
}

export async function installNativeNotificationListeners(): Promise<() => Promise<void>> {
	if (!isAndroidApp()) return async () => {};
	if (listenersInstalled) {
		return uninstallNativeNotificationListeners;
	}
	if (installPromise) {
		return installPromise;
	}

	installPromise = (async () => {
		const newListeners: PluginListenerHandle[] = [];
		try {
			newListeners.push(
				await PushNotifications.addListener('registration', (token) => {
					void handleRegistration(token.value);
				})
			);
			newListeners.push(
				await PushNotifications.addListener('registrationError', (registrationError) => {
					const error = new Error(registrationError.error || 'Android push registration failed.');
					const waiters = pendingTokenWaiters;
					pendingTokenWaiters = [];
					waiters.forEach((waiter) => waiter.reject(error));
				})
			);
			newListeners.push(
				await PushNotifications.addListener(
					'pushNotificationActionPerformed',
					({ notification }) => {
						const route = trustedRoute(notification.data?.route);
						if (route) window.location.assign(route);
					}
				)
			);
			newListeners.push(
				await PushNotifications.addListener('pushNotificationReceived', () => {
					// Foreground presentation is controlled by capacitor.config.ts.
				})
			);

			await PushNotifications.createChannel({
				id: 'game-updates',
				name: 'Game updates',
				description: 'Invitations, turns, and completed Skitgubbe games',
				importance: 4,
				visibility: 1,
				vibration: true
			});

			if (!resumeListener) {
				resumeListener = () => {
					void reconcileNativeNotifications();
				};
				window.addEventListener('skitgubbe:native-resume', resumeListener);
			}

			listeners = newListeners;
			listenersInstalled = true;

			void reconcileNativeNotifications();

			return uninstallNativeNotificationListeners;
		} catch (error) {
			await Promise.all(newListeners.map((listener) => listener.remove().catch(() => {})));
			listenersInstalled = false;
			throw error;
		} finally {
			installPromise = null;
		}
	})();

	return installPromise;
}

export async function getNativeNotificationsEnabled(): Promise<boolean> {
	if (!isAndroidApp() || !(await isOptedIn())) return false;
	const permission = await PushNotifications.checkPermissions();
	return permission.receive === 'granted';
}

export async function syncNativePushRegistration(): Promise<void> {
	if (!isAndroidApp() || !(await isOptedIn())) return;
	const token = await storedToken();
	if (!token) return;
	const installationId = await getInstallationId();
	const response = await apiRequest('/api/push/native/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ installationId, token })
	});
	if (!response.ok)
		throw new Error(`Android notification registration failed (${response.status}).`);
}

export async function ensureNativeNotificationsRegistered(): Promise<boolean> {
	if (!isAndroidApp() || !(await isOptedIn())) return false;
	const permission = await PushNotifications.checkPermissions();
	if (permission.receive !== 'granted') return false;
	await reconcileNativeNotifications();
	const existingToken = await storedToken();
	// Install the waiter before asking FCM to register so an immediate callback
	// cannot be missed on a fast device.
	const tokenPromise = existingToken ? Promise.resolve(existingToken) : waitForFreshToken();
	await PushNotifications.register();
	await tokenPromise;
	await syncNativePushRegistration();
	return true;
}

export async function enableNativeNotifications(): Promise<void> {
	if (!isAndroidApp()) return;
	const permission = await PushNotifications.requestPermissions();
	if (permission.receive !== 'granted') throw new Error('Notification permission was not granted.');
	await Preferences.set({ key: PUSH_ENABLED_KEY, value: 'true' });
	try {
		await ensureNativeNotificationsRegistered();
		notifyStateChanged();
	} catch (error) {
		await Preferences.remove({ key: PUSH_ENABLED_KEY });
		throw error;
	}
}

export async function detachNativePushRegistration(targetOrigin?: string): Promise<void> {
	if (!isAndroidApp()) return;
	const installationId = (await Preferences.get({ key: INSTALLATION_ID_KEY })).value;
	if (!installationId) return;
	const url = targetOrigin
		? `${targetOrigin}/api/push/native/unregister`
		: getApiUrl('/api/push/native/unregister');
	const response = await platformRequest(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ installationId })
	});
	if (!response.ok && response.status !== 401 && response.status !== 404) {
		throw new Error(`Android notification cleanup failed (${response.status}).`);
	}
}

export async function disableNativeNotifications(): Promise<void> {
	if (!isAndroidApp()) return;

	await Preferences.remove({ key: PUSH_ENABLED_KEY });

	const installationId = (await Preferences.get({ key: INSTALLATION_ID_KEY })).value;
	if (installationId) {
		try {
			await detachNativePushRegistration();
		} catch (error) {
			console.warn('Could not detach native push registration during disable:', error);
			const origin = getConfiguredServerOrigin();
			if (origin) {
				await recordPendingDetach(origin, installationId);
			}
		}
	}

	try {
		await PushNotifications.unregister();
	} catch (error) {
		console.warn('Could not unregister FCM token during disable:', error);
		await recordPendingFcmUnregister();
	}

	const waiters = pendingTokenWaiters;
	pendingTokenWaiters = [];
	waiters.forEach((waiter) => waiter.reject(new Error('Notifications disabled.')));

	await Preferences.remove({ key: PUSH_TOKEN_KEY });
	notifyStateChanged();
}
