import { cubicOut, cubicInOut } from 'svelte/easing';
import { isMasked, type SanitizedGameState, type Card } from 'shared';
import type { RoomState } from './roomState.svelte';

/**
 * FLIP / card-fly animation state and Svelte transitions for the game room.
 * Owns the coordinate bookkeeping (captured DOMRects, reconnect/new-card
 * tracking) that lets cards fly between hands, the table, the deck and
 * player badges across state updates.
 */
export class CardTransitions {
	room: RoomState;

	// FLIP transition coordinate mapping
	cardRects = new Map<string, DOMRect>();
	droppedCardRects = new Map<string, DOMRect>();
	capturedTrickWinnerId: string | null = null;
	capturedActivePlayerId: string | null = null;

	animatingPlayCardIds = $state<string[]>([]);

	// Hand card animation sequencing
	newCardRelativeIndices = $state<Map<string, number>>(new Map());
	reconnectCardIds = new Set<string>();
	wasPlayingOnConnect = false;

	constructor(room: RoomState) {
		this.room = room;
	}

	/**
	 * Called with an incoming state BEFORE it is assigned to room.gameState:
	 * tracks reconnect-time cards, computes deal-in stagger indices for newly
	 * drawn cards, and snapshots current card positions for FLIP.
	 */
	onStateReceived(next: SanitizedGameState, activeId: string) {
		if (this.room.gameState === null && next.status === 'playing') {
			this.wasPlayingOnConnect = true;
		}

		if (this.wasPlayingOnConnect && this.reconnectCardIds.size === 0) {
			const localPlayer = next.players.find((p) => p.id === activeId);
			if (localPlayer && !localPlayer.hand.some(isMasked)) {
				localPlayer.hand.forEach((c) => this.reconnectCardIds.add(c.id));
			}
		}

		if (next.status === 'playing') {
			const localPlayer = next.players.find((p) => p.id === activeId);
			if (localPlayer) {
				const currentIds = localPlayer.hand.map((c) => c.id);
				const currentHand = this.room.gameState?.players.find((p) => p.id === activeId)?.hand || [];
				const existingIds = currentHand.map((c) => c.id);
				const newIds = currentIds.filter((id) => !existingIds.includes(id));

				if (newIds.length > 0) {
					const newIndices = new Map<string, number>();
					newIds.forEach((id, idx) => {
						newIndices.set(id, idx);
					});
					this.newCardRelativeIndices = newIndices;
				} else {
					this.newCardRelativeIndices = new Map();
				}
			}
		}

		this.captureCardRects();
	}

	/** Seeds reconnect-card tracking from the first replay state. */
	seedReconnectCards(initialState: SanitizedGameState, activeId: string) {
		this.reconnectCardIds.clear();
		const localPlayer = initialState.players.find((p) => p.id === activeId);
		if (localPlayer) {
			localPlayer.hand.forEach((c) => this.reconnectCardIds.add(c.id));
		}
	}

	addAnimatingCardIds(ids: string[]) {
		this.animatingPlayCardIds = [...this.animatingPlayCardIds, ...ids];
		this.room.trackTimeout(() => {
			this.animatingPlayCardIds = this.animatingPlayCardIds.filter((id) => !ids.includes(id));
		}, 1200);
	}

	captureCardRects() {
		this.cardRects.clear();
		this.capturedTrickWinnerId = this.room.gameState?.trickWinnerId || null;
		this.capturedActivePlayerId = this.room.gameState
			? this.room.gameState.players[this.room.gameState.activePlayerIdx]?.id || null
			: null;
		const cardEls = document.querySelectorAll('[data-card-id]');
		cardEls.forEach((el) => {
			const cardId = el.getAttribute('data-card-id');
			if (cardId) {
				const hasFlyUp = el.classList.contains('playing-fly-up');
				if (hasFlyUp) {
					el.classList.remove('playing-fly-up');
					this.cardRects.set(cardId, el.getBoundingClientRect());
					el.classList.add('playing-fly-up');
				} else {
					this.cardRects.set(cardId, el.getBoundingClientRect());
				}
			}
		});

		this.droppedCardRects.forEach((rect, id) => {
			this.cardRects.set(id, rect);
		});
		this.droppedCardRects.clear();
	}

	// Svelte transition functions (using arrow functions to preserve lexical this context)
	cardOut = (node: HTMLElement, params: { id: string }) => {
		const gameState = this.room.gameState;
		if (gameState) {
			const isInAnyHand = gameState.players.some((p) => p.hand.some((c) => c.id === params.id));
			const isOnTable = gameState.tablePile.some((batch) => batch.some((c) => c.id === params.id));
			if (
				isInAnyHand ||
				(isOnTable && (this.room.endGameStage === 'none' || this.room.endGameStage === 'paused'))
			) {
				return {
					duration: 50,
					css: (t: number) => `opacity: 0;`
				};
			}
		}

		const isTrickWon = !!this.capturedTrickWinnerId;
		const isPhase2 = gameState?.phase === 2;

		if (this.room.endGameStage !== 'none') {
			// Skip sliding
		} else if (isTrickWon && isPhase2) {
			// Skip sliding
		} else {
			const targetPlayerId =
				this.capturedTrickWinnerId || (isPhase2 ? this.capturedActivePlayerId : null);
			if (targetPlayerId) {
				const winnerEl = document.querySelector(`[data-player-id="${targetPlayerId}"]`);
				if (winnerEl) {
					const cardBadgeEl = winnerEl.querySelector('.player-card-badge');
					if (cardBadgeEl) {
						node.classList.add('transitioning');
						const rect = node.getBoundingClientRect();
						const targetRect = cardBadgeEl.getBoundingClientRect();
						const rectCenterX = rect.left + rect.width / 2;
						const rectCenterY = rect.top + rect.height / 2;

						const origRect = this.cardRects.get(params.id) || rect;
						const origCenterX = origRect.left + origRect.width / 2;
						const origCenterY = origRect.top + origRect.height / 2;

						const targetCenterX = targetRect.left + targetRect.width / 2;
						const targetCenterY = targetRect.top + targetRect.height / 2;

						const dw = targetRect.width / rect.width;
						const dh = targetRect.height / rect.height;

						return {
							duration: 300,
							easing: cubicOut,
							tick: (t: number) => {
								if (t === 0) {
									node.classList.remove('transitioning');
								}
							},
							css: (t: number) => {
								const currentDx = targetCenterX - rectCenterX + (origCenterX - targetCenterX) * t;
								const currentDy = targetCenterY - rectCenterY + (origCenterY - targetCenterY) * t;
								const currentScaleX = dw + (1 - dw) * t;
								const currentScaleY = dh + (1 - dh) * t;
								const rotateY = (1 - t) * 180;
								return `
									transition: none !important;
									transform: perspective(1000px) translate3d(${currentDx}px, ${currentDy}px, 0px) scale(${currentScaleX}, ${currentScaleY}) rotateY(${rotateY}deg);
									transform-origin: center center;
									z-index: 5;
								`;
							}
						};
					}
				}
			}
		}

		const discardEl =
			document.querySelector('[data-discard]') || document.querySelector('[data-deck]');
		const boardZone = document.querySelector('.board-game-zone');
		if (discardEl && boardZone) {
			node.classList.add('transitioning');
			const rect = node.getBoundingClientRect();
			const discardRect = discardEl.getBoundingClientRect();

			const boardRect = boardZone.getBoundingClientRect();
			const boardCenterX = boardRect.left + boardRect.width / 2;
			const boardCenterY = boardRect.top + boardRect.height / 2;
			const rectCenterX = rect.left + rect.width / 2;
			const rectCenterY = rect.top + rect.height / 2;

			const origRect = this.cardRects.get(params.id) || rect;
			const origCenterX = origRect.left + origRect.width / 2;
			const origCenterY = origRect.top + origRect.height / 2;

			const dxOrig = origCenterX - rectCenterX;
			const dyOrig = origCenterY - rectCenterY;

			const dxCenter = boardCenterX - rectCenterX;
			const dyCenter = boardCenterY - rectCenterY;

			const discardCenterX = discardRect.left + discardRect.width / 2;
			const discardCenterY = discardRect.top + discardRect.height / 2;
			const dxDiscard = discardCenterX - rectCenterX;
			const dyDiscard = discardCenterY - rectCenterY;

			const dw = discardRect.width / rect.width;
			const dh = discardRect.height / rect.height;

			return {
				duration: 600,
				tick: (t: number) => {
					if (t === 0) {
						node.classList.remove('transitioning');
					}
				},
				css: (t: number) => {
					let x = 0;
					let y = 0;
					let scaleX = 1;
					let scaleY = 1;
					let rotateY = 0;
					let rotate = 0;

					if (t >= 0.7) {
						const progress = (1 - t) / 0.3;
						const ease = cubicOut(progress);
						x = dxOrig + (dxCenter - dxOrig) * ease;
						y = dyOrig + (dyCenter - dyOrig) * ease;
					} else if (t >= 0.4) {
						const progress = (0.7 - t) / 0.3;
						const ease = cubicInOut(progress);
						x = dxCenter;
						y = dyCenter;
						rotateY = 180 * ease;
					} else {
						const progress = (0.4 - t) / 0.4;
						const ease = cubicOut(progress);
						x = dxCenter + (dxDiscard - dxCenter) * ease;
						y = dyCenter + (dyDiscard - dyCenter) * ease;
						scaleX = 1 + (dw - 1) * ease;
						scaleY = 1 + (dh - 1) * ease;
						rotateY = 180;
						rotate = -45 * ease;
					}

					return `
						transition: none !important;
						transform: perspective(1000px) translate3d(${x}px, ${y}px, 0px) scale(${scaleX}, ${scaleY}) rotate(${rotate}deg) rotateY(${rotateY}deg);
						transform-origin: center center;
						z-index: 9999;
					`;
				}
			};
		}

		return {
			duration: 50,
			css: (t: number) => `opacity: 0;`
		};
	};

	cardIn = (node: HTMLElement, params: { id: string; playerId?: string; card?: Card }) => {
		const gameState = this.room.gameState;
		const rect = node.getBoundingClientRect();
		let prevRect = this.cardRects.get(params.id);
		const cameFromHand = this.cardRects.has(params.id);

		const isLocalPlayer =
			params.playerId &&
			(params.playerId === this.room.playerId || params.playerId === this.room.yourPlayerId);
		const isChancePlay = isLocalPlayer
			? !cameFromHand && gameState?.phase === 1
			: !!(params.card && gameState?.lastChanceCardId === params.card.id);

		if (!prevRect && params.playerId) {
			const isTrumpCard = gameState?.trumpCard && params.id === gameState.trumpCard.id;
			const trumpEl = isTrumpCard ? document.querySelector('[data-trump]') : null;

			if (trumpEl) {
				prevRect = trumpEl.getBoundingClientRect();
			} else if (isChancePlay) {
				const deckEl = document.querySelector('[data-deck]');
				if (deckEl) {
					prevRect = deckEl.getBoundingClientRect();
				}
			} else {
				const playerEl = document.querySelector(`[data-player-id="${params.playerId}"]`);
				if (playerEl) {
					const cardBadgeEl = playerEl.querySelector('.player-card-badge');
					if (cardBadgeEl) {
						prevRect = cardBadgeEl.getBoundingClientRect();
					}
				}
			}
		}

		const isInitialReconnect = this.reconnectCardIds.has(params.id);
		if (!prevRect) {
			if (isInitialReconnect) {
				prevRect = rect;
			} else {
				const isTrumpCard = gameState?.trumpCard && params.id === gameState.trumpCard.id;
				const trumpEl = isTrumpCard ? document.querySelector('[data-trump]') : null;
				if (trumpEl) {
					prevRect = trumpEl.getBoundingClientRect();
				} else {
					const deckEl = document.querySelector('[data-deck]');
					if (deckEl) {
						prevRect = deckEl.getBoundingClientRect();
					}
				}
			}
		}

		if (prevRect) {
			node.classList.add('transitioning');
			const prevCenterX = prevRect.left + prevRect.width / 2;
			const prevCenterY = prevRect.top + prevRect.height / 2;
			const rectCenterX = rect.left + rect.width / 2;
			const rectCenterY = rect.top + rect.height / 2;

			const dx = prevCenterX - rectCenterX;
			const dy = prevCenterY - rectCenterY;
			const dw = prevRect.width / rect.width;
			const dh = prevRect.height / rect.height;

			const isDraw = (!cameFromHand && !params.playerId) || isChancePlay;
			const isHandCard = node.classList.contains('hand-card');
			const transformLayout = isHandCard ? 'translate(var(--x-pos), var(--lift))' : '';

			const relIndex = this.newCardRelativeIndices.get(params.id) ?? 0;
			return {
				delay: relIndex * 150,
				duration: isLocalPlayer ? 450 : 600,
				easing: cubicOut,
				tick: (t: number) => {
					if (t === 1) {
						node.classList.remove('transitioning');
					}
				},
				css: (t: number) => {
					const currentDx = dx * (1 - t);
					const currentDy = dy * (1 - t);
					const currentScaleX = dw + (1 - dw) * t;
					const currentScaleY = dh + (1 - dh) * t;

					let extraTransform = '';
					if (isDraw) {
						let rotateY = 180;
						if (t > 0.4) {
							const flipT = Math.min(1, (t - 0.4) / 0.4);
							rotateY = 180 - flipT * 180;
						}
						const rotate = isInitialReconnect ? 0 : (1 - t) * -35;
						extraTransform = `rotate(${rotate}deg) rotateY(${rotateY}deg)`;
					}

					return `
						transition: none !important;
						transform: perspective(1000px) translate3d(${currentDx}px, ${currentDy}px, 0px) ${transformLayout} scale(${currentScaleX}, ${currentScaleY}) ${extraTransform};
						transform-origin: center center;
						z-index: ${isHandCard ? 'var(--z-index)' : '9999'};
					`;
				}
			};
		}

		// Fallback fade
		return {
			duration: 150,
			css: (t: number) => `opacity: ${t};`
		};
	};
}
