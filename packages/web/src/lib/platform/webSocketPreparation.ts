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
		// Fetch rejects cross-origin no-cors requests unless redirects are followed,
		// even when the endpoint itself does not redirect. This is TLS preparation
		// only; the WebSocket still connects to the configured origin.
		redirect: 'follow',
		signal
	});
}
