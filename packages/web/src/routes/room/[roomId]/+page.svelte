<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut, cubicInOut } from 'svelte/easing';
	import { page } from '$app/stores';
	import { getValueNumeric, isValidPlay, type GameState, type Card } from 'shared';

	const roomId = $page.params.roomId;

	// WebSocket & Connection State
	let socket: WebSocket | null = null;
	let reconnectTimeout: number | undefined = undefined;
	let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let errorMessage = $state<string>('');

	// Client info & Local State
	let playerId = $state<string>('');
	let playerName = $state<string>('');
	let playerColor = $state<string>('');

	let tempName = $state<string>('');
	let tempColor = $state<string>('#3b82f6');
	let showJoinModal = $state<boolean>(false);
	let joinError = $state<string>('');

	const PRESET_COLORS = [
		'#3b82f6', // blue
		'#10b981', // emerald
		'#f59e0b', // amber
		'#ef4444', // red
		'#8b5cf6', // violet
		'#ec4899' // pink
	];

	// Synchronized Server State
	let gameState = $state<GameState | null>(null);
	let yourPlayerId = $state<string>('');

	// Client interaction states
	let selectedCardIds = $state<string[]>([]);
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let fanCenterIdx = $state(-1);
	let autoplay = $state(false);
	let showDebugMenu = $state(false);
	let showLogs = $state(false);

	// Drag and drop states
	let dragStartPos = $state<{ x: number; y: number } | null>(null);
	let dragOffset = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let activeDraggedCardId = $state<string | null>(null);
	let cardsBeingDragged = $state<string[]>([]);
	let isDragging = $state<boolean>(false);
	let preventNextClick = $state<boolean>(false);

	// Screen sizing & layout
	let containerWidth = $state(800);
	let innerHeight = $state(800);
	let innerWidth = $state(800);

	const cardWidth = $derived(
		Math.max(52, Math.min(Math.min(innerHeight * 0.15, innerWidth * 0.14), 125))
	);
	const maxHandWidth = $derived(Math.max(cardWidth, containerWidth - cardWidth));

	// Derived mappings from synchronized game state
	const localPlayer = $derived(gameState?.players.find((p) => p.id === playerId) || null);
	const isHost = $derived(localPlayer?.isHost || false);
	const humanHand = $derived(localPlayer ? localPlayer.hand : []);
	const selectedCards = $derived(humanHand.filter((c) => selectedCardIds.includes(c.id)));

	const isHumanTurn = $derived(
		gameState &&
			gameState.status === 'playing' &&
			gameState.players[gameState.activePlayerIdx]?.id === playerId &&
			!gameState.trickWinnerId &&
			localPlayer &&
			!localPlayer.isDone &&
			!localPlayer.isSkitgubbe
	);

	const trumpSuit = $derived(gameState?.trumpCard ? gameState.trumpCard.suitName : null);

	const isStroValid = $derived(
		gameState &&
			gameState.phase === 1 &&
			!gameState.trickWinnerId &&
			selectedCardIds.length > 0 &&
			(() => {
				const state = gameState;
				if (!state) return false;
				if (selectedCards.length === 0) return false;
				const firstVal = selectedCards[0].value;
				if (!selectedCards.every((c) => c.value === firstVal)) return false;
				return state.tablePilePlayers.some(
					(pId, idx) =>
						pId === playerId &&
						state.tablePile[idx].length > 0 &&
						state.tablePile[idx][0].value === firstVal
				);
			})()
	);

	const activeSpreadCardId = $derived(hoveredCardId ?? focusedCardId);
	const activeSpreadIdx = $derived(
		activeSpreadCardId ? humanHand.findIndex((c) => c.id === activeSpreadCardId) : -1
	);

	// Dynamic room URL
	const roomUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');
	let copyText = $state('Copy Link');

	function copyRoomUrl() {
		navigator.clipboard.writeText(roomUrl);
		copyText = 'Copied!';
		setTimeout(() => (copyText = 'Copy Link'), 2000);
	}

	function getWsUrl(): string {
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		if (window.location.hostname === 'localhost') {
			return `${proto}//localhost:3000/api/room/${roomId}/ws`;
		}
		return `${proto}//${window.location.host}/api/room/${roomId}/ws`;
	}

	function connectWebSocket() {
		if (!playerId || !playerName) return;
		if (
			socket &&
			(socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}
		connectionStatus = 'connecting';

		const wsUrl = getWsUrl();
		socket = new WebSocket(wsUrl);

		socket.onopen = () => {
			connectionStatus = 'connected';
			errorMessage = '';
			sendWsMessage({
				type: 'join',
				playerId,
				name: playerName,
				color: playerColor
			});
		};

		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'stateUpdate') {
					captureCardRects();
					gameState = data.state;
					yourPlayerId = data.yourPlayerId;
				} else if (data.type === 'error') {
					errorMessage = data.message;
					setTimeout(() => {
						if (errorMessage === data.message) errorMessage = '';
					}, 4000);
				}
			} catch (e) {
				console.error('Failed to parse WebSocket message:', e);
			}
		};

		socket.onclose = () => {
			connectionStatus = 'disconnected';
			// Auto-reconnect after 3 seconds
			reconnectTimeout = window.setTimeout(connectWebSocket, 3000);
		};

		socket.onerror = (e) => {
			console.error('WebSocket error:', e);
		};
	}

	function sendWsMessage(msg: any) {
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify(msg));
		}
	}

	onMount(() => {
		// Load or generate Player ID
		let savedId = sessionStorage.getItem('skitgubbe_playerId');
		if (!savedId) {
			savedId = Math.random().toString(36).substring(2, 15);
			sessionStorage.setItem('skitgubbe_playerId', savedId);
		}
		playerId = savedId;

		// Load name and color
		const savedName = localStorage.getItem('skitgubbe_playerName');
		const savedColor = localStorage.getItem('skitgubbe_playerColor');

		if (savedName) {
			playerName = savedName;
			playerColor = savedColor || PRESET_COLORS[0];
			connectWebSocket();
		} else {
			tempColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
			showJoinModal = true;
		}
	});

	onDestroy(() => {
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
		}
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
	});

	function handleJoinConfirm() {
		const name = tempName.trim();
		if (!name) {
			joinError = 'Please enter a name.';
			return;
		}
		playerName = name;
		playerColor = tempColor;

		localStorage.setItem('skitgubbe_playerName', name);
		localStorage.setItem('skitgubbe_playerColor', tempColor);

		showJoinModal = false;
		connectWebSocket();
	}

	// Clear local card selection if it's no longer the client's turn (only in Phase 2, as Phase 1 allows sprinkling out of turn),
	// or filter out cards that are no longer in our hand.
	$effect(() => {
		if (gameState) {
			const activePlayer = gameState.players[gameState.activePlayerIdx];
			if (gameState.phase === 2 && activePlayer && activePlayer.id !== playerId) {
				untrack(() => {
					if (selectedCardIds.length > 0) {
						selectedCardIds = [];
					}
				});
			} else if (localPlayer) {
				untrack(() => {
					const filtered = selectedCardIds.filter((id) =>
						localPlayer.hand.some((c) => c.id === id)
					);
					if (filtered.length !== selectedCardIds.length) {
						selectedCardIds = filtered;
					}
				});
			}
		}
	});

	function toggleSelect(cardId: string) {
		if (selectedCardIds.includes(cardId)) {
			selectedCardIds = selectedCardIds.filter((id) => id !== cardId);
		} else {
			const card = humanHand.find((c) => c.id === cardId);
			if (!card) return;

			const currentSelected = humanHand.filter((c) => selectedCardIds.includes(c.id));
			const proposedWithSelected = [...currentSelected, card];
			const proposedAlone = [card];

			if (isPlayableGroup(proposedWithSelected)) {
				selectedCardIds = [...selectedCardIds, cardId];
			} else if (isPlayableGroup(proposedAlone)) {
				selectedCardIds = [cardId];
			}
		}
	}

	function handleCardClick(idx: number, cardId: string) {
		const total = humanHand.length;
		if (total > 15) {
			if (fanCenterIdx === -1) {
				fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
			} else {
				const isFanned = Math.abs(idx - fanCenterIdx) <= 2;
				const isEdgemostHandCard = idx <= 1 || idx >= total - 2;

				if (isFanned) {
					const isFanEdge = idx === fanCenterIdx - 2 || idx === fanCenterIdx + 2;
					if (total >= 20 && isFanEdge && !isEdgemostHandCard) {
						fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
					} else {
						toggleSelect(cardId);
					}
				} else {
					fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
				}
			}
		} else {
			toggleSelect(cardId);
		}
	}

	function triggerAutoplay() {
		if (!isHumanTurn || !gameState) return;

		// Group hand by value
		const groups: Record<string, Card[]> = {};
		for (const card of humanHand) {
			if (!groups[card.value]) {
				groups[card.value] = [];
			}
			groups[card.value].push(card);
		}

		const validPlays: Card[][] = [];

		for (const value of Object.keys(groups)) {
			const cards = groups[value];
			const subsets: Card[][] = [[]];
			for (const card of cards) {
				const len = subsets.length;
				for (let i = 0; i < len; i++) {
					subsets.push([...subsets[i], card]);
				}
			}
			const nonEmptySubsets = subsets.slice(1);

			for (const subset of nonEmptySubsets) {
				if (
					isValidPlay(
						subset,
						humanHand,
						gameState.tablePile,
						gameState.phase,
						gameState.tieBreakerActive,
						gameState.tiedPlayerIds,
						playerId,
						trumpSuit
					)
				) {
					validPlays.push(subset);
				}
			}
		}

		if (validPlays.length > 0) {
			const randomPlay = validPlays[Math.floor(Math.random() * validPlays.length)];
			sendWsMessage({ type: 'playCards', cardIds: randomPlay.map((c) => c.id) });
			return;
		}

		if (gameState.phase === 1 && gameState.deck.length > 0) {
			sendWsMessage({ type: 'chance' });
			return;
		}

		if (gameState.phase === 2 && gameState.tablePile.length > 0) {
			sendWsMessage({ type: 'pickUp' });
			return;
		}
	}

	$effect(() => {
		if (autoplay && isHumanTurn && gameState) {
			const timer = setTimeout(() => {
				untrack(() => {
					if (autoplay && isHumanTurn && gameState) {
						triggerAutoplay();
					}
				});
			}, 1000);
			return () => clearTimeout(timer);
		}
	});

	function handleSprinkleClick() {
		if (!isStroValid) return;
		sendWsMessage({ type: 'sprinkle', cardIds: selectedCardIds });
	}

	function handleChanceClick() {
		if (gameState?.phase !== 1 || !isHumanTurn || gameState.deck.length === 0) return;
		sendWsMessage({ type: 'chance' });
	}

	function handlePickUpClick() {
		if (!isHumanTurn || gameState?.phase !== 2) return;
		sendWsMessage({ type: 'pickUp' });
	}

	function handleStartGameClick() {
		sendWsMessage({ type: 'startGame' });
	}

	function handleResetGameClick() {
		sendWsMessage({ type: 'resetGame' });
	}

	function checkDropValidity(cards: Card[]): 'play' | 'sprinkle' | null {
		const state = gameState;
		if (!state || cards.length === 0) return null;

		// 1. Check standard play first if it is my turn
		if (isHumanTurn) {
			if (
				isValidPlay(
					cards,
					humanHand,
					state.tablePile,
					state.phase,
					state.tieBreakerActive,
					state.tiedPlayerIds,
					playerId,
					trumpSuit
				)
			) {
				return 'play';
			}
		}

		// 2. Check sprinkle
		if (state.phase === 1 && !state.trickWinnerId) {
			const firstVal = cards[0].value;
			const allSameValue = cards.every((c) => c.value === firstVal);
			const playerHasMatchingOnTable = state.tablePilePlayers.some(
				(pId, idx) =>
					pId === playerId &&
					state.tablePile[idx].length > 0 &&
					state.tablePile[idx][0].value === firstVal
			);
			if (allSameValue && playerHasMatchingOnTable) {
				return 'sprinkle';
			}
		}

		return null;
	}

	const anyCardPlayable = $derived(
		gameState && humanHand.some((card) => checkDropValidity([card]) !== null)
	);

	function isPlayableGroup(cards: Card[]): boolean {
		const state = gameState;
		if (!state || cards.length === 0) return false;

		// 1. Check sprinkle first
		if (state.phase === 1 && !state.trickWinnerId) {
			const firstVal = cards[0].value;
			const allSameValue = cards.every((c) => c.value === firstVal);
			const playerHasMatchingOnTable = state.tablePilePlayers.some(
				(pId, idx) =>
					pId === playerId &&
					state.tablePile[idx].length > 0 &&
					state.tablePile[idx][0].value === firstVal
			);
			if (allSameValue && playerHasMatchingOnTable) {
				return true;
			}
		}

		// 2. Check standard play rules (if it's the player's turn)
		if (isHumanTurn) {
			if (
				isValidPlay(
					cards,
					humanHand,
					state.tablePile,
					state.phase,
					state.tieBreakerActive,
					state.tiedPlayerIds,
					playerId,
					trumpSuit
				)
			) {
				return true;
			}
		}

		return false;
	}

	const isDragValid = $derived(
		isDragging &&
			checkDropValidity(humanHand.filter((c) => cardsBeingDragged.includes(c.id))) !== null
	);

	function handleCardPointerDown(e: PointerEvent, cardId: string, idx: number) {
		if (e.button !== 0) return; // Only primary button (left click)
		if (!gameState || gameState.status !== 'playing') return;

		// Fan checking: if hand > 15, cards can only be dragged if they are inside fanned area
		if (humanHand.length > 15) {
			if (fanCenterIdx === -1 || Math.abs(idx - fanCenterIdx) > 2) {
				// Not fanned yet, so do not start drag.
				// A simple click will fan the region when handleCardElementClick executes.
				return;
			}
		}

		dragStartPos = { x: e.clientX, y: e.clientY };
		dragOffset = { x: 0, y: 0 };
		activeDraggedCardId = cardId;
		isDragging = false;

		if (selectedCardIds.includes(cardId)) {
			cardsBeingDragged = [...selectedCardIds];
		} else {
			cardsBeingDragged = [cardId];
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!activeDraggedCardId || !dragStartPos) return;

		const dx = e.clientX - dragStartPos.x;
		const dy = e.clientY - dragStartPos.y;

		if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 8) {
			// Dragging started!
			// Check if the card being dragged is selected
			if (!selectedCardIds.includes(activeDraggedCardId)) {
				const card = humanHand.find((c) => c.id === activeDraggedCardId);
				if (!card || !isPlayableGroup([card])) {
					// Card is not playable alone, cancel drag completely
					activeDraggedCardId = null;
					dragStartPos = null;
					return;
				}
				// Card is playable! Select it and deselect others
				selectedCardIds = [activeDraggedCardId];
				cardsBeingDragged = [activeDraggedCardId];
			}
			isDragging = true;
			hoveredCardId = null; // Clear hover state while dragging
		}

		if (isDragging) {
			dragOffset = { x: dx, y: dy };
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (!activeDraggedCardId) return;

		if (isDragging) {
			preventNextClick = true;

			const boardZone = document.querySelector('.board-game-zone');
			if (boardZone) {
				const rect = boardZone.getBoundingClientRect();
				const isOverTable =
					e.clientX >= rect.left &&
					e.clientX <= rect.right &&
					e.clientY >= rect.top &&
					e.clientY <= rect.bottom;

				if (isOverTable) {
					const cardsToPlay = humanHand.filter((c) => cardsBeingDragged.includes(c.id));
					const validity = checkDropValidity(cardsToPlay);

					if (validity === 'sprinkle') {
						sendWsMessage({ type: 'sprinkle', cardIds: cardsBeingDragged });
						if (selectedCardIds.includes(activeDraggedCardId)) {
							selectedCardIds = [];
						}
					} else if (validity === 'play') {
						sendWsMessage({ type: 'playCards', cardIds: cardsBeingDragged });
						if (selectedCardIds.includes(activeDraggedCardId)) {
							selectedCardIds = [];
						}
					} else {
						errorMessage = 'Invalid play';
						setTimeout(() => {
							if (errorMessage === 'Invalid play') errorMessage = '';
						}, 4000);
					}
				}
			}
		}

		// Reset state
		activeDraggedCardId = null;
		cardsBeingDragged = [];
		dragStartPos = null;
		dragOffset = { x: 0, y: 0 };
		isDragging = false;
		hoveredCardId = null;
	}

	function handleCardElementClick(e: MouseEvent, idx: number, cardId: string) {
		if (preventNextClick) {
			preventNextClick = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		handleCardClick(idx, cardId);
	}

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.card')) {
			focusedCardId = null;
			fanCenterIdx = -1;
		}
	}

	// Layout spacing algorithms
	function getCardX(index: number, total: number, activeIdx: number): number {
		if (total === 0) return 0;
		if (total === 1) return 0;

		const preferredSpacing = cardWidth * 0.64;

		if (total > 15 && fanCenterIdx !== -1) {
			const L = Math.max(0, fanCenterIdx - 2);
			const R = Math.min(total - 1, fanCenterIdx + 2);

			let N_wide = 0;
			for (let i = 0; i < total - 1; i++) {
				if (i >= L && i <= R) {
					N_wide++;
				}
			}
			const N_compressed = total - 1 - N_wide;

			const minCompressedSpacing = cardWidth * 0.1;
			const preferredFannedSpacing = cardWidth * 0.84;
			let actualWideSpacing = preferredFannedSpacing;
			let compressedSpacing = minCompressedSpacing;
			if (N_compressed > 0) {
				compressedSpacing = (maxHandWidth - N_wide * actualWideSpacing) / N_compressed;
				if (compressedSpacing < minCompressedSpacing) {
					compressedSpacing = minCompressedSpacing;
					actualWideSpacing = (maxHandWidth - N_compressed * minCompressedSpacing) / N_wide;
				}
			}

			let currentX = 0;
			const positions = [];
			for (let i = 0; i < total; i++) {
				positions.push(currentX);
				if (i < total - 1) {
					const isWideGap = i >= L && i <= R;
					currentX += isWideGap ? actualWideSpacing : compressedSpacing;
				}
			}
			const W = currentX;
			return positions[index] - W / 2;
		}

		const actualSpacing = Math.min(preferredSpacing, maxHandWidth / (total - 1));
		let x = (index - (total - 1) / 2) * actualSpacing;

		if (activeIdx !== -1 && activeIdx !== index) {
			const diff = index - activeIdx;
			const spreadAmount = Math.max(cardWidth * 0.3, cardWidth * 0.76 - actualSpacing);
			const decayFactor = 0.55;

			if (diff < 0) {
				x -= spreadAmount * Math.pow(decayFactor, Math.abs(diff) - 1);
			} else {
				x += spreadAmount * Math.pow(decayFactor, Math.abs(diff) - 1);
			}
		}

		return x;
	}

	function getCardStyle(
		cardId: string,
		index: number,
		isSelected: boolean,
		isHovered: boolean,
		xPosition: number
	): string {
		let lift = 0;
		if (isSelected) lift -= cardWidth * 0.28;
		if (isHovered) lift -= cardWidth * 0.2;

		const zIndex = isHovered ? 1000 : index;
		const scale = isHovered ? 1.08 : 1;

		return `
			--x-pos: ${xPosition}px;
			--lift: ${lift}px;
			--scale: ${scale};
			--z-index: ${zIndex};
		`;
	}

	function getDeckShadowStyle(count: number): string {
		const layers = Math.min(Math.ceil(count / 4), 10);
		if (layers === 0) return '';

		let shadow = '';
		for (let i = 1; i <= layers; i++) {
			shadow += `${i}px ${i}px 0px rgba(212, 175, 55, 0.4), `;
			shadow += `${i}px ${i}px 1px rgba(0,0,0,0.15), `;
		}
		shadow += `${layers + 2}px ${layers + 2}px 12px rgba(0,0,0,0.5)`;
		return `box-shadow: ${shadow}; transform: translate(${-layers / 2}px, ${-layers / 2}px);`;
	}

	function drawTransition(node: HTMLElement, { duration = 600, targetX = 0 }) {
		return {
			duration,
			css: (t: number) => {
				const eased = cubicOut(t);
				const startX = -1.4 * cardWidth - targetX;
				const startY = -2.2 * cardWidth;

				const x = targetX + (1 - eased) * startX;
				const y = (1 - eased) * startY;
				const scale = 0.55 + eased * 0.45;

				const rotate = (1 - eased) * -35;
				const rotateY = (1 - eased) * 180;
				return `
					transform: perspective(1000px) translate3d(${x}px, ${y}px, 0px) scale(${scale}) rotate(${rotate}deg) rotateY(${rotateY}deg);
					opacity: ${t};
				`;
			}
		};
	}

	const gameWinner = $derived(
		gameState?.players.find((p) => p.isDone && !gameState?.players.some((op) => op.isSkitgubbe))
			?.name ?? null
	);
	const skitgubbe = $derived(gameState?.players.find((p) => p.isSkitgubbe)?.name ?? null);

	const handCount = $derived(humanHand.length);
	const deckShadowStyle = $derived(gameState ? getDeckShadowStyle(gameState.deck.length) : '');

	// FLIP transition coordinate mapping
	const cardRects = new Map<string, DOMRect>();
	let capturedTrickWinnerId: string | null = null;

	function captureCardRects() {
		cardRects.clear();
		capturedTrickWinnerId = gameState?.trickWinnerId || null;
		const cardEls = document.querySelectorAll('[data-card-id]');
		cardEls.forEach((el) => {
			const cardId = el.getAttribute('data-card-id');
			if (cardId) {
				cardRects.set(cardId, el.getBoundingClientRect());
			}
		});
	}

	function cardOut(node: HTMLElement, params: { id: string }) {
		// 1. If entering another player's hand in the new state, or entering the table pile, hide immediately
		if (gameState) {
			const isInAnyHand = gameState.players.some((p) => p.hand.some((c) => c.id === params.id));
			const isOnTable = gameState.tablePile.some((batch) => batch.some((c) => c.id === params.id));
			if (isInAnyHand || isOnTable) {
				return {
					duration: 50,
					css: (t: number) => `opacity: 0;`
				};
			}
		}

		// 2. If trick won, slide to trick winner avatar
		if (capturedTrickWinnerId) {
			const winnerEl = document.querySelector(`[data-player-id="${capturedTrickWinnerId}"]`);
			if (winnerEl) {
				const avatarEl = winnerEl.querySelector('.player-avatar');
				if (avatarEl) {
					const rect = node.getBoundingClientRect();
					const targetRect = avatarEl.getBoundingClientRect();
					const dx = targetRect.left - rect.left;
					const dy = targetRect.top - rect.top;
					const dw = targetRect.width / rect.width;
					const dh = targetRect.height / rect.height;

					return {
						duration: 600,
						easing: cubicOut,
						css: (t: number) => {
							const eased = cubicOut(t);
							const currentDx = dx * (1 - eased);
							const currentDy = dy * (1 - eased);
							const currentScaleX = dw + (1 - dw) * eased;
							const currentScaleY = dh + (1 - dh) * eased;
							return `
								transform: translate(${currentDx}px, ${currentDy}px) scale(${currentScaleX}, ${currentScaleY});
								transform-origin: top left;
								opacity: ${eased};
								z-index: 9999;
							`;
						}
					};
				}
			}
		}

		// 3. Otherwise slide to discard pile (burned)
		const discardEl = document.querySelector('[data-discard]');
		const boardZone = document.querySelector('.board-game-zone');
		if (discardEl && boardZone) {
			const rect = node.getBoundingClientRect();
			const discardRect = discardEl.getBoundingClientRect();

			const boardRect = boardZone.getBoundingClientRect();
			const boardCenterX = boardRect.left + boardRect.width / 2;
			const boardCenterY = boardRect.top + boardRect.height / 2;
			const cardCenterX = rect.left + rect.width / 2;
			const cardCenterY = rect.top + rect.height / 2;

			const toCenterX = boardCenterX - cardCenterX;
			const toCenterY = boardCenterY - cardCenterY;

			const toDiscardX = discardRect.left - rect.left;
			const toDiscardY = discardRect.top - rect.top;
			const dw = discardRect.width / rect.width;
			const dh = discardRect.height / rect.height;

			return {
				duration: 1200,
				css: (t: number) => {
					let x = 0;
					let y = 0;
					let scaleX = 1;
					let scaleY = 1;
					let rotateY = 0;
					let rotate = 0;
					let opacity = 1;

					if (t >= 0.7) {
						// Stage 1: Stack to center (t: 1.0 -> 0.7)
						const progress = (1 - t) / 0.3;
						const ease = cubicOut(progress);
						x = toCenterX * ease;
						y = toCenterY * ease;
					} else if (t >= 0.4) {
						// Stage 2: Flip over at center (t: 0.7 -> 0.4)
						const progress = (0.7 - t) / 0.3;
						const ease = cubicInOut(progress);
						x = toCenterX;
						y = toCenterY;
						rotateY = 180 * ease;
					} else {
						// Stage 3: Fly to discard and fade out (t: 0.4 -> 0.0)
						const progress = (0.4 - t) / 0.4;
						const ease = cubicOut(progress);
						x = toCenterX + (toDiscardX - toCenterX) * ease;
						y = toCenterY + (toDiscardY - toCenterY) * ease;
						scaleX = 1 + (dw - 1) * ease;
						scaleY = 1 + (dh - 1) * ease;
						rotateY = 180;
						rotate = -45 * ease;
						opacity = 1 - ease;
					}

					return `
						transform: perspective(1000px) translate3d(${x}px, ${y}px, 0px) scale(${scaleX}, ${scaleY}) rotate(${rotate}deg) rotateY(${rotateY}deg);
						transform-origin: center center;
						opacity: ${opacity};
						z-index: 9999;
					`;
				}
			};
		}

		return {
			duration: 50,
			css: (t: number) => `opacity: 0;`
		};
	}

	function cardIn(node: HTMLElement, params: { id: string; playerId?: string }) {
		const rect = node.getBoundingClientRect();
		let prevRect = cardRects.get(params.id);

		// If played by another player, slide from their avatar
		if (!prevRect && params.playerId) {
			const playerEl = document.querySelector(`[data-player-id="${params.playerId}"]`);
			if (playerEl) {
				const avatarEl = playerEl.querySelector('.player-avatar');
				if (avatarEl) {
					prevRect = avatarEl.getBoundingClientRect();
				}
			}
		}

		// If drawn from deck, slide from deck
		if (!prevRect) {
			const deckEl = document.querySelector('[data-deck]');
			if (deckEl) {
				prevRect = deckEl.getBoundingClientRect();
			}
		}

		if (prevRect) {
			const dx = prevRect.left - rect.left;
			const dy = prevRect.top - rect.top;
			const dw = prevRect.width / rect.width;
			const dh = prevRect.height / rect.height;

			const cameFromHand = cardRects.has(params.id);
			const isDraw = !cameFromHand && !params.playerId;

			return {
				duration: 600,
				easing: cubicOut,
				css: (t: number) => {
					const eased = cubicOut(t);
					const currentDx = dx * (1 - eased);
					const currentDy = dy * (1 - eased);
					const currentScaleX = dw + (1 - dw) * eased;
					const currentScaleY = dh + (1 - dh) * eased;

					let extraTransform = '';
					if (isDraw) {
						const rotate = (1 - eased) * -35;
						const rotateY = (1 - eased) * 180;
						extraTransform = `rotate(${rotate}deg) rotateY(${rotateY}deg)`;
					}

					return `
						transform: perspective(1000px) translate3d(${currentDx}px, ${currentDy}px, 0px) scale(${currentScaleX}, ${currentScaleY}) ${extraTransform};
						transform-origin: top left;
						z-index: 9999;
					`;
				}
			};
		}

		return fade(node, { duration: 150 });
	}
</script>

<svelte:window
	bind:innerHeight
	bind:innerWidth
	onclick={handleWindowClick}
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
/>

<div class="felt-overlay"></div>

<!-- Disconnected Overlay -->
{#if connectionStatus !== 'connected' && !showJoinModal}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
		transition:fade
	>
		<div
			class="glass-panel flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-slate-900/90 p-8 text-center shadow-2xl"
		>
			<div class="relative flex h-12 w-12 items-center justify-center">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
				></span>
				<span class="relative inline-flex h-6 w-6 rounded-full bg-red-500"></span>
			</div>
			<div>
				<h3 class="text-lg font-bold tracking-wider text-white uppercase">Connection Lost</h3>
				<p class="text-slate-450 mt-2 text-xs">Attempting to reconnect to the game server...</p>
			</div>
		</div>
	</div>
{/if}

<!-- Joining Modal Overlay -->
{#if showJoinModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
	>
		<div
			class="glass-panel flex w-full max-w-md flex-col gap-6 rounded-2xl border border-slate-700/30 p-8 shadow-2xl"
		>
			<div class="text-center">
				<h1
					class="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-3xl font-extrabold text-transparent"
				>
					Skitgubbe
				</h1>
				<p class="mt-1 text-xs text-slate-400">Select your name and avatar color to join room</p>
			</div>

			<div class="flex flex-col gap-2">
				<label for="username" class="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
					>Display Name</label
				>
				<input
					id="username"
					type="text"
					bind:value={tempName}
					placeholder="Enter your name"
					class="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-white placeholder-slate-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
					maxlength="15"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
					>Avatar Color</span
				>
				<div class="grid grid-cols-6 gap-3">
					{#each PRESET_COLORS as color}
						<button
							onclick={() => (tempColor = color)}
							class="h-8 w-8 cursor-pointer rounded-full border-2 shadow-md transition-all duration-200 hover:scale-110"
							style="background-color: {color}; border-color: {tempColor === color
								? '#ffd700'
								: 'transparent'};"
							aria-label="Select color {color}"
						></button>
					{/each}
				</div>
			</div>

			{#if joinError}
				<span class="text-center text-xs font-semibold text-red-400">{joinError}</span>
			{/if}

			<button
				onclick={handleJoinConfirm}
				class="w-full rounded-xl border border-yellow-500/20 bg-gradient-to-r from-amber-500 to-yellow-600 py-3 font-bold tracking-wide text-slate-950 shadow-lg transition-all duration-300 hover:from-amber-400 hover:to-yellow-500 active:scale-95"
			>
				JOIN GAME
			</button>
		</div>
	</div>
{/if}

<!-- Waiting Lobby Overlay -->
{#if gameState && gameState.status === 'waiting'}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
	>
		<div
			class="glass-panel flex w-full max-w-xl flex-col gap-8 rounded-2xl border border-slate-700/30 p-8 shadow-2xl"
		>
			<div class="text-center">
				<span
					class="rounded border border-emerald-800/30 bg-emerald-950/50 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-emerald-400 uppercase"
				>
					Room Lobby
				</span>
				<h2 class="mt-3 text-2xl font-extrabold text-white">Waiting for players to join...</h2>

				<!-- Room Link -->
				<div
					class="mx-auto mt-4 flex max-w-sm items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2"
				>
					<span class="truncate font-mono text-xs text-slate-400 select-all">{roomUrl}</span>
					<button
						onclick={copyRoomUrl}
						class="cursor-pointer rounded-lg border border-slate-700/40 bg-slate-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 shadow transition-all hover:bg-slate-700 active:scale-95"
					>
						{copyText}
					</button>
				</div>
			</div>

			<!-- Joined Players list -->
			<div class="flex flex-col gap-3">
				<span class="text-[10px] font-bold tracking-wider text-slate-400 uppercase"
					>Players ({gameState.players.length})</span
				>
				<div class="border-slate-850 flex flex-col gap-2 rounded-xl border bg-slate-900/50 p-4">
					{#each gameState.players as p}
						<div class="flex items-center gap-3 border-b border-slate-800/40 py-1 last:border-0">
							<div class="h-4 w-4 rounded-full" style="background-color: {p.color};"></div>
							<span class="flex items-center gap-2 text-sm font-semibold text-white">
								{p.name}
								{#if p.id === playerId}
									<span
										class="font-mono text-[9px] font-bold tracking-widest text-amber-400 uppercase"
										>(You)</span
									>
								{/if}
								{#if p.isHost}
									<span
										class="rounded border border-yellow-800/20 bg-yellow-950/30 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-yellow-500 uppercase"
										>Host</span
									>
								{/if}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Start Game Action -->
			<div class="flex flex-col gap-2">
				{#if isHost}
					<button
						onclick={handleStartGameClick}
						disabled={gameState.players.length < 2}
						class="disabled:from-slate-850 w-full cursor-pointer rounded-xl border border-yellow-500/20 bg-gradient-to-r from-amber-500 to-yellow-600 py-3 font-bold tracking-wide text-slate-950 shadow-lg transition-all duration-300 hover:from-amber-400 hover:to-yellow-500 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:to-slate-900 disabled:text-slate-500"
					>
						{gameState.players.length < 2 ? 'NEED AT LEAST 2 PLAYERS' : 'START GAME'}
					</button>
				{:else}
					<div
						class="flex animate-pulse items-center justify-center gap-2 rounded-xl border border-amber-900/20 bg-amber-950/15 py-3 text-center text-xs font-medium text-amber-400"
					>
						<span class="h-1.5 w-1.5 animate-ping rounded-full bg-amber-400"></span>
						Waiting for host to start the game...
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<div
	class="game-layout relative flex h-screen w-screen flex-col justify-between overflow-hidden select-none"
	style="--card-width: {cardWidth}px; --card-height: {cardWidth *
		1.4}px; --hand-container-height: {cardWidth * 1.4 * 1.35}px;"
>
	<!-- Top Container: Sidebars and Center Game Board -->
	<div class="flex w-full flex-grow overflow-hidden">
		<!-- Left Sidebar: Draw, Discard, and Trump -->
		<div class="left-sidebar z-10 flex flex-shrink-0 flex-col items-center justify-center">
			<!-- Trump Box -->
			<div
				class="compact-pile-box flex w-full items-center justify-start gap-2"
				class:invisible={(gameState?.phase || 1) === 1}
			>
				{#if gameState?.trumpCard}
					<div
						data-trump
						data-card-id={gameState.trumpCard.id}
						class="relative cursor-default rounded"
						style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
						transition:fade
					>
						<div
							class="card-face shadow-md"
							style="padding: 1px; border: 1.5px solid #ffd700; border-radius: 4px;"
						>
							<svg
								viewBox="0 0 125 175"
								class="pointer-events-none h-full w-full select-none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<rect width="125" height="175" rx="12" fill="#ffffff" />
								<text
									x="14"
									y="28"
									font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
									font-size="22"
									font-weight="800"
									fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'}
									text-anchor="middle">{gameState.trumpCard.value}</text
								>
								<text
									x="14"
									y="47"
									font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
									font-size="18"
									fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'}
									text-anchor="middle">{gameState.trumpCard.suit}</text
								>

								<text
									x="62.5"
									y="105"
									font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
									font-size="56"
									fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'}
									text-anchor="middle">{gameState.trumpCard.suit}</text
								>

								<g transform="rotate(180 62.5 87.5)">
									<text
										x="14"
										y="28"
										font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
										font-size="22"
										font-weight="800"
										fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'}
										text-anchor="middle">{gameState.trumpCard.value}</text
									>
									<text
										x="14"
										y="47"
										font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
										font-size="18"
										fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'}
										text-anchor="middle">{gameState.trumpCard.suit}</text
									>
								</g>
							</svg>
							<div class="card-shimmer"></div>
						</div>
					</div>
					<div class="flex flex-col select-none">
						<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Trump</span>
						<span
							class="max-w-[65px] truncate font-mono text-[9px] font-bold text-yellow-400 uppercase"
							>{gameState.trumpCard.suitName}</span
						>
					</div>
				{:else if gameState?.hiddenTrumpStorage}
					{@const owner = gameState.players.find(
						(p) => p.id === (gameState ? gameState.hiddenTrumpStorage?.playerId : '')
					)}
					<div
						class="flex flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/20 p-0.5 text-center font-mono text-[6px] leading-none text-slate-500"
						style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
						transition:fade
					>
						<span>HELD BY<br />{owner?.name.toUpperCase()}</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Trump</span>
						<span class="font-mono text-[9px] text-slate-500 uppercase">Hidden</span>
					</div>
				{:else}
					<div
						class="flex flex-col items-center justify-center rounded border border-dashed border-slate-800 bg-slate-950/5 font-mono text-[7px] leading-none text-slate-600"
						style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
						transition:fade
					>
						<span>NONE</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Trump</span>
						<span class="font-mono text-[9px] text-slate-500 uppercase">None</span>
					</div>
				{/if}
			</div>

			<!-- Draw Pile Box (Phase 1) or Discard Pile Box (Phase 2) -->
			{#if gameState && gameState.phase === 1}
				<div class="compact-pile-box mt-2 flex w-full flex-col items-start gap-2" transition:fade>
					<div class="flex w-full items-center justify-start gap-2">
						<div
							data-deck
							class="relative flex-shrink-0 overflow-hidden rounded border border-amber-500/30 shadow-md"
							style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
						>
							{#if gameState.deck.length > 0}
								<div
									class="card-back h-full w-full"
									style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
								></div>
							{:else}
								<div
									class="flex h-full w-full items-center justify-center rounded border border-dashed border-emerald-700/60 bg-emerald-950/40 font-mono text-[7px] font-bold text-emerald-600/70"
								>
									EMPTY
								</div>
							{/if}
						</div>
						<div class="flex flex-col select-none">
							<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Draw</span>
							<span class="font-mono text-[10px] font-bold text-yellow-400"
								>{gameState.deck.length} left</span
							>
						</div>
					</div>
					{#if gameState.deck.length > 0}
						<button
							onclick={handleChanceClick}
							disabled={!isHumanTurn}
							class="chance-btn w-full cursor-pointer rounded border border-slate-700/30 bg-amber-500 py-1 text-xs font-bold tracking-wide text-slate-950 uppercase shadow-md transition-all duration-200 hover:bg-amber-600 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-slate-800/40 disabled:text-slate-500"
						>
							Chance
						</button>
					{/if}
				</div>
			{:else if gameState}
				<div
					class="compact-pile-box mt-2 flex w-full items-center justify-start gap-2"
					transition:fade
				>
					<div
						data-discard
						class="relative flex flex-shrink-0 items-center justify-center rounded border border-emerald-800/40 bg-emerald-950/20 shadow-inner"
						style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
					>
						{#if gameState.discardPile.length > 0}
							<div
								class="card-back animate-fade-in h-full w-full"
								style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
							></div>
						{/if}
					</div>
					<div class="flex flex-col select-none">
						<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Discard</span
						>
						<span class="font-mono text-[10px] font-bold text-emerald-400"
							>{gameState.discardPile.length} cards</span
						>
					</div>
				</div>
			{/if}

			<!-- WebSocket status indicator -->
			{#if connectionStatus !== 'connected'}
				<div
					class="mt-auto mb-4 flex items-center gap-1.5 font-mono text-[9px] text-slate-400"
					transition:fade
				>
					<span
						class="h-1.5 w-1.5 rounded-full bg-red-400 {connectionStatus === 'connecting'
							? 'animate-ping'
							: 'animate-pulse bg-red-500'}"
					></span>
					{connectionStatus.toUpperCase()}
				</div>
			{/if}
		</div>

		<!-- Center Area: Players Row & Table Pile -->
		<div class="relative flex flex-grow flex-col overflow-hidden">
			<!-- Top Row: Player status cards -->
			<div class="players-row z-10">
				{#if gameState}
					{#each gameState.players as player, idx}
						{#if idx > 0}
							<div class="player-row-divider"></div>
						{/if}
						{@const isActive =
							gameState.activePlayerIdx === idx &&
							!gameState.trickWinnerId &&
							gameState.status === 'playing'}
						<div
							data-player-id={player.id}
							class="player-status-block transition-all duration-300 {isActive
								? 'active-turn'
								: ''} {player.isDone ? 'escaped' : ''}"
						>
							<!-- Left Side: Profile vertical stack -->
							<div class="player-profile-stack">
								<div class="player-avatar" style="background-color: {player.color}">
									{player.name.substring(0, 2).toUpperCase()}
								</div>
								<span class="player-name">
									{player.name}
									{#if player.isDone}
										<span class="status-badge font-bold text-emerald-400">✓</span>
									{:else if player.isSkitgubbe}
										<span class="status-badge text-red-500">💀</span>
									{/if}
								</span>
							</div>

							<!-- Right Side: Card count symbol -->
							<div class="player-card-badge" class:active-turn={isActive}>
								{#if gameState.phase === 1}
									<div class="stacked-counts">
										<span class="hand-count">{player.hand.length}</span>
										<div class="count-divider"></div>
										<span class="reserve-count">{player.reserveStack.length}</span>
									</div>
								{:else}
									<span class="single-count">{player.hand.length}</span>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Main play field (Table) -->
			<main
				class="board-game-zone relative mx-auto flex w-full max-w-5xl flex-grow items-center justify-center overflow-visible px-4"
				class:drag-over-valid={isDragValid}
			>
				<!-- Ornate felt inner circle rim -->
				<div
					class="pointer-events-none absolute inset-0 my-12 rounded-full border border-emerald-900/10 opacity-20"
				></div>

				{#if errorMessage}
					<div
						class="absolute top-6 z-20 animate-bounce rounded-full border border-red-500/20 bg-red-950/90 px-4 py-2 text-xs font-semibold tracking-wide text-red-200 shadow-lg"
					>
						⚠️ {errorMessage}
					</div>
				{/if}

				{#if gameWinner}
					<!-- Game Won overlay -->
					<div
						class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-2xl bg-emerald-950/90 backdrop-blur-md"
					>
						<span class="animate-bounce text-4xl font-extrabold text-yellow-400">Winner!</span>
						<span class="text-2xl font-medium text-white">{gameWinner} escapes first and wins!</span
						>
						{#if localPlayer?.isHost}
							<button
								onclick={handleResetGameClick}
								class="lay-cards-btn mt-2 rounded-xl px-6 py-2.5 text-sm font-bold tracking-wide"
							>
								Reset Room
							</button>
						{:else}
							<span class="text-xs text-slate-400">Waiting for host to reset...</span>
						{/if}
					</div>
				{:else if skitgubbe}
					<!-- Skitgubbe Loss overlay -->
					<div
						class="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 rounded-2xl bg-red-950/90 backdrop-blur-md"
					>
						<span class="animate-pulse text-4xl font-extrabold text-red-500">Skitgubbe!</span>
						<span class="text-2xl font-medium text-white">{skitgubbe} is the Skitgubbe!</span>
						{#if localPlayer?.isHost}
							<button
								onclick={handleResetGameClick}
								class="lay-cards-btn mt-2 rounded-xl px-6 py-2.5 text-sm font-bold tracking-wide"
							>
								Reset Room
							</button>
						{:else}
							<span class="text-xs text-slate-400">Waiting for host to reset...</span>
						{/if}
					</div>
				{:else if gameState?.trickWinnerId && gameState.phase === 1}
					{@const winner = gameState.players.find((p) => p.id === gameState?.trickWinnerId)}
					<div
						class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-800/20 bg-emerald-950/80 shadow-2xl backdrop-blur-sm"
					>
						{#if gameState.phase === 1}
							<span class="animate-bounce text-3xl font-extrabold tracking-tight text-yellow-400"
								>Trick Won!</span
							>
							<span class="text-lg font-medium text-white"
								>{winner?.name} takes the trick cards</span
							>
							<span class="font-mono text-xs text-slate-400">Setting up next trick...</span>
						{:else}
							<span class="animate-bounce text-3xl font-extrabold tracking-tight text-amber-400"
								>Table Burned!</span
							>
							<span class="text-lg font-medium text-white">{winner?.name} clears the table</span>
							<span class="font-mono text-xs text-slate-400">Clearing cards...</span>
						{/if}
					</div>
				{/if}

				<!-- Cards currently in play -->
				{#if gameState && gameState.phase === 1}
					<!-- Phase 1 Layout: Groups of played cards arranged side-by-side -->
					<div class="table-pile-container flex items-center justify-center gap-4 overflow-visible">
						{#each gameState.tablePile as batch, idx}
							{@const playerIdOfBatch = gameState.tablePilePlayers[idx]}
							{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center gap-2">
								<span
									class="rounded border border-emerald-800/30 bg-emerald-950/50 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300"
									out:fade={{ duration: 300 }}
								>
									{player?.name}
								</span>
								<div class="semi-stacked-pile">
									{#each batch as card (card.id)}
										<div
											class="card relative cursor-default"
											data-card-id={card.id}
											in:cardIn={{ id: card.id, playerId: playerIdOfBatch }}
											out:cardOut={{ id: card.id }}
										>
											<div class="relative h-full w-full" style="transform-style: preserve-3d;">
												<!-- Front of Card -->
												<div
													class="card-face shadow-md"
													style="padding: 0; border: none; background: transparent;"
												>
													<svg
														viewBox="0 0 125 175"
														class="pointer-events-none h-full w-full select-none"
														xmlns="http://www.w3.org/2000/svg"
													>
														<rect
															width="125"
															height="175"
															rx="12"
															fill="#ffffff"
															stroke="rgba(0,0,0,0.15)"
															stroke-width="1.5"
														/>

														<text
															x="14"
															y="26"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="18"
															font-weight="800"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.value}</text
														>
														<text
															x="14"
															y="42"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="13"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.suit}</text
														>

														<text
															x="62.5"
															y="105"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="48"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.suit}</text
														>

														<g transform="rotate(180 62.5 87.5)">
															<text
																x="14"
																y="26"
																font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
																font-size="18"
																font-weight="800"
																fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
																text-anchor="middle">{card.value}</text
															>
															<text
																x="14"
																y="42"
																font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
																font-size="13"
																fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
																text-anchor="middle">{card.suit}</text
															>
														</g>
													</svg>
													{#if trumpSuit && card.suitName === trumpSuit}
														<div class="card-shimmer"></div>
													{/if}
												</div>

												<!-- Back of Card (for flip transition) -->
												<div
													class="card-back"
													style="backface-visibility: hidden; transform: rotateY(180deg);"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else if gameState}
					<!-- Phase 2 Layout: Horizontally fanned out sequential play batches -->
					<div
						class="table-pile-container-phase2 flex max-w-4xl flex-wrap items-center justify-center gap-3 overflow-visible"
					>
						{#each gameState.tablePile as batch, batchIdx}
							{@const playerIdOfBatch = gameState.tablePilePlayers[batchIdx]}
							{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center">
								<span
									class="mb-1 font-mono text-[9px] font-bold text-slate-400"
									out:fade={{ duration: 300 }}
								>
									{player?.name}
								</span>
								<div
									class="semi-stacked-pile rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-1 shadow-inner"
								>
									{#each batch as card (card.id)}
										<div
											class="card relative cursor-default"
											data-card-id={card.id}
											in:cardIn={{ id: card.id, playerId: playerIdOfBatch }}
											out:cardOut={{ id: card.id }}
										>
											<div class="relative h-full w-full" style="transform-style: preserve-3d;">
												<!-- Front of Card -->
												<div
													class="card-face shadow-md"
													style="padding: 0; border: none; background: transparent;"
												>
													<svg
														viewBox="0 0 125 175"
														class="pointer-events-none h-full w-full select-none"
														xmlns="http://www.w3.org/2000/svg"
													>
														<rect
															width="125"
															height="175"
															rx="12"
															fill="#ffffff"
															stroke="rgba(0,0,0,0.15)"
															stroke-width="1.5"
														/>

														<text
															x="14"
															y="26"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="18"
															font-weight="800"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.value}</text
														>
														<text
															x="14"
															y="42"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="13"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.suit}</text
														>

														<text
															x="62.5"
															y="105"
															font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
															font-size="48"
															fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
															text-anchor="middle">{card.suit}</text
														>

														<g transform="rotate(180 62.5 87.5)">
															<text
																x="14"
																y="26"
																font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
																font-size="18"
																font-weight="800"
																fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
																text-anchor="middle">{card.value}</text
															>
															<text
																x="14"
																y="42"
																font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
																font-size="13"
																fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
																text-anchor="middle">{card.suit}</text
															>
														</g>
													</svg>
													{#if trumpSuit && card.suitName === trumpSuit}
														<div class="card-shimmer"></div>
													{/if}
												</div>

												<!-- Back of Card (for flip transition) -->
												<div
													class="card-back"
													style="backface-visibility: hidden; transform: rotateY(180deg);"
												></div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</main>
		</div>
	</div>

	<!-- Toggle Logs Button in Top Right -->
	<button
		onclick={() => (showLogs = !showLogs)}
		class="glass-panel absolute top-6 right-6 z-30 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700/60 px-4 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:border-emerald-500/30 hover:text-emerald-400 active:scale-95"
		title="Toggle Game Log"
		aria-label="Toggle game log"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-4 w-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
		<span class="font-mono text-xs font-bold tracking-wider uppercase">Logs</span>
	</button>

	<!-- Floating Logs Panel -->
	{#if showLogs}
		<div
			transition:fade={{ duration: 150 }}
			class="glass-panel absolute top-20 right-6 bottom-28 z-30 flex w-80 flex-col gap-2.5 rounded-2xl border border-slate-700/40 p-4 shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-slate-800/60 pb-2">
				<span class="logs-title flex items-center gap-2">
					<span class="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase"
						>Logs</span
					>
					<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>
				</span>
				<button
					onclick={() => (showLogs = false)}
					class="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-white"
					aria-label="Close logs"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div
				class="logs-panel flex flex-grow flex-col gap-2.5 overflow-y-auto rounded-xl p-3 shadow-inner"
			>
				{#if gameState}
					{#each gameState.logs as log}
						<div class="font-mono text-[11px] break-words text-emerald-300/90">
							{log}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Bottom Area: Actions & Player Hand -->
	<footer class="game-footer relative z-10 flex w-full flex-col items-center gap-4 pb-4">
		<!-- Buttons actions panel -->
		<div
			class="action-buttons-panel relative flex w-[80vw] max-w-5xl items-center justify-end overflow-visible px-2"
		>
			<!-- Right side trigger buttons -->
			<div class="flex gap-3">
				{#if gameState && gameState.phase === 2 && isHumanTurn && gameState.tablePile.length > 0}
					<button
						onclick={handlePickUpClick}
						class="pick-up-btn cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all duration-300 active:scale-95"
					>
						PICK UP BATCH
					</button>
				{/if}
				{#if isStroValid}
					<button
						onclick={handleSprinkleClick}
						class="lay-cards-btn cursor-pointer rounded-lg border border-teal-500/20 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg transition-all duration-300 hover:from-emerald-400 hover:to-teal-500 active:scale-95"
					>
						SPRINKLE ({selectedCardIds.length})
					</button>
				{/if}
			</div>
		</div>

		<!-- Hand Container -->
		<div
			bind:clientWidth={containerWidth}
			class="relative flex w-[80vw] max-w-5xl items-end justify-center overflow-visible pb-4"
			style="height: var(--hand-container-height);"
		>
			{#if humanHand.length > 0}
				{#each humanHand as card, i (card.id)}
					{@const xPosition = getCardX(i, handCount, activeSpreadIdx)}
					{@const isSelected = selectedCardIds.includes(card.id)}
					{@const isHovered = hoveredCardId === card.id}
					{@const isPlayable = checkDropValidity([card]) !== null}

					<div
						class="card hand-card absolute select-none"
						class:selected={isSelected}
						class:non-playable={anyCardPlayable && !isPlayable}
						style="{getCardStyle(
							card.id,
							i,
							isSelected,
							isHovered,
							xPosition
						)}{cardsBeingDragged.includes(card.id)
							? `; transform: translate(calc(var(--x-pos) + ${dragOffset.x}px), calc(var(--lift) + ${dragOffset.y}px)) scale(1.05) !important; z-index: 10000 !important; transition: none !important;`
							: ''}"
						onclick={(e) => handleCardElementClick(e, i, card.id)}
						onpointerdown={(e) => handleCardPointerDown(e, card.id, i)}
						ondragstart={(e) => e.preventDefault()}
						onpointerenter={() => (hoveredCardId = card.id)}
						onpointerleave={() => {
							if (hoveredCardId === card.id) hoveredCardId = null;
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') handleCardClick(i, card.id);
						}}
						role="button"
						tabindex="0"
						aria-label="{card.value} of {card.suitName}"
						data-card-id={card.id}
						in:cardIn={{ id: card.id }}
						out:cardOut={{ id: card.id }}
					>
						<div class="relative h-full w-full" style="transform-style: preserve-3d;">
							<!-- Front of Card -->
							<div
								class="card-face shadow-md"
								style="padding: 0; border: none; background: transparent;"
							>
								<svg
									viewBox="0 0 125 175"
									class="pointer-events-none h-full w-full select-none"
									xmlns="http://www.w3.org/2000/svg"
								>
									<rect
										width="125"
										height="175"
										rx="12"
										fill="#ffffff"
										stroke="rgba(0,0,0,0.15)"
										stroke-width="1.5"
									/>

									<text
										x="14"
										y="26"
										font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
										font-size="18"
										font-weight="800"
										fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
										text-anchor="middle">{card.value}</text
									>
									<text
										x="14"
										y="42"
										font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
										font-size="13"
										fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
										text-anchor="middle">{card.suit}</text
									>

									<text
										x="62.5"
										y="105"
										font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
										font-size="48"
										fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
										text-anchor="middle">{card.suit}</text
									>

									<g transform="rotate(180 62.5 87.5)">
										<text
											x="14"
											y="26"
											font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
											font-size="18"
											font-weight="800"
											fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
											text-anchor="middle">{card.value}</text
										>
										<text
											x="14"
											y="42"
											font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
											font-size="13"
											fill={card.color === 'red' ? '#dc2626' : '#1e293b'}
											text-anchor="middle">{card.suit}</text
										>
									</g>
								</svg>
								{#if trumpSuit && card.suitName === trumpSuit}
									<div class="card-shimmer"></div>
								{/if}
							</div>

							<!-- Back of Card (for flip transition) -->
							<div
								class="card-back"
								style="backface-visibility: hidden; transform: rotateY(180deg);"
							></div>
						</div>
					</div>
				{/each}
			{:else}
				<div
					transition:fade
					class="mb-6 flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-800/30 bg-emerald-950/20 px-6 py-3 text-center text-sm font-medium text-slate-400"
				>
					<span>Your hand is empty / Spectating</span>
				</div>
			{/if}
		</div>
	</footer>
</div>

<!-- Debug Menu Floating Action Button and Panel -->
<div class="fixed right-6 bottom-6 z-30 flex flex-col items-end gap-3">
	{#if showDebugMenu}
		<div
			transition:fade={{ duration: 150 }}
			class="glass-panel flex min-w-[200px] flex-col gap-3 rounded-2xl border border-slate-700/40 p-4 shadow-2xl"
		>
			<div
				class="mb-1 flex items-center gap-1.5 border-b border-slate-800/60 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
			>
				<span>⚙️ Debug Tools</span>
			</div>

			<!-- Autoplay Toggle -->
			<button
				onclick={() => (autoplay = !autoplay)}
				class="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all {autoplay
					? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
					: 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}"
			>
				<span>Autoplay Turn</span>
				<span
					class="h-2.5 w-2.5 rounded-full {autoplay
						? 'animate-pulse bg-amber-400'
						: 'bg-slate-700'}"
				></span>
			</button>

			<!-- Skip to Phase 2 -->
			{#if gameState && gameState.status === 'playing'}
				<button
					onclick={() => sendWsMessage({ type: 'debugSkipToPhase2' })}
					class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-amber-500/40 hover:text-amber-300"
				>
					⏭️ Skip to Phase 2
				</button>
			{/if}

			<!-- Reset Game -->
			<button
				onclick={handleResetGameClick}
				class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-red-500/40 hover:text-red-400"
			>
				🔄 Reset Game
			</button>
		</div>
	{/if}

	<button
		onclick={() => (showDebugMenu = !showDebugMenu)}
		class="glass-panel flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-slate-700/60 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:border-amber-500/30 hover:text-amber-400 active:scale-95"
		title="Debug Menu"
		aria-label="Toggle debug menu"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-6 w-6 transition-transform duration-300 {showDebugMenu
				? 'rotate-90 text-amber-400'
				: ''}"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	</button>
</div>

<!-- Portrait Orientation Warning Overlay -->
<div class="portrait-warning">
	<div class="warning-content">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="rotate-phone-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
		<h2>Please Rotate Your Device</h2>
		<p>
			This sandbox is optimized for horizontal (landscape) layout. Turn your phone to start playing!
		</p>
	</div>
</div>

<style>
	.hand-card {
		position: absolute;
		bottom: 0;
		left: 50%;
		margin-left: calc(-1 * var(--card-width) / 2);
		transform: translate(var(--x-pos), var(--lift)) scale(var(--scale));
		z-index: var(--z-index);
		touch-action: none;
	}

	:global(.board-game-zone.drag-over-valid) {
		box-shadow: inset 0 0 50px rgba(16, 185, 129, 0.25) !important;
		background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 80%) !important;
		transition:
			background 0.3s ease,
			box-shadow 0.3s ease;
	}
</style>
