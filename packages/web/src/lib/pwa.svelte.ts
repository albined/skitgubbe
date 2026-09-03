import { dev } from '$app/environment';
import { isNativeApp } from '$lib/platform/runtime';

// Chrome's install-prompt event; not in lib.dom because it never left the
// incubator spec (https://wicg.github.io/manifest-incubations/).
interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

class PwaState {
	installPrompt = $state<BeforeInstallPromptEvent | null>(null);
	isInstalled = $state(false);

	init() {
		if (typeof window === 'undefined' || isNativeApp()) return;

		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevent Chrome 67 and earlier from automatically showing the prompt
			e.preventDefault();
			// Stash the event so it can be triggered later.
			this.installPrompt = e as BeforeInstallPromptEvent;
		});

		window.addEventListener('appinstalled', () => {
			// Clear the deferredPrompt so it can be garbage collected
			this.installPrompt = null;
			this.isInstalled = true;
			console.log('Skitgubbe has been installed successfully!');
		});
	}

	async install() {
		if (!this.installPrompt) return;

		// Show the prompt
		this.installPrompt.prompt();

		// Wait for the user to respond to the prompt
		const { outcome } = await this.installPrompt.userChoice;
		console.log(`User response to install prompt: ${outcome}`);

		if (outcome === 'accepted') {
			this.installPrompt = null;
		}
	}
}

export const pwa = new PwaState();
