<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		getClientCertificateStatus,
		rollbackClientCertificateConfiguration,
		selectInstalledClientCertificate,
		stageRemoveClientCertificate,
		type ClientCertificateStatus
	} from '$lib/platform/clientCertificate';
	import {
		getConfiguredServerOrigin,
		normalizeServerOrigin,
		saveConfiguredServerOrigin
	} from '$lib/platform/serverConfig';
	import { isNativeDebugBuild } from '$lib/platform/runtime';

	type Action = 'connect' | 'certificate' | 'remove-certificate';

	let {
		required = false,
		onConnected,
		onClose
	}: {
		required?: boolean;
		onConnected: (origin: string) => void;
		onClose?: () => void;
	} = $props();

	let serverUrl = $state('');
	let certificate = $state<ClientCertificateStatus>({ configured: false, available: false });
	let action = $state<Action | null>(null);
	let error = $state('');
	let committed = false;
	const allowDebugHttp = isNativeDebugBuild();
	const certificateUrl = $derived(serverUrl.trim().toLowerCase().startsWith('https://'));

	onMount(async () => {
		serverUrl = getConfiguredServerOrigin() ?? '';
		await refreshCertificate(serverUrl);
	});

	onDestroy(() => {
		if (!committed) {
			void rollbackClientCertificateConfiguration();
		}
	});

	$effect(() => {
		const currentUrl = serverUrl;
		void refreshCertificate(currentUrl);
	});

	async function refreshCertificate(targetUrl?: string) {
		try {
			let validOrigin: string | undefined;
			if (targetUrl) {
				try {
					validOrigin = normalizeServerOrigin(targetUrl);
				} catch {
					// Incomplete URL while typing, ignore
				}
			}
			certificate = await getClientCertificateStatus(validOrigin);
		} catch (cause) {
			console.warn('Could not read client certificate status.', cause);
		}
	}

	async function chooseCertificate() {
		if (action) return;
		error = '';

		let origin: string;
		try {
			origin = normalizeServerOrigin(serverUrl);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Enter a valid HTTPS server URL.';
			return;
		}

		action = 'certificate';
		try {
			const result = await selectInstalledClientCertificate(origin);
			if (result.selected) certificate = result;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not select the certificate.';
		} finally {
			action = null;
		}
	}

	async function removeCertificate() {
		if (action) return;
		action = 'remove-certificate';
		error = '';
		try {
			let origin: string | undefined;
			try {
				origin = normalizeServerOrigin(serverUrl);
			} catch {
				// Ignore
			}
			certificate = await stageRemoveClientCertificate(origin);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not remove the certificate.';
		} finally {
			action = null;
		}
	}

	function closeSettings() {
		if (!committed) {
			void rollbackClientCertificateConfiguration();
		}
		onClose?.();
	}

	async function connect() {
		if (action) return;
		action = 'connect';
		error = '';
		try {
			const { origin } = await saveConfiguredServerOrigin(serverUrl);
			committed = true;
			serverUrl = origin;
			onConnected(origin);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not connect to the server.';
		} finally {
			action = null;
		}
	}
</script>

<main class="native-settings">
	<picture class="native-settings-background" aria-hidden="true">
		<source srcset="/bg-large.avif" type="image/avif" media="(min-width: 1921px)" />
		<source srcset="/bg-large.webp" type="image/webp" media="(min-width: 1921px)" />
		<source srcset="/bg-desktop.avif" type="image/avif" />
		<img src="/bg-desktop.webp" alt="" />
	</picture>
	<div class="native-settings-shade" aria-hidden="true"></div>

	{#if !required && onClose}
		<button type="button" onclick={closeSettings} class="close-button" aria-label="Close settings">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 6l12 12M18 6 6 18" />
			</svg>
		</button>
	{/if}

	<section class="connection-panel">
		<h1>Skitgubbe</h1>

		<form
			onsubmit={(event) => {
				event.preventDefault();
				void connect();
			}}
		>
			<input
				id="native-server-url"
				type="url"
				bind:value={serverUrl}
				disabled={action !== null}
				placeholder={allowDebugHttp ? 'http://10.15.20.x:5173' : 'https://games.example.com'}
				inputmode="url"
				autocomplete="url"
				autocapitalize="none"
				spellcheck="false"
				aria-label="Server URL"
				required
			/>

			<details class="advanced-settings">
				<summary>
					<span>Advanced</span>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="m6 9 6 6 6-6" />
					</svg>
				</summary>

				<div class="certificate-settings">
					<div class="certificate-heading">
						<span>Client certificate <span class="muted">(mTLS)</span></span>
						<div class="certificate-status" aria-live="polite">
							{#if certificate.configured}
								<span>{certificate.alias ?? certificate.subject ?? 'Selected'}</span>
								{#if !certificate.available}
									<small class="invalid">Unavailable</small>
								{:else if certificate.validNow === false}
									<small class="invalid">Not currently valid</small>
								{/if}
							{/if}
						</div>
					</div>

					<div class="certificate-actions">
						<button
							type="button"
							disabled={action !== null || !certificateUrl}
							onclick={() => void chooseCertificate()}
							class="gold-trimmed-btn"
						>
							{action === 'certificate'
								? 'Choosing…'
								: certificate.configured
									? 'Change'
									: 'Choose'}
						</button>
						{#if certificate.configured}
							<button
								type="button"
								disabled={action !== null}
								onclick={() => void removeCertificate()}
								class="remove-certificate"
							>
								{action === 'remove-certificate' ? 'Removing…' : 'Remove'}
							</button>
						{/if}
					</div>
				</div>
			</details>

			{#if error}
				<p class="error-message" role="alert">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={action !== null || !serverUrl.trim()}
				class="premium-modal-btn premium-modal-btn-primary connect-button"
			>
				<span class="premium-modal-btn-content">
					{action === 'connect' ? 'Connecting…' : 'Connect'}
				</span>
			</button>
		</form>
	</section>
</main>

<style>
	.native-settings {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: grid;
		place-items: center;
		overflow-y: auto;
		padding: max(2rem, var(--safe-area-inset-top)) max(1.5rem, var(--safe-area-inset-right))
			max(2rem, var(--safe-area-inset-bottom)) max(1.5rem, var(--safe-area-inset-left));
		font-family: 'Cormorant Garamond', Georgia, serif;
		color: #f8fafc;
	}

	.native-settings-background,
	.native-settings-shade {
		position: fixed;
		inset: 0;
	}

	.native-settings-background img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.native-settings-shade {
		background:
			radial-gradient(circle at center, rgba(15, 10, 6, 0.42), rgba(10, 7, 5, 0.82)),
			linear-gradient(rgba(24, 14, 8, 0.16), rgba(9, 6, 4, 0.5));
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
	}

	.connection-panel {
		position: relative;
		z-index: 1;
		width: min(100%, 28rem);
	}

	h1 {
		margin: 0 0 2.25rem;
		background: linear-gradient(90deg, #fbbf24, #fef3c7, #f59e0b);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		font-family: 'Nanum Brush Script', cursive;
		font-size: clamp(4rem, 18vw, 5.25rem);
		font-weight: 400;
		line-height: 0.8;
		text-align: center;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.7));
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid rgba(227, 186, 90, 0.42);
		border-radius: 0;
		background: rgba(15, 12, 9, 0.78);
		padding: 0.9rem 1rem;
		box-shadow:
			inset 0 0 12px rgba(0, 0, 0, 0.5),
			0 4px 18px rgba(0, 0, 0, 0.22);
		color: #fff;
		font-family: 'Inter', sans-serif;
		font-size: 1rem;
		outline: none;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	input::placeholder {
		color: rgba(226, 232, 240, 0.42);
	}

	input:focus {
		border-color: #e3ba5a;
		box-shadow:
			inset 0 0 12px rgba(0, 0, 0, 0.55),
			0 0 0 1px rgba(227, 186, 90, 0.26),
			0 4px 18px rgba(0, 0, 0, 0.3);
	}

	input:disabled {
		opacity: 0.55;
	}

	.advanced-settings {
		border-top: 1px solid rgba(227, 186, 90, 0.22);
		padding-top: 1rem;
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		list-style: none;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.82);
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.05em;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary svg {
		width: 1rem;
		height: 1rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
		transition: transform 0.2s ease;
	}

	.advanced-settings[open] summary svg {
		transform: rotate(180deg);
	}

	.certificate-settings {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1.25rem;
	}

	.certificate-heading {
		min-width: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.muted {
		color: rgba(255, 255, 255, 0.48);
		font-weight: 400;
	}

	.certificate-status {
		display: flex;
		min-height: 1.25rem;
		flex-direction: column;
		margin-top: 0.25rem;
		color: rgba(255, 255, 255, 0.6);
		font-family: 'Inter', sans-serif;
		font-size: 0.75rem;
		font-weight: 400;
		word-break: break-all;
	}

	.invalid {
		color: #fca5a5;
		font-size: inherit;
	}

	.certificate-actions {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.75rem;
	}

	.certificate-actions .gold-trimmed-btn {
		min-width: 5rem;
		padding: 0.5rem 0.85rem;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.remove-certificate {
		border: 0;
		background: transparent;
		padding: 0.5rem 0;
		cursor: pointer;
		color: #fca5a5;
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.remove-certificate:hover:not(:disabled) {
		color: #fecaca;
	}

	.remove-certificate:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.error-message {
		margin: -0.25rem 0 0;
		color: #fecaca;
		font-family: 'Inter', sans-serif;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.connect-button {
		width: 100%;
		margin-top: 0.25rem;
		font-size: 1rem;
	}

	.close-button {
		position: fixed;
		top: max(1rem, var(--safe-area-inset-top));
		right: max(1rem, var(--safe-area-inset-right));
		z-index: 2;
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 0;
		background: transparent;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.62);
	}

	.close-button:hover {
		color: #ffe89e;
	}

	.close-button svg {
		width: 1.5rem;
		height: 1.5rem;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-width: 1.75;
	}

	@media (max-width: 420px) {
		.certificate-settings {
			align-items: stretch;
			flex-direction: column;
		}

		.certificate-actions {
			justify-content: flex-start;
		}
	}
</style>
