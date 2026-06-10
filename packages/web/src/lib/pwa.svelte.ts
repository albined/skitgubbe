import { dev } from '$app/environment';

class PwaState {
	installPrompt = $state<any>(null);
	isInstalled = $state(false);

	init() {
		if (typeof window === 'undefined') return;

		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevent Chrome 67 and earlier from automatically showing the prompt
			e.preventDefault();
			// Stash the event so it can be triggered later.
			this.installPrompt = e;
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
