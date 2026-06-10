<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { dev } from '$app/environment';
	import { pwa } from '$lib/pwa.svelte';

	let { children } = $props();

	onMount(() => {
		// Initialize event listeners for install prompt
		pwa.init();

		// Register service worker in production
		if ('serviceWorker' in navigator && !dev) {
			navigator.serviceWorker
				.register('/service-worker.js', { type: 'module' })
				.then((reg) => {
					console.log('Service Worker registered with scope:', reg.scope);
				})
				.catch((err) => {
					console.error('Service Worker registration failed:', err);
				});
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
