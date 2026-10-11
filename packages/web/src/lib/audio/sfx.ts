// Sound effects: plays the sounds promoted from tools/sfx into static/sfx/.
//
// Everything is lazy and guarded, so importing this from SSR code or from the
// state classes' tests is safe: nothing touches the DOM or audio until called,
// and without an unlocked AudioContext every call is a silent no-op.

export const SOUND_IDS = [
	'card_play',
	'card_draw',
	'card_select',
	'card_drag',
	'chance',
	'trick_take',
	'burn',
	'your_turn',
	'phase2_start',
	'escape_you',
	'escape_other',
	'skitgubbe_sting',
	'skitgubbe_slam',
	'chat_pop',
	'invalid',
	'notice_board',
	'ui_button'
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export interface PlayOptions {
	/** Seconds from now. */
	delay?: number;
	/** Level relative to the file, in dB. */
	gainDb?: number;
	/** Playback rate, i.e. pitch: 1 is as recorded. */
	rate?: number;
}

interface SoundEntry {
	file: string;
	vary: boolean;
	loop: boolean;
}

// How the drag sound follows the pointer. Mirrors DRAG in tools/sfx/staging.html,
// where this mapping was approved on the drag pad; keep the two in sync.
export const DRAG = {
	fullSpeed: 1.2, // px per ms that reaches full level
	curve: 0.8, // level = (speed / fullSpeed) ^ curve
	attack: 0.03, // s, time constant when speeding up
	release: 0.09, // s, when slowing down
	idleMs: 70, // no pointer movement for this long counts as holding still
	cutoffLo: 1200, // Hz low-pass at a crawl...
	cutoffHi: 9000 // ...and at full speed
};

/** Drag loop level (0..1) for a pointer speed in px/ms. */
export function dragLevel(speed: number): number {
	return Math.min(1, Math.max(0, speed) / DRAG.fullSpeed) ** DRAG.curve;
}

// Frequent sounds (vary: true in the manifest) never repeat exactly.
const VARY = { rate: 0.04, gainDb: 1.5 };
const MUTED_KEY = 'skitgubbe_sound_muted';

/** A playing card-drag loop whose level follows the pointer's speed. */
export class DragLoop {
	private level = 0;
	private speed = 0;
	private last: { x: number; y: number; t: number } | null = null;
	private idle: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private ctx: AudioContext,
		private src: AudioBufferSourceNode,
		private tone: BiquadFilterNode,
		private gain: GainNode
	) {}

	/** Feed a pointer position (px) and its timestamp (ms). */
	move(x: number, y: number, now: number) {
		if (this.last) {
			const dist = Math.hypot(x - this.last.x, y - this.last.y);
			this.speed = 0.5 * this.speed + (0.5 * dist) / Math.max(1, now - this.last.t);
			this.setLevel(dragLevel(this.speed));
		}
		this.last = { x, y, t: now };
		clearTimeout(this.idle);
		this.idle = setTimeout(() => {
			this.speed = 0;
			this.setLevel(0);
		}, DRAG.idleMs);
	}

	stop() {
		clearTimeout(this.idle);
		const now = this.ctx.currentTime;
		this.gain.gain.setTargetAtTime(0, now, 0.03);
		try {
			this.src.stop(now + 0.25);
		} catch {
			// already stopped
		}
	}

	private setLevel(level: number) {
		const now = this.ctx.currentTime;
		const rising = level > this.level;
		this.gain.gain.setTargetAtTime(level, now, rising ? DRAG.attack : DRAG.release);
		this.tone.frequency.setTargetAtTime(
			DRAG.cutoffLo + level * (DRAG.cutoffHi - DRAG.cutoffLo),
			now,
			0.05
		);
		this.src.playbackRate.setTargetAtTime(0.94 + 0.12 * level, now, 0.05);
		this.level = level;
	}
}

class SoundBoard {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private buffers = new Map<SoundId, AudioBuffer>();
	private entries = new Map<SoundId, SoundEntry>();
	private loading: Promise<void> | null = null;
	private mutedValue: boolean | null = null;

	get muted(): boolean {
		if (this.mutedValue === null) {
			try {
				this.mutedValue = localStorage.getItem(MUTED_KEY) === 'true';
			} catch {
				this.mutedValue = false;
			}
		}
		return this.mutedValue;
	}

	setMuted(muted: boolean) {
		this.mutedValue = muted;
		try {
			localStorage.setItem(MUTED_KEY, String(muted));
		} catch {
			// private mode: the setting just won't persist
		}
		if (this.ctx && this.master) {
			this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
		}
	}

	/** Fetch and decode every sound once. Needs no user gesture, so call it early. */
	preload(): Promise<void> {
		if (this.loading) return this.loading;
		if (typeof window === 'undefined' || typeof OfflineAudioContext === 'undefined') {
			return Promise.resolve();
		}
		this.loading = (async () => {
			try {
				const res = await fetch('/sfx/manifest.json');
				if (!res.ok) return;
				const { sounds } = (await res.json()) as { sounds: Record<string, SoundEntry> };
				// Decode offline: a live AudioContext may only start after a user gesture.
				const decoder = new OfflineAudioContext(1, 1, 44100);
				await Promise.all(
					Object.entries(sounds).map(async ([id, entry]) => {
						try {
							const file = await fetch(`/sfx/${entry.file}`);
							if (!file.ok) return;
							const buffer = await decoder.decodeAudioData(await file.arrayBuffer());
							this.buffers.set(id as SoundId, buffer);
							this.entries.set(id as SoundId, entry);
						} catch (error) {
							console.warn(`Could not load sound ${id}:`, error);
						}
					})
				);
			} catch (error) {
				console.warn('Could not load sounds:', error);
			}
		})();
		return this.loading;
	}

	/** Browsers only let audio start from a user gesture: call this from one. */
	unlock() {
		if (typeof AudioContext === 'undefined') return;
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createGain();
			this.master.gain.value = this.muted ? 0 : 1;
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === 'suspended') void this.ctx.resume();
	}

	/**
	 * Play a sound. Returns a function that stops it (for sounds scheduled ahead),
	 * or null when nothing plays: muted, not unlocked yet, hidden tab or not loaded.
	 */
	play(id: SoundId, { delay = 0, gainDb = 0, rate = 1 }: PlayOptions = {}): (() => void) | null {
		const out = this.output(id);
		if (!out) return null;
		if (this.entries.get(id)?.vary) {
			rate *= 1 + (Math.random() * 2 - 1) * VARY.rate;
			gainDb += (Math.random() * 2 - 1) * VARY.gainDb;
		}
		const src = out.ctx.createBufferSource();
		const gain = out.ctx.createGain();
		src.buffer = out.buffer;
		src.playbackRate.value = rate;
		gain.gain.value = 10 ** (gainDb / 20);
		src.connect(gain).connect(out.master);
		src.start(out.ctx.currentTime + Math.max(0, delay));
		return () => {
			try {
				src.stop();
			} catch {
				// already finished
			}
		};
	}

	/** Start the speed-following loop for a card drag. */
	startDragLoop(): DragLoop | null {
		const out = this.output('card_drag');
		if (!out) return null;
		const src = out.ctx.createBufferSource();
		const tone = out.ctx.createBiquadFilter();
		const gain = out.ctx.createGain();
		src.buffer = out.buffer;
		src.loop = true;
		tone.type = 'lowpass';
		tone.frequency.value = DRAG.cutoffLo;
		gain.gain.value = 0;
		src.connect(tone).connect(gain).connect(out.master);
		src.start(0, Math.random() * out.buffer.duration);
		return new DragLoop(out.ctx, src, tone, gain);
	}

	private output(id: SoundId) {
		const { ctx, master } = this;
		if (this.muted || !ctx || !master || ctx.state !== 'running') return null;
		if (typeof document !== 'undefined' && document.hidden) return null;
		const buffer = this.buffers.get(id);
		return buffer ? { ctx, master, buffer } : null;
	}
}

export const sfx = new SoundBoard();

/**
 * Load the sounds, unlock audio on the first gesture, and give buttons their click
 * (buttons whose action has its own sound opt out with data-sfx="off").
 * Returns a cleanup function.
 */
export function installSoundListeners(): () => void {
	const unlock = () => sfx.unlock();
	const click = (event: MouseEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest('button, a.gold-trimmed-btn');
		if (!button || button.closest('[data-sfx="off"]')) return;
		sfx.play('ui_button');
	};
	window.addEventListener('pointerdown', unlock, true);
	window.addEventListener('keydown', unlock, true);
	document.addEventListener('click', click, true);
	void sfx.preload();
	return () => {
		window.removeEventListener('pointerdown', unlock, true);
		window.removeEventListener('keydown', unlock, true);
		document.removeEventListener('click', click, true);
	};
}
