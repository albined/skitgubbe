/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE_NAME = `skitgubbe-cache-${version}`;

// We cache all built assets, static assets, and the root '/' page as our app shell
const ASSETS = ['/', ...build, ...files];

self.addEventListener('install', (event: any) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS);
		}).then(() => {
			// Force the waiting service worker to become the active service worker
			(self as any).skipWaiting();
		})
	);
});

self.addEventListener('activate', (event: any) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.map((key) => {
					if (key !== CACHE_NAME) {
						return caches.delete(key);
					}
				})
			);
		}).then(() => {
			// Tell the active service worker to take control of all open clients
			(self as any).clients.claim();
		})
	);
});

self.addEventListener('fetch', (event: any) => {
	// Only intercept standard GET requests
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Only handle http/https requests (ignore chrome-extension, ws, wss, etc.)
	if (!url.protocol.startsWith('http')) return;

	// Do not intercept API requests (which are handled by the backend server)
	if (url.pathname.startsWith('/api')) return;

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			// If the asset is not in cache, try fetching it from the network
			return fetch(event.request).catch((err) => {
				// If offline and request is a page navigation, return the cached app shell
				if (event.request.mode === 'navigate') {
					return caches.match('/').then((rootResponse) => {
						if (rootResponse) {
							return rootResponse;
						}
						// If the app shell is somehow not cached, rethrow error
						throw err;
					});
				}
				throw err;
			});
		})
	);
});
