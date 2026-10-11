import { sfx } from './sfx';

/** The sound on/off switch, reactive for the UI; the sound board persists it. */
class SoundSettings {
	muted = $state(false);

	constructor() {
		if (typeof window !== 'undefined') this.muted = sfx.muted;
	}

	toggle() {
		this.muted = !this.muted;
		sfx.setMuted(this.muted);
	}
}

export const soundSettings = new SoundSettings();
