import { isNativeApp } from './runtime';
import { getApiUrl } from './urls';

/** Prime Chromium's client certificate selection before its WSS handshake.
 * Native HTTP has a separate TLS context; Chromium cancels a WebSocket that
 * needs a new client certificate selection instead of invoking the handler.
 */
export async function prepareWebSocket(signal?: AbortSignal): Promise<void> {
	if (!isNativeApp()) return;
	const url = getApiUrl('/api/app-info');
	if (!url.startsWith('https:')) return;
	const webView = window as Window & { CapacitorWebFetch?: typeof fetch };
	// Capacitor preserves the browser transport here when it patches fetch.
	// Using platformRequest would warm the native HTTP context again.
	const webFetch = webView.CapacitorWebFetch ?? window.fetch;
	await webFetch.call(window, url, {
		mode: 'no-cors',
		credentials: 'include',
		cache: 'no-store',
		redirect: 'error',
		signal
	});
}
