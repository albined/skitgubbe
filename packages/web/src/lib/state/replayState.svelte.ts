import { tick } from 'svelte';
import { decodeReplayFrame, type ApiGameReplay, type ReplayPerson } from 'shared';
import { apiRequest } from '$lib/platform/api';
import { clockTime, shortDate } from '$lib/time';
import { ReplayFlights, shownCardIds } from '$lib/replay/replayFlights';

const SPEEDS = [1, 2, 4];

export class ReplayState {
	roomId: string;
	replay = $state<ApiGameReplay | null>(null);
	loadError = $state<'missing' | 'failed' | null>(null);

	pos = $state(0);
	handOwnerId = $state('');
	playing = $state(false);
	speed = $state(1);
	showLog = $state(false);

	innerWidth = $state(0);
	innerHeight = $state(0);
	reducedMotion =
		typeof window !== 'undefined' &&
		(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

	flights = new ReplayFlights();
	private timer: number | undefined;

	frames = $derived(this.replay?.frames ?? []);
	// The timeline starts once everyone is dealt in, just before the first card.
	first = $derived(
		Math.max(0, this.frames.findIndex((f) => f.move && 'PUCR'.includes(f.move.type)) - 1)
	);
	last = $derived(this.frames.length - 1);
	gameState = $derived(
		this.replay ? decodeReplayFrame(this.frames[this.pos], this.replay.players) : null
	);
	hand = $derived(this.gameState?.players.find((p) => p.id === this.handOwnerId)?.hand ?? []);
	trumpSuit = $derived(this.gameState?.trumpCard ? this.gameState.trumpCard.suitName : null);
	cardWidth = $derived(
		Math.max(52, Math.min(Math.min(this.innerHeight * 0.15, this.innerWidth * 0.14), 125))
	);

	// One log entry per move that wrote to the log; the first also holds the lines from the deal.
	logEntries = $derived(
		this.frames
			.slice(this.first)
			.map((f, i) => ({
				k: this.first + i,
				lines: i === 0 ? this.frames.slice(0, this.first + 1).flatMap((x) => x.log) : f.log
			}))
			.filter((entry) => entry.lines.length > 0)
	);
	// Where on the timeline each player got out.
	escapes = $derived(
		(this.replay?.players ?? []).flatMap((person: ReplayPerson) => {
			const k = this.frames.findIndex((f) => f.players.some((p) => p.id === person.id && p.isDone));
			return k > this.first ? [{ k, person }] : [];
		})
	);
	phaseTwoAt = $derived(this.frames.findIndex((f) => f.phase === 2));

	constructor(roomId: string) {
		this.roomId = roomId;
	}

	async load(): Promise<void> {
		try {
			const res = await apiRequest(`/api/games/${encodeURIComponent(this.roomId)}/replay`);
			if (res.status === 404 || res.status === 409) {
				this.loadError = 'missing';
				return;
			}
			if (!res.ok) {
				this.loadError = 'failed';
				return;
			}
			const replay: ApiGameReplay = await res.json();
			if (replay.frames.length === 0) {
				this.loadError = 'missing';
				return;
			}
			// Open on how the game ended, with the Skitgubbe's leftover cards in view.
			const end = replay.frames[replay.frames.length - 1].players;
			this.handOwnerId =
				end.find((p) => p.isSkitgubbe)?.id ??
				end.find((p) => p.id === replay.viewerId)?.id ??
				end[0]?.id ??
				'';
			this.pos = replay.frames.length - 1;
			this.replay = replay;
		} catch (e) {
			console.error('Failed to load replay:', e);
			this.loadError = 'failed';
		}
	}

	/** Moves to frame `k`; a single step can fly the cards, longer jumps just redraw. */
	async go(k: number, animate = false): Promise<void> {
		if (!this.replay) return;
		k = Math.max(this.first, Math.min(this.last, k));
		if (k === this.pos) return;
		if (!animate || this.reducedMotion || Math.abs(k - this.pos) !== 1) {
			this.flights.settle();
			this.pos = k;
			return;
		}
		const from = this.gameState!;
		const to = decodeReplayFrame(this.frames[k], this.replay.players);
		const snapshot = this.flights.capture(shownCardIds(to, this.handOwnerId));
		this.pos = k;
		await tick();
		this.flights.play(snapshot, from, to, Math.max(140, 430 / this.speed));
	}

	step(direction: 1 | -1) {
		this.stop();
		void this.go(this.pos + direction, true);
	}

	seek(k: number) {
		this.stop();
		void this.go(k, Math.abs(k - this.pos) === 1);
	}

	play() {
		if (!this.replay) return;
		if (this.pos >= this.last) void this.go(this.first);
		this.playing = true;
		this.schedule(350);
	}

	stop() {
		this.playing = false;
		clearTimeout(this.timer);
	}

	togglePlay() {
		if (this.playing) this.stop();
		else this.play();
	}

	cycleSpeed() {
		this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
	}

	showHand(playerId: string) {
		this.flights.settle();
		this.handOwnerId = playerId;
	}

	/** "16 okt 14:38" for when the move at frame `k` was made. */
	whenAt(k: number): string {
		const at = this.frames[k]?.move?.at ?? this.frames.find((f) => f.move)?.move?.at;
		return at ? `${shortDate(at)} ${clockTime(at)}` : '';
	}

	destroy() {
		this.stop();
		this.flights.settle();
	}

	private schedule(delay: number) {
		clearTimeout(this.timer);
		this.timer = window.setTimeout(() => this.advance(), delay / this.speed);
	}

	private advance() {
		if (!this.playing) return;
		void this.go(this.pos + 1, true);
		if (this.pos >= this.last) {
			this.stop();
			return;
		}
		// Clearing a finished trick is quick; a player's move gets a moment.
		this.schedule(this.frames[this.pos + 1].move?.type === 'T' ? 650 : 950);
	}
}
