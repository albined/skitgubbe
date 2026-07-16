/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

// TS types this file against lib.dom; the webworker lib reference plus this
// cast (the SvelteKit-documented pattern) gives us the real SW global.
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `skitgubbe-cache-${version}`;
const cachePromise = caches.open(CACHE_NAME);

// We cache all built assets, static assets, and the root '/' page as our app shell
const ASSETS = ['/', ...build, ...files];

// Shape produced by the server's sendPushNotification (packages/server/src/notifications.ts)
interface PushPayload {
	title?: string;
	body?: string;
	url?: string;
}

interface PushSubscriptionChangeEvent extends ExtendableEvent {
	readonly newSubscription: PushSubscription | null;
	readonly oldSubscription: PushSubscription | null;
}

sw.addEventListener('install', (event: ExtendableEvent) => {
	// No skipWaiting() here: the new worker stays waiting until every client
	// closes or the user accepts the in-app update prompt (SKIP_WAITING
	// message below). Force-activating would delete the old version's cache
	// under live games, breaking lazy-loaded chunks mid-game.
	event.waitUntil(cachePromise.then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('message', (event: ExtendableMessageEvent) => {
	if (event.data?.type === 'SKIP_WAITING') {
		sw.skipWaiting();
	}
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys.map((key) => {
						if (key !== CACHE_NAME) {
							return caches.delete(key);
						}
					})
				);
			})
			.then(() => {
				// Tell the active service worker to take control of all open clients
				sw.clients.claim();
			})
	);
});

sw.addEventListener('fetch', (event: FetchEvent) => {
	// Only intercept standard GET requests
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Only handle http/https requests (ignore chrome-extension, ws, wss, etc.)
	if (!url.protocol.startsWith('http')) return;

	// Do not intercept API requests (which are handled by the backend server)
	if (url.pathname.startsWith('/api')) return;

	event.respondWith(
		cachePromise.then(async (cache) => {
			// 1. Cache-First for immutable build assets (as they have unique hashes in filenames)
			if (build.includes(url.pathname)) {
				const cachedResponse = await cache.match(event.request);
				if (cachedResponse) {
					return cachedResponse;
				}
			}

			// 2. Network-First for mutable files (/, static files, etc.)
			try {
				const response = await fetch(event.request);

				// Only cache known app-shell paths — caching every 200 GET would
				// grow the cache unboundedly within a version (e.g. per-room URLs)
				if (response.status === 200 && ASSETS.includes(url.pathname)) {
					cache.put(event.request, response.clone());
				}

				return response;
			} catch (err) {
				// Fallback to cache if offline
				const cachedResponse = await cache.match(event.request);
				if (cachedResponse) {
					return cachedResponse;
				}

				// If we are offline and navigating, fall back to the cached root app shell
				if (event.request.mode === 'navigate') {
					const rootResponse = await cache.match('/');
					if (rootResponse) {
						return rootResponse;
					}
				}
				throw err;
			}
		})
	);
});

function shouldSuppressNotification(
	clientList: readonly WindowClient[],
	targetUrl: string
): boolean {
	return clientList.some((client) => {
		try {
			return client.focused && new URL(client.url).pathname === targetUrl;
		} catch {
			return false;
		}
	});
}

sw.addEventListener('push', (event: PushEvent) => {
	if (!event.data) return;

	let title = 'Skitgubbe';
	const options: NotificationOptions & { data: { url: string } } = {
		body: 'You have a new update in your game.',
		icon: '/icon-192.png',
		badge: '/badge-96.png',
		data: { url: '/' }
	};

	try {
		const payload: PushPayload = event.data.json();
		title = payload.title || title;
		options.body = payload.body || options.body;
		if (payload.url) {
			try {
				const parsedUrl = new URL(payload.url, sw.location.origin);
				if (parsedUrl.origin === sw.location.origin) {
					options.data.url = payload.url;
				}
			} catch {
				// Ignore
			}
		}
	} catch (e) {
		console.error('Failed to parse push event payload', e);
	}

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			if (shouldSuppressNotification(clientList, options.data.url)) {
				return;
			}
			return sw.registration.showNotification(title, options);
		})
	);
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
	event.notification.close();

	const targetPath: string = event.notification.data?.url ?? '/';
	let targetUrl = new URL('/', sw.location.origin).href;
	try {
		const parsedUrl = new URL(targetPath, sw.location.origin);
		if (parsedUrl.origin === sw.location.origin) {
			targetUrl = parsedUrl.href;
		}
	} catch {
		// Ignore and fallback
	}

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 1. If we find a window already on the exact target room URL, just focus it
			for (const client of clientList) {
				if (client.url === targetUrl) {
					return client.focus();
				}
			}

			// 2. If a window is open anywhere else in the app, navigate and focus it
			for (const client of clientList) {
				client.focus();
				return client.navigate(targetUrl);
			}

			// 3. Otherwise, open a new window
			return sw.clients.openWindow(targetUrl);
		})
	);
});

sw.addEventListener('pushsubscriptionchange', (event: PushSubscriptionChangeEvent) => {
	event.waitUntil(
		(async () => {
			const activeSub =
				event.newSubscription || (await sw.registration.pushManager.getSubscription());
			if (!activeSub) return;

			await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(activeSub)
			});

			if (event.oldSubscription && event.oldSubscription.endpoint !== activeSub.endpoint) {
				await fetch('/api/push/unsubscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: event.oldSubscription.endpoint })
				});
			}
		})()
	);
});
