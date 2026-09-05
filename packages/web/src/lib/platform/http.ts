import { CapacitorHttp, type HttpHeaders, type HttpResponse } from '@capacitor/core';
import {
	DEBUG_HTTP_HEADER,
	getDebugHttpSessionToken,
	isNativeDebugHttpUrl
} from './debugHttpSession';
import { syncNativeResponseCookie } from './nativeCookie';
import { isNativeApp } from './runtime';

export const NATIVE_CONNECT_TIMEOUT_MS = 10_000;
export const NATIVE_READ_TIMEOUT_MS = 30_000;

export class PlatformRequestError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'PlatformRequestError';
	}
}

function abortError(): DOMException {
	return new DOMException('The operation was aborted.', 'AbortError');
}

function withAbortSignal<T>(operation: Promise<T>, signal?: AbortSignal | null): Promise<T> {
	if (!signal) return operation;
	if (signal.aborted) return Promise.reject(abortError());

	return new Promise<T>((resolve, reject) => {
		const handleAbort = () => reject(abortError());
		signal.addEventListener('abort', handleAbort, { once: true });
		operation.then(
			(value) => {
				signal.removeEventListener('abort', handleAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', handleAbort);
				reject(error);
			}
		);
	});
}

function responseFromNative(response: HttpResponse): Response {
	const body =
		[204, 205, 304].includes(response.status) || response.data == null
			? null
			: typeof response.data === 'string'
				? response.data
				: JSON.stringify(response.data);
	const result = new Response(body, {
		status: response.status,
		headers: response.headers
	});
	Object.defineProperty(result, 'url', { value: response.url });
	return result;
}

function nativeBody(body: BodyInit | null | undefined, headers: Headers): unknown {
	if (body == null) return undefined;
	if (typeof body === 'string') {
		if (headers.get('content-type')?.toLowerCase().includes('application/json')) {
			try {
				return JSON.parse(body);
			} catch {
				throw new PlatformRequestError('The JSON request body is invalid.');
			}
		}
		return body;
	}
	if (body instanceof URLSearchParams) return body.toString();
	throw new PlatformRequestError('This request body is not supported by the native transport.');
}

function responseHeader(headers: HttpHeaders, name: string): string | undefined {
	const normalizedName = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === normalizedName) return value;
	}
}

/**
 * Shared request transport. Browser calls retain ordinary credentialed fetch;
 * native calls use Capacitor's HttpURLConnection transport and cookie bridge.
 */
export async function platformRequest(url: string, init: RequestInit = {}): Promise<Response> {
	if (!isNativeApp()) {
		return fetch(url, { ...init, credentials: init.credentials ?? 'include' });
	}

	if (init.signal?.aborted) throw abortError();
	const headers = new Headers(init.headers);
	// The server uses this only to issue a Secure, cross-site-capable session
	// cookie for the locally bundled WebView. Browser callers retain SameSite=Lax.
	headers.set('X-Skitgubbe-Platform', 'android');
	if (isNativeDebugHttpUrl(url)) {
		headers.set(DEBUG_HTTP_HEADER, '1');
		const token = getDebugHttpSessionToken(url);
		if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
	}
	const nativeHeaders: HttpHeaders = {};
	headers.forEach((value, key) => {
		nativeHeaders[key] = value;
	});
	if (init.headers && !(init.headers instanceof Headers)) {
		if (Array.isArray(init.headers)) {
			init.headers.forEach(([key, value]) => {
				nativeHeaders[key] = value;
			});
		} else {
			Object.entries(init.headers).forEach(([key, value]) => {
				nativeHeaders[key] = value;
			});
		}
	}

	try {
		const response = await withAbortSignal(
			CapacitorHttp.request({
				url,
				method: init.method ?? 'GET',
				headers: nativeHeaders,
				data: nativeBody(init.body, headers),
				connectTimeout: NATIVE_CONNECT_TIMEOUT_MS,
				readTimeout: NATIVE_READ_TIMEOUT_MS
			}),
			init.signal
		);
		await syncNativeResponseCookie(
			response.url || url,
			responseHeader(response.headers, 'set-cookie')
		);
		return responseFromNative(response);
	} catch (error) {
		if (error instanceof DOMException || error instanceof PlatformRequestError) throw error;
		throw new PlatformRequestError('The server request failed.', error);
	}
}
