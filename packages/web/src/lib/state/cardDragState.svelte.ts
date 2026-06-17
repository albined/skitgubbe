import { getValueNumeric, type Card } from 'shared';
import type { RoomState } from './roomState.svelte';

export class CardDragState {
	roomState: RoomState;

	dragStartPos = $state<{ x: number; y: number } | null>(null);
	dragOffset = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	activeDraggedCardId = $state<string | null>(null);
	cardsBeingDragged = $state<string[]>([]);
	isDragging = $state<boolean>(false);
	preventNextClick = $state<boolean>(false);
	pendingPlayOffsets = $state<Record<string, { x: number; y: number }>>({});
	lastReleasedRunCardIds = $state<string[]>([]);
	isDraggingRunDefault = $state<boolean>(false);

	lastClickedCardId = $state<string | null>(null);
	lastClickTime = 0;

	constructor(roomState: RoomState) {
		this.roomState = roomState;
	}

	get isDragValid() {
		return (
			this.isDragging &&
			this.roomState.checkDropValidity(
				this.roomState.humanHand.filter((c) => this.cardsBeingDragged.includes(c.id))
			) !== null
		);
	}

	getRunForCard(card: Card, hand: Card[]): Card[] {
		const suit = card.suitName;
		const sameSuit = hand.filter((c) => c.suitName === suit);
		const sorted = [...sameSuit].sort((a, b) => getValueNumeric(a) - getValueNumeric(b));
		const idx = sorted.findIndex((c) => c.id === card.id);
		if (idx === -1) return [card];

		// Expand left
		let leftIdx = idx;
		while (
			leftIdx > 0 &&
			getValueNumeric(sorted[leftIdx]) === getValueNumeric(sorted[leftIdx - 1]) + 1
		) {
			leftIdx--;
		}

		// Expand right
		let rightIdx = idx;
		while (
			rightIdx < sorted.length - 1 &&
			getValueNumeric(sorted[rightIdx + 1]) === getValueNumeric(sorted[rightIdx]) + 1
		) {
			rightIdx++;
		}

		return sorted.slice(leftIdx, rightIdx + 1);
	}

	handleCardPointerDown(e: PointerEvent, cardId: string, idx: number) {
		if (e.button !== 0) return; // Only primary button (left click)
		if (!this.roomState.gameState || this.roomState.gameState.status !== 'playing') return;

		this.dragStartPos = { x: e.clientX, y: e.clientY };
		this.dragOffset = { x: 0, y: 0 };
		this.activeDraggedCardId = cardId;
		this.isDragging = false;

		const card = this.roomState.humanHand.find((c) => c.id === cardId);
		let useRun = false;
		let runCards: Card[] = [];
		if (
			this.roomState.gameState &&
			this.roomState.gameState.phase === 2 &&
			card &&
			card.suitName !== this.roomState.trumpSuit
		) {
			runCards = this.getRunForCard(card, this.roomState.humanHand);
			if (runCards.length >= 2) {
				const wasJustReleased = this.lastReleasedRunCardIds.includes(cardId);
				const hasSelectedInRun = runCards.some((rc) =>
					this.roomState.selectedCardIds.includes(rc.id)
				);
				if (!wasJustReleased && !hasSelectedInRun) {
					useRun = true;
				}
			}
		}

		if (useRun) {
			this.cardsBeingDragged = runCards.map((c) => c.id);
			this.isDraggingRunDefault = true;
		} else {
			this.isDraggingRunDefault = false;
			this.lastReleasedRunCardIds = [];
			if (this.roomState.selectedCardIds.includes(cardId)) {
				this.cardsBeingDragged = [...this.roomState.selectedCardIds];
			} else {
				this.cardsBeingDragged = [cardId];
			}
		}
	}

	handlePointerMove(e: PointerEvent) {
		if (!this.activeDraggedCardId || !this.dragStartPos) return;

		const dx = e.clientX - this.dragStartPos.x;
		const dy = e.clientY - this.dragStartPos.y;

		if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > 8) {
			// Dragging started!
			if (this.isDraggingRunDefault) {
				this.roomState.selectedCardIds = [...this.cardsBeingDragged];
			} else {
				if (!this.roomState.selectedCardIds.includes(this.activeDraggedCardId)) {
					const card = this.roomState.humanHand.find((c) => c.id === this.activeDraggedCardId);
					if (card && this.roomState.isPlayableGroup([card])) {
						// Card is playable! Select it and deselect others
						this.roomState.selectedCardIds = [this.activeDraggedCardId];
						this.cardsBeingDragged = [this.activeDraggedCardId];
					} else {
						// Card is not playable (or not our turn), but we still allow dragging it.
						// We do not select it so we don't mess up any selected state, but we allow moving it around.
						this.cardsBeingDragged = [this.activeDraggedCardId];
					}
				}
			}
			this.isDragging = true;
			this.roomState.hoveredCardId = null; // Clear hover state while dragging
		}

		if (this.isDragging) {
			this.dragOffset = { x: dx, y: dy };
		}
	}

	handlePointerUp(e: PointerEvent) {
		if (!this.activeDraggedCardId) return;

		// Record run released info BEFORE resetting state
		const card = this.roomState.humanHand.find((c) => c.id === this.activeDraggedCardId);
		if (
			this.roomState.gameState &&
			this.roomState.gameState.phase === 2 &&
			card &&
			card.suitName !== this.roomState.trumpSuit
		) {
			const run = this.getRunForCard(card, this.roomState.humanHand);
			if (run.length >= 2) {
				this.lastReleasedRunCardIds = run.map((c) => c.id);
			} else {
				this.lastReleasedRunCardIds = [];
			}
		} else {
			this.lastReleasedRunCardIds = [];
		}

		if (this.isDragging) {
			this.preventNextClick = true;
			// Clear preventNextClick after a short delay in case the browser does not fire a click event
			setTimeout(() => {
				this.preventNextClick = false;
			}, 100);

			let played = false;
			const boardZone = document.querySelector('.board-game-zone');
			if (boardZone) {
				const rect = boardZone.getBoundingClientRect();
				const isOverTable =
					e.clientX >= rect.left &&
					e.clientX <= rect.right &&
					e.clientY >= rect.top &&
					e.clientY <= rect.bottom;

				if (isOverTable) {
					const cardsToPlay = this.roomState.humanHand.filter((c) =>
						this.cardsBeingDragged.includes(c.id)
					);
					const validity = this.roomState.checkDropValidity(cardsToPlay);

					if (validity) {
						if (this.roomState.isReplaying) {
							// Cancel play: do nothing, let the card snap back
						} else {
							// Capture current dragged positions before state is reset
							this.cardsBeingDragged.forEach((id) => {
								const el = document.querySelector(`.hand-card[data-card-id="${id}"]`);
								if (el) {
									this.roomState.droppedCardRects.set(id, el.getBoundingClientRect());
								}
								this.pendingPlayOffsets[id] = { ...this.dragOffset };
							});

							if (validity === 'sprinkle') {
								this.roomState.sendWsMessage({ type: 'sprinkle', cardIds: this.cardsBeingDragged });
								if (this.roomState.selectedCardIds.includes(this.activeDraggedCardId)) {
									this.roomState.selectedCardIds = [];
								}
								played = true;
							} else if (validity === 'play') {
								this.roomState.sendWsMessage({
									type: 'playCards',
									cardIds: this.cardsBeingDragged,
									debugForce: this.roomState.godMode || undefined
								});
								if (this.roomState.selectedCardIds.includes(this.activeDraggedCardId)) {
									this.roomState.selectedCardIds = [];
								}
								played = true;
							}
						}
					} else {
						if (this.roomState.isHumanTurn) {
							this.roomState.errorMessage = 'Invalid play';
							setTimeout(() => {
								if (this.roomState.errorMessage === 'Invalid play')
									this.roomState.errorMessage = '';
							}, 4000);
						}
					}
				}
			}

			if (!played) {
				const idx = this.roomState.humanHand.findIndex((c) => c.id === this.activeDraggedCardId);
				if (idx !== -1) {
					this.roomState.handleCardClick(idx, this.activeDraggedCardId);
				}
			}
		}

		// Reset state
		this.activeDraggedCardId = null;
		this.cardsBeingDragged = [];
		this.dragStartPos = null;
		this.dragOffset = { x: 0, y: 0 };
		this.isDragging = false;
		this.roomState.hoveredCardId = null;
	}

	handleCardElementClick(e: MouseEvent, idx: number, cardId: string) {
		if (this.preventNextClick) {
			this.preventNextClick = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}

		const now = Date.now();
		const isDoubleClick = this.lastClickedCardId === cardId && now - this.lastClickTime < 300;
		this.lastClickedCardId = cardId;
		this.lastClickTime = now;

		if (isDoubleClick) {
			const card = this.roomState.humanHand.find((c) => c.id === cardId);
			if (card) {
				const otherSelected = this.roomState.humanHand.filter(
					(c) => this.roomState.selectedCardIds.includes(c.id) && c.id !== cardId
				);
				const cardsToPlay = [card, ...otherSelected];
				const validity = this.roomState.checkDropValidity(cardsToPlay);

				if (validity) {
					if (this.roomState.isReplaying) return;
					const playIds = cardsToPlay.map((c) => c.id);
					this.roomState.addAnimatingCardIds(playIds);
					this.roomState.sendWsMessage({
						type: validity === 'sprinkle' ? 'sprinkle' : 'playCards',
						cardIds: playIds,
						debugForce: this.roomState.godMode || undefined
					});
					this.roomState.selectedCardIds = [];
					return;
				}

				const singleValidity = this.roomState.checkDropValidity([card]);
				if (singleValidity) {
					if (this.roomState.isReplaying) return;
					this.roomState.addAnimatingCardIds([cardId]);
					this.roomState.sendWsMessage({
						type: singleValidity === 'sprinkle' ? 'sprinkle' : 'playCards',
						cardIds: [cardId],
						debugForce: this.roomState.godMode || undefined
					});
					this.roomState.selectedCardIds = this.roomState.selectedCardIds.filter(
						(id) => id !== cardId
					);
					return;
				}
			}
			this.roomState.handleCardClick(idx, cardId);
		} else {
			this.roomState.handleCardClick(idx, cardId);
		}
	}
}
