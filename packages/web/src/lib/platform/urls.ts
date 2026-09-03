import { getConfiguredServerOrigin } from './serverConfig';
import {
	DEBUG_HTTP_QUERY_PARAM,
	getDebugHttpSessionToken,
	isNativeDebugHttpUrl
} from './debugHttpSession';
import { isNativeApp } from './runtime';

export class NativeServerNotConfiguredError extends Error {
	constructor() {
		super('Configure a Skitgubbe server before continuing.');
		this.name = 'NativeServerNotConfiguredError';
	}
}

function requireApiPath(path: string): string {
	if (!path.startsWith('/api/')) throw new Error(`Expected an /api/ path, received: ${path}`);
	return path;
}

function requireRoutePath(path: string): string {
	if (!path.startsWith('/') || path.startsWith('//')) {
		throw new Error(`Expected an application route, received: ${path}`);
	}
	return path;
}

export function getApiUrl(path: string): string {
	const apiPath = requireApiPath(path);
	if (!isNativeApp()) return apiPath;
	const origin = getConfiguredServerOrigin();
	if (!origin) throw new NativeServerNotConfiguredError();
	return `${origin}${apiPath}`;
}

export function getWebSocketUrl(roomId: string): string {
	const path = `/api/room/${encodeURIComponent(roomId)}/ws`;
	if (isNativeApp()) {
		const origin = getConfiguredServerOrigin();
		if (!origin) throw new NativeServerNotConfiguredError();
		const url = new URL(path, origin);
		url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
		if (isNativeDebugHttpUrl(origin)) {
			const token = getDebugHttpSessionToken(origin);
			if (token) url.searchParams.set(DEBUG_HTTP_QUERY_PARAM, token);
		}
		return url.toString();
	}
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	return `${protocol}//${window.location.host}${path}`;
}

/** URL suitable for sharing outside the locally bundled Capacitor origin. */
export function getPublicRouteUrl(path: string): string {
	const routePath = requireRoutePath(path);
	if (isNativeApp()) {
		const origin = getConfiguredServerOrigin();
		if (!origin) throw new NativeServerNotConfiguredError();
		return new URL(routePath, `${origin}/`).toString();
	}
	return new URL(routePath, window.location.origin).toString();
}
