<script lang="ts">
	import './layout.css';
	import '@fontsource/inter/400.css';
	import '@fontsource/cormorant-garamond/latin-400.css';
	import '@fontsource/cormorant-garamond/latin-400-italic.css';
	import '@fontsource/cormorant-garamond/latin-600.css';
	import '@fontsource/cormorant-garamond/latin-600-italic.css';
	import '@fontsource/cormorant-garamond/latin-700.css';
	import '@fontsource/outfit/400.css';
	import '@fontsource/outfit/500.css';
	import '@fontsource/outfit/600.css';
	import '@fontsource/outfit/700.css';
	import '@fontsource/nanum-brush-script/latin.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { pwa } from '$lib/pwa.svelte';
	import { updated } from '$app/stores';
	import { fly } from 'svelte/transition';
	import NativeSettings from '$lib/components/native/NativeSettings.svelte';
	import { installNativeLifecycle } from '$lib/platform/lifecycle';
	import { installNativeNotificationListeners } from '$lib/platform/nativeNotifications';
	import {
		getConfiguredServerOrigin,
		hydrateConfiguredServerOrigin
	} from '$lib/platform/serverConfig';
	import { isNativeApp } from '$lib/platform/runtime';

	let { children } = $props();
	const nativeApp = isNativeApp();
	let showUpdateNotification = $state(false);
	let swRegistration: ServiceWorkerRegistration | null = null;
	let platformReady = $state(!nativeApp);
	let nativeServerConfigured = $state(!nativeApp);
	let nativeSettingsOpen = $state(false);
	let nativeBootstrapError = $state('');
	let removeNativeLifecycle: (() => Promise<void>) | undefined;
	let removeNativeNotifications: (() => Promise<void>) | undefined;

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
		import('@dotlottie/player-component');
		if (nativeApp) {
			document.documentElement.classList.add('native-app');
			void (async () => {
				try {
					const origin = await hydrateConfiguredServerOrigin();
					nativeServerConfigured = Boolean(origin);
					removeNativeLifecycle = await installNativeLifecycle();
					removeNativeNotifications = await installNativeNotificationListeners();
				} catch (error) {
					console.error('Native platform initialization failed:', error);
					nativeBootstrapError = 'Could not initialize native settings. You can retry below.';
					nativeServerConfigured = Boolean(getConfiguredServerOrigin());
				} finally {
					platformReady = true;
				}
			})();
		}

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
		if (!nativeApp) pwa.init();

		// Register service worker in production
		if (!nativeApp && 'serviceWorker' in navigator && !dev) {
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
				!nativeApp &&
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
		if (!nativeApp && !dev) {
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
			document.documentElement.classList.remove('native-app');
			void removeNativeLifecycle?.();
			void removeNativeNotifications?.();
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if !platformReady}
	<div class="flex h-[var(--app-height)] items-center justify-center bg-slate-950 text-amber-300">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-amber-400/20 border-t-amber-400"
		></div>
	</div>
{:else if nativeApp && !nativeServerConfigured}
	{#if nativeBootstrapError}
		<p
			class="fixed top-4 left-1/2 z-[10001] -translate-x-1/2 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-100"
		>
			{nativeBootstrapError}
		</p>
	{/if}
	<NativeSettings
		required
		onConnected={() => window.location.replace('/')}
		onCleared={() => (nativeServerConfigured = false)}
	/>
{:else}
	{@render children()}
	{#if nativeApp}
		<button
			type="button"
			onclick={() => (nativeSettingsOpen = true)}
			class="fixed right-[calc(0.75rem+var(--safe-area-inset-right))] bottom-[calc(0.75rem+var(--safe-area-inset-bottom))] z-[9000] flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/75 text-lg text-white/70 shadow-lg backdrop-blur hover:text-amber-300"
			aria-label="Open Android server settings"
			title="Android server settings">⚙</button
		>
	{/if}
{/if}

{#if nativeApp && nativeSettingsOpen}
	<NativeSettings
		onConnected={() => window.location.replace('/')}
		onCleared={() => {
			nativeServerConfigured = false;
			nativeSettingsOpen = false;
		}}
		onClose={() => (nativeSettingsOpen = false)}
	/>
{/if}

<!-- Global SVG definitions for filters and clip paths used in avatars -->
<svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">
	<defs>
		<filter id="blur-shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="4" />
		</filter>
		<filter id="lip-glow" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="soft-nose" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="4" />
		</filter>
		<filter id="eye-shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-1" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-2" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-3" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-6" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-8" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-9" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="brow-soft-10" x="-20%" y="-20%" width="140%" height="140%">
			<feGaussianBlur stdDeviation="3" />
		</filter>
		<filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
			<feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#b88728" flood-opacity="0.9" />
		</filter>

		<clipPath id="eye-clip-1">
			<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" />
		</clipPath>
		<clipPath id="eye-clip-3">
			<path d="M 20 110 L 180 100 C 140 150, 60 150, 20 110 Z" />
		</clipPath>
		<clipPath id="eye-clip-4">
			<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 120, 70 120, 20 100 Z" />
		</clipPath>
		<clipPath id="eye-clip-6">
			<path d="M 20 80 C 80 50, 140 90, 180 140 C 120 150, 60 120, 20 80 Z" />
		</clipPath>
		<clipPath id="eyeClip7">
			<path d="M 20 100 C 40 20 150 30 180 120 C 140 180 60 160 20 100 Z" />
		</clipPath>
		<clipPath id="eyeClip6">
			<path d="M 20 80 C 80 40 160 100 180 120 C 140 160 60 140 20 80 Z" />
		</clipPath>
		<clipPath id="eyeClip10">
			<path d="M 20 100 C 60 60 140 70 180 110 C 140 140 60 140 20 100 Z" />
		</clipPath>
	</defs>
</svg>

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
