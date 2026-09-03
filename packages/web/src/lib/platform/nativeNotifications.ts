import type { PluginListenerHandle } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiRequest } from './api';
import { isAndroidApp } from './runtime';

const INSTALLATION_ID_KEY = 'skitgubbe_installation_id';
const PUSH_TOKEN_KEY = 'skitgubbe_native_push_token';
const PUSH_ENABLED_KEY = 'skitgubbe_native_push_enabled';
const REGISTRATION_TIMEOUT_MS = 15_000;

let listeners: PluginListenerHandle[] = [];
let listenersInstalled = false;
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

export async function installNativeNotificationListeners(): Promise<() => Promise<void>> {
	if (!isAndroidApp() || listenersInstalled) return async () => {};
	listenersInstalled = true;

	listeners = [
		await PushNotifications.addListener('registration', (token) => {
			void handleRegistration(token.value);
		}),
		await PushNotifications.addListener('registrationError', (registrationError) => {
			const error = new Error(registrationError.error || 'Android push registration failed.');
			const waiters = pendingTokenWaiters;
			pendingTokenWaiters = [];
			waiters.forEach((waiter) => waiter.reject(error));
		}),
		await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
			const route = trustedRoute(notification.data?.route);
			if (route) window.location.assign(route);
		}),
		await PushNotifications.addListener('pushNotificationReceived', () => {
			// Foreground presentation is controlled by capacitor.config.ts.
		})
	];

	await PushNotifications.createChannel({
		id: 'game-updates',
		name: 'Game updates',
		description: 'Invitations, turns, and completed Skitgubbe games',
		importance: 4,
		visibility: 1,
		vibration: true
	});

	return async () => {
		await Promise.all(listeners.map((listener) => listener.remove()));
		listeners = [];
		listenersInstalled = false;
	};
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

export async function detachNativePushRegistration(): Promise<void> {
	if (!isAndroidApp()) return;
	const installationId = (await Preferences.get({ key: INSTALLATION_ID_KEY })).value;
	if (!installationId) return;
	const response = await apiRequest('/api/push/native/unregister', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ installationId })
	});
	if (!response.ok) throw new Error(`Android notification cleanup failed (${response.status}).`);
}

export async function disableNativeNotifications(): Promise<void> {
	if (!isAndroidApp()) return;
	const results = await Promise.allSettled([
		detachNativePushRegistration(),
		PushNotifications.unregister()
	]);
	for (const result of results) {
		if (result.status === 'rejected') {
			console.warn('Android notification cleanup was only partially completed.', result.reason);
		}
	}
	await Promise.all([
		Preferences.remove({ key: PUSH_TOKEN_KEY }),
		Preferences.remove({ key: PUSH_ENABLED_KEY })
	]);
	notifyStateChanged();
}
