<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getClientCertificateStatus,
		removeClientCertificateConfiguration,
		selectInstalledClientCertificate,
		type ClientCertificateStatus
	} from '$lib/platform/clientCertificate';
	import {
		clearConfiguredServerOrigin,
		getConfiguredServerOrigin,
		normalizeServerOrigin,
		saveConfiguredServerOrigin
	} from '$lib/platform/serverConfig';

	let {
		required = false,
		onConnected,
		onCleared,
		onClose
	}: {
		required?: boolean;
		onConnected: (origin: string) => void;
		onCleared: () => void;
		onClose?: () => void;
	} = $props();

	let serverUrl = $state('');
	let certificate = $state<ClientCertificateStatus>({ configured: false, available: false });
	let busy = $state(false);
	let error = $state('');
	let message = $state('');

	onMount(async () => {
		serverUrl = getConfiguredServerOrigin() ?? '';
		await refreshCertificate();
	});

	async function refreshCertificate() {
		try {
			certificate = await getClientCertificateStatus();
		} catch (cause) {
			console.warn('Could not read client certificate status.', cause);
		}
	}

	async function chooseCertificate() {
		error = '';
		message = '';
		let origin: string;
		try {
			origin = normalizeServerOrigin(serverUrl);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Enter a valid HTTPS server URL.';
			return;
		}
		busy = true;
		try {
			const result = await selectInstalledClientCertificate(origin);
			if (result.selected) {
				certificate = result;
				message = 'Client certificate selected. You can now connect.';
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not select the certificate.';
		} finally {
			busy = false;
		}
	}

	async function removeCertificate() {
		busy = true;
		error = '';
		message = '';
		try {
			certificate = await removeClientCertificateConfiguration();
			message = 'Client certificate binding removed.';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not remove the certificate.';
		} finally {
			busy = false;
		}
	}

	async function connect() {
		busy = true;
		error = '';
		message = 'Checking server compatibility…';
		try {
			const { origin, appInfo } = await saveConfiguredServerOrigin(serverUrl);
			serverUrl = origin;
			message = `Connected to Skitgubbe API ${appInfo.api_version}.`;
			onConnected(origin);
		} catch (cause) {
			message = '';
			error = cause instanceof Error ? cause.message : 'Could not connect to the server.';
		} finally {
			busy = false;
		}
	}

	async function clearServer() {
		busy = true;
		error = '';
		message = '';
		try {
			await clearConfiguredServerOrigin();
			serverUrl = '';
			certificate = { configured: false, available: false };
			onCleared();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not clear the server.';
		} finally {
			busy = false;
		}
	}

	function formatDate(timestamp?: number): string {
		return timestamp ? new Date(timestamp).toLocaleDateString() : '—';
	}
</script>

<div
	class="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-md"
>
	<section
		class="glass-panel my-auto w-full max-w-xl rounded-2xl border border-amber-400/30 p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-start justify-between gap-4">
			<div>
				<p class="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">Android app</p>
				<h1 class="mt-1 text-2xl font-bold text-white">Server & client certificate</h1>
			</div>
			{#if !required && onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-full px-3 py-1 text-xl text-white/60 hover:bg-white/10 hover:text-white"
					aria-label="Close settings">×</button
				>
			{/if}
		</div>

		<label class="block text-sm font-semibold text-emerald-100" for="native-server-url">
			Skitgubbe server
		</label>
		<input
			id="native-server-url"
			bind:value={serverUrl}
			disabled={busy}
			placeholder="https://games.example.com"
			inputmode="url"
			autocapitalize="none"
			spellcheck="false"
			class="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white placeholder:text-white/30 focus:border-amber-400 focus:ring-amber-400"
		/>
		<p class="mt-2 text-xs text-white/50">HTTPS only. Enter the origin without an API path.</p>

		<div class="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 class="font-semibold text-white">Android KeyChain</h2>
					<p class="text-xs text-white/55">
						{certificate.configured
							? certificate.available
								? 'Certificate is available'
								: 'The selected certificate is unavailable'
							: 'No certificate selected'}
					</p>
				</div>
				<div class="flex gap-2">
					{#if certificate.configured}
						<button
							type="button"
							disabled={busy}
							onclick={removeCertificate}
							class="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
							>Remove</button
						>
					{/if}
					<button
						type="button"
						disabled={busy}
						onclick={chooseCertificate}
						class="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
						>Select certificate</button
					>
				</div>
			</div>

			{#if certificate.configured}
				<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs break-all">
					<dt class="text-white/45">Origin</dt>
					<dd class="text-white/80">{certificate.origin}</dd>
					<dt class="text-white/45">Subject</dt>
					<dd class="text-white/80">{certificate.subject ?? 'Unavailable'}</dd>
					<dt class="text-white/45">Issuer</dt>
					<dd class="text-white/80">{certificate.issuer ?? 'Unavailable'}</dd>
					<dt class="text-white/45">Valid</dt>
					<dd class="text-white/80">
						{formatDate(certificate.validFrom)} – {formatDate(certificate.expiresAt)}
					</dd>
				</dl>
			{/if}
		</div>

		{#if error}<p class="mt-4 rounded-lg bg-red-950/70 p-3 text-sm text-red-200">{error}</p>{/if}
		{#if message}<p class="mt-4 rounded-lg bg-emerald-950/70 p-3 text-sm text-emerald-200">
				{message}
			</p>{/if}

		<div class="mt-6 flex flex-wrap justify-end gap-3">
			{#if getConfiguredServerOrigin()}
				<button
					type="button"
					disabled={busy}
					onclick={clearServer}
					class="rounded-xl px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
					>Clear server</button
				>
			{/if}
			<button
				type="button"
				disabled={busy || !serverUrl.trim()}
				onclick={connect}
				class="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg disabled:opacity-50"
				>{busy ? 'Working…' : 'Connect'}</button
			>
		</div>
	</section>
</div>
