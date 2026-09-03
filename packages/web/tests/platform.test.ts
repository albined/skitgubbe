import { afterEach, describe, expect, test } from 'bun:test';
import { Capacitor } from '@capacitor/core';
import {
	SERVER_ORIGIN_KEY,
	normalizeServerOrigin,
	testServerConnection,
	ServerConnectionError
} from '../src/lib/platform/serverConfig';
import { getApiUrl, getPublicRouteUrl, getWebSocketUrl } from '../src/lib/platform/urls';
import {
	DEBUG_HTTP_SESSION_KEY,
	DEBUG_HTTP_SESSION_ORIGIN_KEY,
	getDebugHttpSessionToken
} from '../src/lib/platform/debugHttpSession';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const originalIsNativePlatform = Capacitor.isNativePlatform;
const originalGetPlatform = Capacitor.getPlatform;
const originalDebug = Capacitor.DEBUG;

function memoryStorage(entries: Record<string, string> = {}): Storage {
	const values = new Map(Object.entries(entries));
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => values.delete(key),
		setItem: (key, value) => values.set(key, value)
	};
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	globalThis.window = originalWindow;
	globalThis.localStorage = originalLocalStorage;
	Capacitor.isNativePlatform = originalIsNativePlatform;
	Capacitor.getPlatform = originalGetPlatform;
	Capacitor.DEBUG = originalDebug;
});

describe('native server origin rules', () => {
	test('normalizes HTTPS host casing and effective ports', () => {
		expect(normalizeServerOrigin(' https://Games.Example.com/ ')).toBe('https://games.example.com');
		expect(normalizeServerOrigin('https://games.example.com:443')).toBe(
			'https://games.example.com'
		);
		expect(normalizeServerOrigin('https://games.example.com:8443')).toBe(
			'https://games.example.com:8443'
		);
		expect(normalizeServerOrigin('https://games.example.com.')).toBe('https://games.example.com');
	});

	test('rejects cleartext, credentials, paths, query strings, and fragments', () => {
		for (const value of [
			'http://games.example.com',
			'https://user:pass@games.example.com',
			'https://games.example.com/base',
			'https://games.example.com/?x=1',
			'https://games.example.com/#fragment',
			'https://games.example.com:0'
		]) {
			expect(() => normalizeServerOrigin(value)).toThrow(ServerConnectionError);
		}
	});

	test('accepts only the stable product and a supported API version', async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({ product: 'skitgubbe', api_version: 1, server_version: 'test' }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)) as typeof fetch;
		expect(await testServerConnection('https://games.example.com')).toEqual({
			product: 'skitgubbe',
			api_version: 1,
			server_version: 'test'
		});

		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({ product: 'different-app', api_version: 1, server_version: 'test' }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)) as typeof fetch;
		await expect(testServerConnection('https://games.example.com')).rejects.toMatchObject({
			kind: 'wrong-product'
		});

		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({ product: 'skitgubbe', api_version: 2, server_version: 'test' }),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)) as typeof fetch;
		await expect(testServerConnection('https://games.example.com')).rejects.toMatchObject({
			kind: 'unsupported-api-version',
			apiVersion: 2
		});
	});
});

describe('browser URL behavior', () => {
	test('keeps API paths relative and derives same-origin WebSockets', () => {
		globalThis.window = {
			location: {
				protocol: 'https:',
				host: 'play.example.com',
				origin: 'https://play.example.com'
			}
		} as Window & typeof globalThis;
		expect(getApiUrl('/api/profiles')).toBe('/api/profiles');
		expect(getWebSocketUrl('room with spaces')).toBe(
			'wss://play.example.com/api/room/room%20with%20spaces/ws'
		);
		expect(getPublicRouteUrl('/room/abc')).toBe('https://play.example.com/room/abc');
		expect(() => getPublicRouteUrl('//evil.example')).toThrow();
	});
});

describe('native URL behavior', () => {
	test('uses the configured HTTPS server for API, WSS, and public links', () => {
		Capacitor.isNativePlatform = () => true;
		globalThis.localStorage = memoryStorage({
			[SERVER_ORIGIN_KEY]: 'https://games.example.com:8443'
		});

		expect(getApiUrl('/api/profiles')).toBe('https://games.example.com:8443/api/profiles');
		expect(getWebSocketUrl('room one')).toBe('wss://games.example.com:8443/api/room/room%20one/ws');
		expect(getPublicRouteUrl('/room/abc')).toBe('https://games.example.com:8443/room/abc');
	});

	test('allows HTTP and ws:// only in an Android debug build', () => {
		Capacitor.isNativePlatform = () => true;
		Capacitor.getPlatform = () => 'android';
		Capacitor.DEBUG = true;
		globalThis.localStorage = memoryStorage({
			[SERVER_ORIGIN_KEY]: 'http://10.15.20.42:5173',
			[DEBUG_HTTP_SESSION_KEY]: 'debug.jwt.token',
			[DEBUG_HTTP_SESSION_ORIGIN_KEY]: 'http://10.15.20.42:5173'
		});

		expect(normalizeServerOrigin('http://10.15.20.42:5173')).toBe('http://10.15.20.42:5173');
		expect(getApiUrl('/api/profiles')).toBe('http://10.15.20.42:5173/api/profiles');
		expect(getDebugHttpSessionToken('http://10.15.20.42:5173/api/profiles')).toBe(
			'debug.jwt.token'
		);
		expect(getDebugHttpSessionToken('http://10.15.20.99:5173/api/app-info')).toBeNull();
		expect(getWebSocketUrl('room one')).toBe(
			'ws://10.15.20.42:5173/api/room/room%20one/ws?_debug_session=debug.jwt.token'
		);
		expect(getPublicRouteUrl('/room/abc')).toBe('http://10.15.20.42:5173/room/abc');
	});
});
