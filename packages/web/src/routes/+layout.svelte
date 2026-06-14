<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { pwa } from '$lib/pwa.svelte';
	import { updated } from '$app/stores';
	import { fly } from 'svelte/transition';

	let { children } = $props();
	let showUpdateNotification = $state(false);

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
				})
				.catch((err) => {
					console.error('Service Worker registration failed:', err);
				});
		}

		// Subscribe to SvelteKit's version updates
		let unsubscribe: (() => void) | undefined;
		if (!dev) {
			unsubscribe = updated.subscribe((hasNewVersion) => {
				if (hasNewVersion) {
					showUpdateNotification = true;
				}
			});
		}

		return () => {
			if (unsubscribe) unsubscribe();
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}

{#if showUpdateNotification}
	<div
		transition:fly={{ y: 50, duration: 400 }}
		class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[calc(100vw-2rem)] glass-panel rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 border border-yellow-500/20 shadow-2xl"
	>
		<div class="flex-1 text-center sm:text-left">
			<h3 class="font-bold text-yellow-400 text-sm">Update Available</h3>
			<p class="text-xs text-emerald-100/80 mt-1">
				A new version of Skitgubbe is available. Reload now to update.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (showUpdateNotification = false)}
				class="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
			>
				Later
			</button>
			<button
				onclick={() => location.reload()}
				class="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
			>
				Reload
			</button>
		</div>
	</div>
{/if}
