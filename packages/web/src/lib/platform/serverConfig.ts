import { CapacitorCookies } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
	commitClientCertificateConfiguration,
	removeClientCertificateConfiguration
} from './clientCertificate';
import { onServerOriginChanged, onServerOriginCleared } from './nativeNotifications';
import { platformRequest } from './http';
import { clearDebugHttpSessionToken } from './debugHttpSession';
import { isNativeApp, isNativeDebugBuild } from './runtime';

export const SERVER_ORIGIN_KEY = 'skitgubbe_server_origin';
export const SKITGUBBE_PRODUCT_ID = 'skitgubbe';
export const SUPPORTED_API_VERSIONS = new Set([1]);

export interface AppInfoResponse {
	product: string;
	api_version: number;
	server_version: string;
}

export type ServerConnectionFailure =
	| 'invalid-url'
	| 'unreachable'
	| 'http-error'
	| 'wrong-product'
	| 'unsupported-api-version';

export class ServerConnectionError extends Error {
	constructor(
		message: string,
		readonly kind: ServerConnectionFailure,
		readonly status?: number,
		readonly apiVersion?: number
	) {
		super(message);
		this.name = 'ServerConnectionError';
	}
}

export function normalizeServerOrigin(value: string): string {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new ServerConnectionError('Enter a valid server URL.', 'invalid-url');
	}

	const protocolAllowed =
		url.protocol === 'https:' || (isNativeDebugBuild() && url.protocol === 'http:');
	if (!protocolAllowed || url.username || url.password) {
		throw new ServerConnectionError(
			isNativeDebugBuild()
				? 'Use an HTTP or HTTPS server URL without embedded credentials.'
				: 'Use an HTTPS server URL without embedded credentials.',
			'invalid-url'
		);
	}
	if (url.port === '0') {
		throw new ServerConnectionError('Enter a valid server port.', 'invalid-url');
	}
	if (url.pathname !== '/' || url.search || url.hash) {
		throw new ServerConnectionError('Enter only the server origin, without a path.', 'invalid-url');
	}
	// Match Android's host normalization so a harmless trailing DNS dot cannot
	// make the JavaScript and KeyChain bindings appear to target different hosts.
	if (url.hostname.endsWith('.')) url.hostname = url.hostname.slice(0, -1);
	return url.origin;
}

export function getConfiguredServerOrigin(): string | null {
	if (!isNativeApp() || typeof localStorage === 'undefined') return null;
	const stored = localStorage.getItem(SERVER_ORIGIN_KEY);
	if (!stored) return null;
	try {
		return normalizeServerOrigin(stored);
	} catch {
		localStorage.removeItem(SERVER_ORIGIN_KEY);
		clearDebugHttpSessionToken();
		return null;
	}
}

/** Reconcile the durable native preference into the synchronous URL mirror. */
export async function hydrateConfiguredServerOrigin(): Promise<string | null> {
	if (!isNativeApp()) return null;
	const { value } = await Preferences.get({ key: SERVER_ORIGIN_KEY });
	if (!value) {
		localStorage.removeItem(SERVER_ORIGIN_KEY);
		clearDebugHttpSessionToken();
		return null;
	}

	try {
		const normalized = normalizeServerOrigin(value);
		localStorage.setItem(SERVER_ORIGIN_KEY, normalized);
		return normalized;
	} catch {
		await Preferences.remove({ key: SERVER_ORIGIN_KEY });
		localStorage.removeItem(SERVER_ORIGIN_KEY);
		clearDebugHttpSessionToken();
		return null;
	}
}

export async function testServerConnection(value: string): Promise<AppInfoResponse> {
	const origin = normalizeServerOrigin(value);
	let response: Response;
	try {
		response = await platformRequest(`${origin}/api/app-info`, {
			headers: { Accept: 'application/json' }
		});
	} catch (error) {
		throw new ServerConnectionError(
			'Could not reach that server. Check the address, network, and client certificate.',
			'unreachable'
		);
	}

	if (!response.ok) {
		throw new ServerConnectionError(
			`The server responded with HTTP ${response.status}.`,
			'http-error',
			response.status
		);
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new ServerConnectionError('This is not a compatible Skitgubbe server.', 'wrong-product');
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new ServerConnectionError('This is not a compatible Skitgubbe server.', 'wrong-product');
	}

	const appInfo = body as Partial<AppInfoResponse>;
	if (
		appInfo.product !== SKITGUBBE_PRODUCT_ID ||
		typeof appInfo.api_version !== 'number' ||
		!Number.isInteger(appInfo.api_version) ||
		typeof appInfo.server_version !== 'string'
	) {
		throw new ServerConnectionError('This is not a compatible Skitgubbe server.', 'wrong-product');
	}
	if (!SUPPORTED_API_VERSIONS.has(appInfo.api_version)) {
		throw new ServerConnectionError(
			`This app does not support server API version ${appInfo.api_version}.`,
			'unsupported-api-version',
			undefined,
			appInfo.api_version
		);
	}
	return appInfo as AppInfoResponse;
}

function clearServerScopedClientState(): void {
	if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
	if (typeof localStorage === 'undefined') return;
	for (let index = localStorage.length - 1; index >= 0; index -= 1) {
		const key = localStorage.key(index);
		if (key && (key.startsWith('skitgubbe_') || key.startsWith('push_synced:'))) {
			if (key !== SERVER_ORIGIN_KEY) localStorage.removeItem(key);
		}
	}
}

export async function saveConfiguredServerOrigin(
	value: string
): Promise<{ origin: string; appInfo: AppInfoResponse }> {
	if (!isNativeApp()) {
		throw new ServerConnectionError(
			'Server selection is only available in the app.',
			'invalid-url'
		);
	}
	const normalized = normalizeServerOrigin(value);
	// Validation happens before the durable setting is accepted.
	// Any candidate client certificate for this normalized origin is already staged in TLS.
	const appInfo = await testServerConnection(normalized);
	const previous = getConfiguredServerOrigin();
	if (previous && previous !== normalized) {
		// Clean up native notifications on previous server and invalidate FCM token
		await onServerOriginChanged({ previousOrigin: previous, newOrigin: normalized });
		// Commit client certificate binding for normalized (or clears if none staged)
		await commitClientCertificateConfiguration(normalized);
		try {
			await CapacitorCookies.clearCookies({ url: previous });
		} catch (error) {
			console.warn('Could not clear the previous server cookies.', error);
		}
		clearServerScopedClientState();
	} else {
		await commitClientCertificateConfiguration(normalized);
	}
	await Preferences.set({ key: SERVER_ORIGIN_KEY, value: normalized });
	localStorage.setItem(SERVER_ORIGIN_KEY, normalized);
	return { origin: normalized, appInfo };
}

export async function clearConfiguredServerOrigin(): Promise<void> {
	if (!isNativeApp()) return;
	const current = getConfiguredServerOrigin();
	if (current) {
		await onServerOriginCleared({ previousOrigin: current });
	}
	await removeClientCertificateConfiguration();
	await Preferences.remove({ key: SERVER_ORIGIN_KEY });
	localStorage.removeItem(SERVER_ORIGIN_KEY);
	clearServerScopedClientState();
	if (current) {
		try {
			await CapacitorCookies.clearCookies({ url: current });
		} catch (error) {
			console.warn('Could not clear the previous server cookies.', error);
		}
	}
}
