import { isNativeDebugBuild } from './runtime';

export const DEBUG_HTTP_SESSION_KEY = 'skitgubbe_debug_http_session';
export const DEBUG_HTTP_SESSION_ORIGIN_KEY = 'skitgubbe_debug_http_session_origin';
export const DEBUG_HTTP_HEADER = 'X-Skitgubbe-Debug-Http';
export const DEBUG_HTTP_QUERY_PARAM = '_debug_session';

export function isNativeDebugHttpUrl(value: string): boolean {
	if (!isNativeDebugBuild()) return false;
	try {
		return new URL(value).protocol === 'http:';
	} catch {
		return false;
	}
}

export function getDebugHttpSessionToken(requestUrl: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	const sessionOrigin = localStorage.getItem(DEBUG_HTTP_SESSION_ORIGIN_KEY);
	try {
		if (!sessionOrigin || new URL(requestUrl).origin !== sessionOrigin) return null;
	} catch {
		return null;
	}
	return localStorage.getItem(DEBUG_HTTP_SESSION_KEY);
}

export function setDebugHttpSessionToken(value: string, origin: string): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(DEBUG_HTTP_SESSION_KEY, value);
		localStorage.setItem(DEBUG_HTTP_SESSION_ORIGIN_KEY, new URL(origin).origin);
	}
}

export function clearDebugHttpSessionToken(): void {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(DEBUG_HTTP_SESSION_KEY);
		localStorage.removeItem(DEBUG_HTTP_SESSION_ORIGIN_KEY);
	}
}
