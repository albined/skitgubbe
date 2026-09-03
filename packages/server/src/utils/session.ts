import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';

export const DEBUG_HTTP_HEADER = 'x-skitgubbe-debug-http';
export const DEBUG_HTTP_QUERY_PARAM = '_debug_session';

export function isNativeDebugHttpRequest(c: Context): boolean {
	return (
		process.env.NODE_ENV !== 'production' &&
		c.req.header('x-skitgubbe-platform') === 'android' &&
		c.req.header(DEBUG_HTTP_HEADER) === '1'
	);
}

export function getRequestSessionToken(c: Context): string | undefined {
	if (isNativeDebugHttpRequest(c)) {
		const authorization = c.req.header('authorization');
		if (authorization?.startsWith('Bearer ')) {
			const bearerToken = authorization.slice('Bearer '.length).trim();
			if (bearerToken) return bearerToken;
		}
	}
	return getCookie(c, 'skitgubbe_session');
}

export function getWebSocketSessionToken(c: Context): string | undefined {
	if (process.env.NODE_ENV !== 'production') {
		const debugToken = c.req.query(DEBUG_HTTP_QUERY_PARAM);
		if (debugToken) return debugToken;
	}
	return getCookie(c, 'skitgubbe_session');
}
