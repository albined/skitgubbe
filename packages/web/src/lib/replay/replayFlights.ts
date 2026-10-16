import type { GameState } from 'shared';

/**
 * Card flights for the replay. Between two neighbouring frames, cards that
 * stay in the same place slide to their new slot, cards that change place fly
 * there on a copy drawn above everything, and cards that leave the table or
 * the shown hand fly to the player, the deck or the burned pile they went to.
 * The room's own CardTransitions works from live updates for one viewer, so
 * the replay measures before and after each step instead.
 */

const SHOWN_CARDS = '.board-game-zone [data-card-id], .replay-hand [data-card-id]';
const EASE = 'cubic-bezier(.25,.8,.25,1)';

type Box = { x: number; y: number; w: number; h: number };
type Zone = 'table' | 'hand';

interface Places {
	badges: Map<string, Box>;
	deck: Box | null;
	discard: Box | null;
	center: Box;
}

export interface FlightSnapshot extends Places {
	cards: Map<string, { box: Box; zone: Zone }>;
	leaving: Map<string, HTMLElement>;
}

function boxOf(el: Element | null): Box | null {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { x: r.left, y: r.top, w: r.width, h: r.height };
}

function zoneOf(el: Element): Zone {
	return el.closest('.replay-hand') ? 'hand' : 'table';
}

function places(): Places {
	const badges = new Map<string, Box>();
	document.querySelectorAll<HTMLElement>('[data-player-id]').forEach((el) => {
		const box = boxOf(el.querySelector('.player-card-badge'));
		if (box) badges.set(el.dataset.playerId!, box);
	});
	const board = boxOf(document.querySelector('.board-game-zone')) ?? {
		x: 0,
		y: 0,
		w: window.innerWidth,
		h: window.innerHeight
	};
	return {
		badges,
		deck: boxOf(document.querySelector('[data-deck]')),
		discard: boxOf(document.querySelector('[data-discard]')),
		center: { x: board.x + board.w / 2 - 20, y: board.y + board.h / 2 - 28, w: 40, h: 56 }
	};
}

// Where a card is in a frame when it isn't drawn on the table or in the shown hand.
function placeOf(state: GameState, cardId: string, at: Places): Box {
	const has = (cards: { id: string }[]) => cards.some((c) => c.id === cardId);
	const holder =
		state.players.find((p) => has(p.hand) || has(p.reserveStack))?.id ??
		(state.hiddenTrumpStorage?.card.id === cardId ? state.hiddenTrumpStorage.playerId : null);
	if (holder) return at.badges.get(holder) ?? at.center;
	if (has(state.discardPile)) return at.discard ?? at.center;
	if (has(state.deck)) return at.deck ?? at.center;
	return at.center;
}

export class ReplayFlights {
	// A fixed layer above the table, set by the replay page.
	layer: HTMLElement | null = null;
	private running = new Set<Animation>();

	/** Measures the shown cards before a step; `staying` are the cards the next frame still shows. */
	capture(staying: Set<string>): FlightSnapshot {
		this.settle();
		const cards = new Map<string, { box: Box; zone: Zone }>();
		const leaving = new Map<string, HTMLElement>();
		document.querySelectorAll<HTMLElement>(SHOWN_CARDS).forEach((el) => {
			const id = el.dataset.cardId!;
			cards.set(id, { box: boxOf(el)!, zone: zoneOf(el) });
			if (!staying.has(id)) leaving.set(id, el.cloneNode(true) as HTMLElement);
		});
		return { ...places(), cards, leaving };
	}

	/** Runs the flights once the next frame is on screen. */
	play(before: FlightSnapshot, from: GameState, to: GameState, duration: number) {
		if (!this.layer) return;
		const after = places();

		document.querySelectorAll<HTMLElement>(SHOWN_CARDS).forEach((el) => {
			const id = el.dataset.cardId!;
			const box = boxOf(el)!;
			const old = before.cards.get(id);
			if (old && old.zone === zoneOf(el)) {
				const dx = old.box.x - box.x;
				const dy = old.box.y - box.y;
				if (Math.abs(dx) + Math.abs(dy) > 0.5) {
					this.track(
						el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
							duration,
							easing: EASE
						})
					);
				}
				return;
			}
			const start = old?.box ?? placeOf(from, id, before);
			const copy = this.copy(el, box);
			el.style.visibility = 'hidden';
			this.track(
				copy.animate(
					[
						{ transform: toward(box, start), opacity: old ? 1 : 0.35 },
						{ transform: 'none', opacity: 1 }
					],
					{ duration, easing: EASE }
				),
				() => {
					copy.remove();
					el.style.visibility = '';
				}
			);
		});

		before.leaving.forEach((el, id) => {
			const start = before.cards.get(id)!.box;
			const copy = this.copy(el, start);
			this.track(
				copy.animate(
					[
						{ transform: 'none', opacity: 1 },
						{ transform: toward(start, placeOf(to, id, after)), opacity: 0.25 }
					],
					{ duration, easing: 'cubic-bezier(.4,0,.2,1)' }
				),
				() => copy.remove()
			);
		});
	}

	/** Jumps every running flight to its end. */
	settle() {
		for (const animation of [...this.running]) animation.finish();
	}

	private copy(el: HTMLElement, at: Box): HTMLElement {
		const copy = el.cloneNode(true) as HTMLElement;
		copy.removeAttribute('data-card-id');
		copy.style.cssText = `position: absolute; left: ${at.x}px; top: ${at.y}px; bottom: auto; width: ${at.w}px; height: ${at.h}px; min-width: 0; min-height: 0; margin: 0; transform-origin: 0 0; visibility: visible;`;
		this.layer!.appendChild(copy);
		return copy;
	}

	private track(animation: Animation, done?: () => void) {
		this.running.add(animation);
		const end = () => {
			this.running.delete(animation);
			done?.();
		};
		animation.onfinish = end;
		animation.oncancel = end;
	}
}

// The transform that draws a box placed at `at` over `target` instead.
function toward(at: Box, target: Box): string {
	return `translate(${target.x - at.x}px, ${target.y - at.y}px) scale(${target.w / at.w}, ${target.h / at.h})`;
}

/** The cards a frame draws face up: the table and the hand being looked at. */
export function shownCardIds(state: GameState, handOwnerId: string): Set<string> {
	const ids = new Set(state.tablePile.flat().map((c) => c.id));
	state.players.find((p) => p.id === handOwnerId)?.hand.forEach((c) => ids.add(c.id));
	return ids;
}
