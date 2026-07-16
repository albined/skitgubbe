<script lang="ts">
	import './layout.css';
	import '@fontsource/inter/300.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/inter/500.css';
	import '@fontsource/inter/600.css';
	import '@fontsource/outfit/300.css';
	import '@fontsource/outfit/400.css';
	import '@fontsource/outfit/500.css';
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/700.css';
	import '@fontsource/nanum-brush-script/index.css';
	import '@dotlottie/player-component';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { pwa } from '$lib/pwa.svelte';
	import { updated } from '$app/stores';
	import { fly } from 'svelte/transition';

	let { children } = $props();
	let showUpdateNotification = $state(false);
	let swRegistration: ServiceWorkerRegistration | null = null;

	// The SW installs new versions but never force-activates (no skipWaiting on
	// install) — activation happens here, on explicit user consent. This matters
	// because the manifest is display:fullscreen, so users can't reload manually.
	function applyUpdate() {
		const waiting = swRegistration?.waiting;
		if (waiting) {
			navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
				once: true
			});
			waiting.postMessage({ type: 'SKIP_WAITING' });
			// Safety net in case controllerchange never fires
			setTimeout(() => location.reload(), 2000);
		} else {
			location.reload();
		}
	}

	onMount(() => {
		// Lock viewport height to avoid resizing when system drawers/address bars toggle
		function updateAppHeight() {
			document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
		}

		let lastWidth = window.innerWidth;
		updateAppHeight();

		window.addEventListener('resize', () => {
			const width = window.innerWidth;
			const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
			if (!isTouch || width !== lastWidth) {
				updateAppHeight();
				lastWidth = width;
			}
		});

		// Initialize event listeners for install prompt
		pwa.init();

		// Register service worker in production
		if ('serviceWorker' in navigator && !dev) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.then((reg) => {
					console.log('Service Worker registered with scope:', reg.scope);
					swRegistration = reg;
					// A new worker may already be waiting from a previous visit
					if (reg.waiting) {
						showUpdateNotification = true;
					}
					reg.addEventListener('updatefound', () => {
						const worker = reg.installing;
						worker?.addEventListener('statechange', () => {
							// 'installed' with an existing controller means an update is
							// waiting (a first-ever install has no controller yet)
							if (worker.state === 'installed' && navigator.serviceWorker.controller) {
								showUpdateNotification = true;
							}
						});
					});
				})
				.catch((err) => {
					console.error('Service Worker registration failed:', err);
				});
		}

		// Clear any existing active notifications when the app mounts, is focused, or becomes visible
		function clearNotifications() {
			if (
				'serviceWorker' in navigator &&
				'Notification' in window &&
				Notification.permission === 'granted'
			) {
				navigator.serviceWorker.ready
					.then((registration) => {
						if (registration.getNotifications) {
							return registration.getNotifications();
						}
						return [];
					})
					.then((notifications) => {
						notifications.forEach((notification) => notification.close());
					})
					.catch((err) => {
						console.warn('Failed to clear notifications:', err);
					});
			}
		}

		// Run immediately on mount
		clearNotifications();

		window.addEventListener('focus', clearNotifications);
		document.addEventListener('visibilitychange', clearNotifications);

		// Subscribe to SvelteKit's version updates
		let unsubscribe: (() => void) | undefined;
		if (!dev) {
			unsubscribe = updated.subscribe((hasNewVersion) => {
				if (hasNewVersion) {
					showUpdateNotification = true;
					// Nudge the browser to fetch the new SW now, so it's installed
					// and waiting by the time the user clicks Reload
					swRegistration?.update().catch(() => {});
				}
			});
		}

		return () => {
			if (unsubscribe) unsubscribe();
			window.removeEventListener('focus', clearNotifications);
			document.removeEventListener('visibilitychange', clearNotifications);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

{#if showUpdateNotification}
	<div
		transition:fly={{ y: 50, duration: 400 }}
		class="glass-panel fixed bottom-6 left-1/2 z-[9999] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-4 rounded-xl border border-yellow-500/20 p-4 shadow-2xl sm:flex-row"
	>
		<div class="flex-1 text-center sm:text-left">
			<h3 class="text-sm font-bold text-yellow-400">Update Available</h3>
			<p class="mt-1 text-xs text-emerald-100/80">
				A new version of Skitgubbe is available. Reload now to update.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (showUpdateNotification = false)}
				class="rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
			>
				Later
			</button>
			<button
				onclick={applyUpdate}
				class="rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] hover:from-amber-300 hover:to-amber-400 active:scale-[0.98]"
			>
				Reload
			</button>
		</div>
	</div>
{/if}
