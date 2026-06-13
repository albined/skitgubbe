<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut, cubicInOut } from 'svelte/easing';
	import { page } from '$app/stores';
	import { getValueNumeric, isValidPlay, type GameState, type Card, type Player } from 'shared';
	import { CardFace, CardBack, Confetti } from '$lib';
	import Avatar from '$lib/Avatar.svelte';
	import { env } from '$env/dynamic/public';

	const roomId = $page.params.roomId;
	const allowDevSettings = env.PUBLIC_ALLOW_DEV_SETTINGS === 'true';

	// WebSocket & Connection State
	let socket: WebSocket | null = null;
	let reconnectTimeout: number | undefined = undefined;
	let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let errorMessage = $state<string>('');
	let showDisconnectedOverlay = $state(false);
	let overlayTimeout: number | undefined = undefined;

	$effect(() => {
		if (connectionStatus === 'connected') {
			if (overlayTimeout) {
				clearTimeout(overlayTimeout);
				overlayTimeout = undefined;
			}
			showDisconnectedOverlay = false;
		} else {
			if (!showDisconnectedOverlay && !overlayTimeout) {
				overlayTimeout = window.setTimeout(() => {
					showDisconnectedOverlay = true;
					overlayTimeout = undefined;
				}, 1500);
			}
		}
	});

	// Client info & Local State
	let playerId = $state<string>('');
	let playerName = $state<string>('');
	let playerColor = $state<string>('');

	// Synchronized Server State
	let gameState = $state<GameState | null>(null);
	let yourPlayerId = $state<string>('');

	// Replay Controller State
	let isReplaying = $state(false);
	let replayQueue: GameState[] = [];
	let replayTimer: number | undefined = undefined;
	let godMode = $state(false);

	function runReplay(states: GameState[]) {
		if (states.length === 0) return;
		isReplaying = true;
		replayQueue = [...states];

		if (replayTimer) {
			clearTimeout(replayTimer);
		}

		// Populate reconnectCardIds with the cards already in our hand in the starting state
		reconnectCardIds.clear();
		const initialState = states[0];
		const activeId = playerId || yourPlayerId;
		const localPlayer = initialState.players.find((p) => p.id === activeId);
		if (localPlayer) {
			localPlayer.hand.forEach((c) => reconnectCardIds.add(c.id));
		}

		let currentIndex = 0;
		gameState = replayQueue[currentIndex];
		if (gameState && gameState.seq !== undefined) {
			localStorage.setItem(`skitgubbe_last_seq_${roomId}`, gameState.seq.toString());
		}

		function nextStep() {
			currentIndex++;
			if (currentIndex < replayQueue.length) {
				captureCardRects(); // Capture positions before updating state!
				gameState = replayQueue[currentIndex];
				if (gameState && gameState.seq !== undefined) {
					localStorage.setItem(`skitgubbe_last_seq_${roomId}`, gameState.seq.toString());
				}
				replayTimer = window.setTimeout(nextStep, 1200);
			} else {
				isReplaying = false;
				replayQueue = [];
				replayTimer = undefined;
			}
		}

		replayTimer = window.setTimeout(nextStep, 1200);
	}

	// Client interaction states
	let selectedCardIds = $state<string[]>([]);
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let fanCenterIdx = $state(-1);
	let autoplay = $state(false);
	let showDebugMenu = $state(false);
	let showLogs = $state(false);

	// Skitgubbe game over animation state
	let endGameStage = $state<'none' | 'paused' | 'table_clear' | 'cards_reveal' | 'poster_slam'>('none');
	let shakeActive = $state(false);
	let showDustEffect = $state(false);
	let loserAvatarPos = $state<{ x: number; y: number } | null>(null);

	// Confetti reference and escape celebration tracking
	let confettiRef: any = null;
	let prevDonePlayerIds = new Set<string>();
	let isFirstStateUpdate = true;

	$effect(() => {
		if (gameState && gameState.status === 'ended' && skitgubbe && !isReplaying) {
			if (endGameStage === 'none') {
				endGameStage = 'paused';

				// Capture position of the loser's avatar after Svelte mounts it
				setTimeout(() => {
					const loserEl = document.querySelector(`[data-player-id="${skitgubbe.id}"]`);
					if (loserEl) {
						const rect = loserEl.getBoundingClientRect();
						loserAvatarPos = {
							x: rect.left + rect.width / 2,
							y: rect.top + rect.height / 2
						};
					}
				}, 100);

				// Wait 1.5 seconds pause, then transition to table_clear
				setTimeout(() => {
					endGameStage = 'table_clear';

					// Wait 1.0 seconds for the table cards to fly to the discard pile, then transition to cards_reveal
					setTimeout(() => {
						endGameStage = 'cards_reveal';

						// Stagger cards reveal flight: wait for all to land before poster slam
						const cardCount = skitgubbe.hand.length;
						const cardsRevealTime = cardCount * 250 + 1000;

						setTimeout(() => {
							endGameStage = 'poster_slam';

							// Trigger screen shake exactly on wanted poster slam impact (300ms)
							setTimeout(() => {
								shakeActive = true;
								showDustEffect = true;
								setTimeout(() => {
									shakeActive = false;
								}, 400);
							}, 300);

						}, cardsRevealTime);
					}, 1000);
				}, 1500);
			}
		} else {
			if (endGameStage !== 'none') {
				endGameStage = 'none';
				shakeActive = false;
				showDustEffect = false;
				loserAvatarPos = null;
			}
		}
	});

	$effect(() => {
		if (gameState && gameState.status === 'playing') {
			const currentDoneIds = new Set<string>(
				gameState.players.filter((p) => p.isDone).map((p) => p.id)
			);

			if (isFirstStateUpdate) {
				prevDonePlayerIds = currentDoneIds;
				isFirstStateUpdate = false;
			} else {
				// Fire confetti for any player who just escaped (isDone transitioned from false to true)
				for (const p of gameState.players) {
					if (p.isDone && !prevDonePlayerIds.has(p.id)) {
						confettiRef?.fire(p.color);
					}
				}
				prevDonePlayerIds = currentDoneIds;
			}
		} else if (!gameState || gameState.status === 'ended') {
			prevDonePlayerIds.clear();
			isFirstStateUpdate = true;
		}
	});

	// Drag and drop states
	let dragStartPos = $state<{ x: number; y: number } | null>(null);
	let dragOffset = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let activeDraggedCardId = $state<string | null>(null);
	let cardsBeingDragged = $state<string[]>([]);
	let isDragging = $state<boolean>(false);
	let preventNextClick = $state<boolean>(false);
	let pendingPlayOffsets = $state<Record<string, { x: number; y: number }>>({});

	// Hand card animation sequencing
	let newCardRelativeIndices = $state<Map<string, number>>(new Map());
	const reconnectCardIds = new Set<string>();
	let wasPlayingOnConnect = false;

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
			(gameState.players[gameState.activePlayerIdx]?.id === playerId || godMode) &&
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

			const storedSeqStr = localStorage.getItem(`skitgubbe_last_seq_${roomId}`);
			const lastSeq = storedSeqStr ? parseInt(storedSeqStr, 10) : undefined;

			sendWsMessage({
				type: 'join',
				playerId,
				name: playerName,
				color: playerColor,
				lastSeq: isNaN(lastSeq as number) ? undefined : lastSeq
			});
		};

		socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'replay') {
					yourPlayerId = data.yourPlayerId;
					runReplay(data.states);
				} else if (data.type === 'stateUpdate') {
					if (isReplaying) {
						const lastQueued = replayQueue[replayQueue.length - 1];
						if (
							!lastQueued ||
							(data.state.seq !== undefined &&
								lastQueued.seq !== undefined &&
								data.state.seq > lastQueued.seq)
						) {
							replayQueue.push(data.state);
						}
						return;
					}

					// Ignore initial state updates sent before socket identification
					// (which contains masked "?" cards for our own player hand)
					// to avoid layout flashes and cards playing exit transitions.
					const isPlayerInGame = data.state.players.some((p: Player) => p.id === playerId);
					if (isPlayerInGame && data.yourPlayerId !== playerId) {
						return;
					}

					if (gameState === null && data.state.status === 'playing') {
						wasPlayingOnConnect = true;
					}

					if (wasPlayingOnConnect && reconnectCardIds.size === 0) {
						const activeId = playerId || data.yourPlayerId;
						const localPlayer = data.state.players.find((p: Player) => p.id === activeId);
						if (localPlayer && !localPlayer.hand.some((c: Card) => c.value === '?')) {
							localPlayer.hand.forEach((c: Card) => reconnectCardIds.add(c.id));
						}
					}

					// Compute stagger indices synchronously before setting gameState
					if (data.state.status === 'playing') {
						const activeId = playerId || data.yourPlayerId;
						const localPlayer = data.state.players.find((p: Player) => p.id === activeId);
						if (localPlayer) {
							const currentIds = localPlayer.hand.map((c: Card) => c.id);
							const currentHand =
								gameState?.players.find((p: Player) => p.id === activeId)?.hand || [];
							const existingIds = currentHand.map((c: Card) => c.id);
							const newIds = currentIds.filter((id: string) => !existingIds.includes(id));

							if (newIds.length > 0) {
								const newIndices = new Map<string, number>();
								newIds.forEach((id: string, idx: number) => {
									newIndices.set(id, idx);
								});
								newCardRelativeIndices = newIndices;
							} else {
								newCardRelativeIndices = new Map();
							}
						}
					}

					captureCardRects();
					gameState = data.state;
					yourPlayerId = data.yourPlayerId;
					animatingPlayCardIds = [];
					pendingPlayOffsets = {};

					// Save sequence to localStorage
					if (gameState && gameState.seq !== undefined) {
						localStorage.setItem(`skitgubbe_last_seq_${roomId}`, gameState.seq.toString());
					}
				} else if (data.type === 'error') {
					errorMessage = data.message;
					pendingPlayOffsets = {};
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

	onMount(async () => {
		try {
			const cachedId = sessionStorage.getItem('skitgubbe_playerId');
			const cachedName = sessionStorage.getItem('skitgubbe_playerName');
			const cachedColor = sessionStorage.getItem('skitgubbe_playerColor');

			if (cachedId && cachedName && cachedColor) {
				playerId = cachedId;
				playerName = cachedName;
				playerColor = cachedColor;
				connectWebSocket();
			} else {
				const res = await fetch('/api/profiles/me');
				if (res.ok) {
					const profile = await res.json();
					playerId = profile.id;
					playerName = profile.name;
					playerColor = profile.color;
					// Cache it in sessionStorage for tab-specific persistence
					sessionStorage.setItem('skitgubbe_playerId', playerId);
					sessionStorage.setItem('skitgubbe_playerName', playerName);
					sessionStorage.setItem('skitgubbe_playerColor', playerColor);
					connectWebSocket();
				} else {
					window.location.href = '/';
				}
			}
		} catch (e) {
			console.error('Failed to authenticate in room:', e);
			window.location.href = '/';
		}
	});

	onDestroy(() => {
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
		}
		if (overlayTimeout) {
			clearTimeout(overlayTimeout);
		}
		if (socket) {
			socket.onclose = null;
			socket.close();
		}
	});

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
		if (isReplaying || !isHumanTurn || !gameState) return;

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
			sendWsMessage({
				type: 'playCards',
				cardIds: randomPlay.map((c) => c.id),
				debugForce: godMode || undefined
			});
			return;
		}

		if (gameState.phase === 1 && gameState.deck.length > 0) {
			sendWsMessage({ type: 'chance', debugForce: godMode || undefined });
			return;
		}

		if (gameState.phase === 2 && gameState.tablePile.length > 0) {
			sendWsMessage({ type: 'pickUp', debugForce: godMode || undefined });
			return;
		}
	}

	$effect(() => {
		if (autoplay && isHumanTurn && gameState && !isReplaying) {
			const timer = setTimeout(() => {
				untrack(() => {
					if (autoplay && isHumanTurn && gameState && !isReplaying) {
						triggerAutoplay();
					}
				});
			}, 1000);
			return () => clearTimeout(timer);
		}
	});

	function handleSprinkleClick() {
		if (isReplaying) return;
		if (!isStroValid) return;
		addAnimatingCardIds(selectedCardIds);
		sendWsMessage({ type: 'sprinkle', cardIds: selectedCardIds });
		selectedCardIds = [];
	}

	function handleChanceClick() {
		if (isReplaying) return;
		if (gameState?.phase !== 1 || !isHumanTurn || gameState.deck.length === 0) return;
		sendWsMessage({ type: 'chance', debugForce: godMode || undefined });
	}

	function handlePickUpClick() {
		if (isReplaying) return;
		if (!isHumanTurn || gameState?.phase !== 2) return;
		sendWsMessage({ type: 'pickUp', debugForce: godMode || undefined });
	}

	function handleResetGameClick() {
		if (isReplaying) return;
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
				if (!card) {
					activeDraggedCardId = null;
					dragStartPos = null;
					return;
				}
				if (isPlayableGroup([card])) {
					// Card is playable! Select it and deselect others
					selectedCardIds = [activeDraggedCardId];
					cardsBeingDragged = [activeDraggedCardId];
				} else {
					// Card is not playable (or not our turn), but we still allow dragging it.
					// We do not select it so we don't mess up any selected state, but we allow moving it around.
					cardsBeingDragged = [activeDraggedCardId];
				}
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

					if (validity) {
						if (isReplaying) {
							// Cancel play: do nothing, let the card snap back
						} else {
							// Capture current dragged positions before state is reset
							cardsBeingDragged.forEach((id) => {
								const el = document.querySelector(`.hand-card[data-card-id="${id}"]`);
								if (el) {
									droppedCardRects.set(id, el.getBoundingClientRect());
								}
								pendingPlayOffsets[id] = { ...dragOffset };
							});

							if (validity === 'sprinkle') {
								sendWsMessage({ type: 'sprinkle', cardIds: cardsBeingDragged });
								if (selectedCardIds.includes(activeDraggedCardId)) {
									selectedCardIds = [];
								}
							} else if (validity === 'play') {
								sendWsMessage({
									type: 'playCards',
									cardIds: cardsBeingDragged,
									debugForce: godMode || undefined
								});
								if (selectedCardIds.includes(activeDraggedCardId)) {
									selectedCardIds = [];
								}
							}
						}
					} else {
						if (isHumanTurn) {
							errorMessage = 'Invalid play';
							setTimeout(() => {
								if (errorMessage === 'Invalid play') errorMessage = '';
							}, 4000);
						}
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

		const now = Date.now();
		const isDoubleClick = lastClickedCardId === cardId && now - lastClickTime < 300;
		lastClickedCardId = cardId;
		lastClickTime = now;

		if (isDoubleClick) {
			const card = humanHand.find((c) => c.id === cardId);
			if (card) {
				// Click 1 already toggled selection, so otherSelected cards are current selectedCardIds excluding cardId
				const otherSelected = humanHand.filter(
					(c) => selectedCardIds.includes(c.id) && c.id !== cardId
				);
				const cardsToPlay = [card, ...otherSelected];
				const validity = checkDropValidity(cardsToPlay);

				if (validity) {
					if (isReplaying) return;
					const playIds = cardsToPlay.map((c) => c.id);
					addAnimatingCardIds(playIds);
					sendWsMessage({
						type: validity === 'sprinkle' ? 'sprinkle' : 'playCards',
						cardIds: playIds,
						debugForce: godMode || undefined
					});
					selectedCardIds = [];
					return;
				}

				// Otherwise try to play just the double-clicked card by itself
				const singleValidity = checkDropValidity([card]);
				if (singleValidity) {
					if (isReplaying) return;
					addAnimatingCardIds([cardId]);
					sendWsMessage({
						type: singleValidity === 'sprinkle' ? 'sprinkle' : 'playCards',
						cardIds: [cardId],
						debugForce: godMode || undefined
					});
					selectedCardIds = selectedCardIds.filter((id) => id !== cardId);
					return;
				}
			}
			// If neither play is valid, toggle selection back to original state
			handleCardClick(idx, cardId);
		} else {
			handleCardClick(idx, cardId);
		}
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

	const gameWinner = $derived(
		gameState?.players.find((p) => p.isDone && !gameState?.players.some((op) => op.isSkitgubbe)) ??
			null
	);
	const skitgubbe = $derived(gameState?.players.find((p) => p.isSkitgubbe) ?? null);

	const handCount = $derived(humanHand.length);
	const deckShadowStyle = $derived(gameState ? getDeckShadowStyle(gameState.deck.length) : '');

	// FLIP transition coordinate mapping
	const cardRects = new Map<string, DOMRect>();
	const droppedCardRects = new Map<string, DOMRect>();
	let capturedTrickWinnerId: string | null = null;
	let capturedActivePlayerId: string | null = null;

	let lastClickedCardId: string | null = null;
	let lastClickTime = 0;
	let animatingPlayCardIds = $state<string[]>([]);

	function addAnimatingCardIds(ids: string[]) {
		animatingPlayCardIds = [...animatingPlayCardIds, ...ids];
		setTimeout(() => {
			animatingPlayCardIds = animatingPlayCardIds.filter((id) => !ids.includes(id));
		}, 1200);
	}

	function captureCardRects() {
		cardRects.clear();
		capturedTrickWinnerId = gameState?.trickWinnerId || null;
		capturedActivePlayerId = gameState
			? gameState.players[gameState.activePlayerIdx]?.id || null
			: null;
		const cardEls = document.querySelectorAll('[data-card-id]');
		cardEls.forEach((el) => {
			const cardId = el.getAttribute('data-card-id');
			if (cardId) {
				const hasFlyUp = el.classList.contains('playing-fly-up');
				if (hasFlyUp) {
					el.classList.remove('playing-fly-up');
					cardRects.set(cardId, el.getBoundingClientRect());
					el.classList.add('playing-fly-up');
				} else {
					cardRects.set(cardId, el.getBoundingClientRect());
				}
			}
		});

		// Merge in dropped card rects
		droppedCardRects.forEach((rect, id) => {
			cardRects.set(id, rect);
		});
		droppedCardRects.clear();
	}

	function cardOut(node: HTMLElement, params: { id: string }) {
		// 1. If entering another player's hand in the new state, or entering the table pile, hide immediately
		if (gameState) {
			const isInAnyHand = gameState.players.some((p) => p.hand.some((c) => c.id === params.id));
			const isOnTable = gameState.tablePile.some((batch) => batch.some((c) => c.id === params.id));
			if (isInAnyHand || (isOnTable && (endGameStage === 'none' || endGameStage === 'paused'))) {
				return {
					duration: 50,
					css: (t: number) => `opacity: 0;`
				};
			}
		}

		// 2. If trick won or picked up, slide to player avatar (in Phase 1) or active player avatar (in Phase 2 pickup)
		const isTrickWon = !!capturedTrickWinnerId;
		const isPhase2 = gameState?.phase === 2;

		if (endGameStage !== 'none') {
			// Skip sliding to player avatar at the end of the game; let it fly to the discard/deck pile (Section 3)
		} else if (isTrickWon && isPhase2) {
			// Skip sliding to player avatar; let it fall through to discard pile (Section 3)
		} else {
			const targetPlayerId = capturedTrickWinnerId || (isPhase2 ? capturedActivePlayerId : null);
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

						const origRect = cardRects.get(params.id) || rect;
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

		// 3. Otherwise slide to discard pile (burned)
		const discardEl = document.querySelector('[data-discard]') || document.querySelector('[data-deck]');
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

			const origRect = cardRects.get(params.id) || rect;
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
						// Stage 1: Stack to center (t: 1.0 -> 0.7)
						const progress = (1 - t) / 0.3;
						const ease = cubicOut(progress);
						x = dxOrig + (dxCenter - dxOrig) * ease;
						y = dyOrig + (dyCenter - dyOrig) * ease;
					} else if (t >= 0.4) {
						// Stage 2: Flip over at center (t: 0.7 -> 0.4)
						const progress = (0.7 - t) / 0.3;
						const ease = cubicInOut(progress);
						x = dxCenter;
						y = dyCenter;
						rotateY = 180 * ease;
					} else {
						// Stage 3: Fly to discard (t: 0.4 -> 0.0)
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
	}

	function cardIn(node: HTMLElement, params: { id: string; playerId?: string; card?: Card }) {
		const rect = node.getBoundingClientRect();
		let prevRect = cardRects.get(params.id);
		const cameFromHand = cardRects.has(params.id);

		const isLocalPlayer =
			params.playerId && (params.playerId === playerId || params.playerId === yourPlayerId);
		const recentLogs = gameState?.logs.slice(-5) || [];
		const isChancePlay = isLocalPlayer
			? !cameFromHand
			: !!(
					params.card &&
					recentLogs.some(
						(log) =>
							log.toLowerCase().includes('chanced') &&
							log.includes(`${params.card!.value}${params.card!.suit}`)
					)
				);

		// If played by another player, slide from their avatar (unless they chanced it from the deck)
		if (!prevRect && params.playerId) {
			if (isChancePlay) {
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

		// If drawn from deck, slide from deck (unless it's initial reconnect, then flip in-place)
		const isInitialReconnect = reconnectCardIds.has(params.id);
		if (!prevRect) {
			if (isInitialReconnect) {
				prevRect = rect;
			} else {
				const deckEl = document.querySelector('[data-deck]');
				if (deckEl) {
					prevRect = deckEl.getBoundingClientRect();
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

			const relIndex = newCardRelativeIndices.get(params.id) ?? 0;
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
<Confetti bind:this={confettiRef} />

<!-- Disconnected Overlay -->
{#if showDisconnectedOverlay}
	<div
		class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
		transition:fade
	>
		<div
			class="premium-modal-container flex flex-col items-center gap-4 border-red-500/20 p-8 text-center"
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

<div
	class="game-layout relative flex h-screen w-screen flex-col justify-between overflow-hidden select-none"
	class:shake-active={shakeActive}
	style="--card-width: {cardWidth}px; --card-height: {cardWidth *
		1.4}px; --hand-container-height: {cardWidth * 1.4 * 1.35}px;"
>
	<!-- Top Container: Sidebars and Center Game Board -->
	<div class="flex w-full flex-grow">
		<!-- Left Sidebar: Draw, Discard, and Trump -->
		<div class="left-sidebar relative z-10 flex flex-shrink-0 flex-col items-center justify-center">
			<!-- Trump Box -->
			<div
				class="compact-pile-box flex w-full items-center justify-start gap-2"
				class:invisible={(gameState?.phase || 1) === 1}
			>
				<!-- Stable size container for card/slot transitions -->
				<div
					class="relative"
					style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);"
				>
					{#if gameState?.trumpCard}
						<div
							data-trump
							data-card-id={gameState.trumpCard.id}
							class="absolute inset-0 cursor-default rounded"
							transition:fade
						>
							<CardFace
								card={gameState.trumpCard}
								isTrump={true}
								class="h-full w-full shadow-md"
								style="padding: 1px; border: 1.5px solid #ffd700; border-radius: 4px;"
							/>
						</div>
					{:else if gameState?.hiddenTrumpStorage}
						{@const owner = gameState.players.find(
							(p) => p.id === (gameState ? gameState.hiddenTrumpStorage?.playerId : '')
						)}
						<div
							class="absolute inset-0 flex flex-col items-center justify-center rounded border border-dashed border-slate-700 bg-slate-950/20 p-0.5 text-center font-mono text-[6px] leading-none text-slate-500"
							transition:fade
						>
							<span
								>HÅLLEN AV<br />{owner?.id === playerId ? 'DIG' : owner?.name.toUpperCase()}</span
							>
						</div>
					{:else}
						<div
							class="absolute inset-0 flex flex-col items-center justify-center rounded border border-dashed border-slate-800 bg-slate-950/5 font-mono text-[7px] leading-none text-slate-600"
							transition:fade
						>
							<span>NONE</span>
						</div>
					{/if}
				</div>

				<!-- Unified stable text labels -->
				<div class="flex flex-col select-none">
					<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Trump</span>
					{#if gameState?.trumpCard}
						<span
							class="max-w-[65px] truncate font-mono text-[9px] font-bold text-yellow-400 uppercase"
							>{gameState.trumpCard.suitName}</span
						>
					{:else if gameState?.hiddenTrumpStorage}
						<span class="font-mono text-[9px] text-slate-500 uppercase">Hidden</span>
					{:else}
						<span class="font-mono text-[9px] text-slate-500 uppercase">None</span>
					{/if}
				</div>
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
								<CardBack
									class="h-full w-full"
									style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
								/>
							{:else}
								<div
									class="flex h-full w-full items-center justify-center rounded border border-dashed border-emerald-700/60 bg-emerald-950/40 font-mono text-[7px] font-bold text-emerald-600/70"
								>
									Tomt
								</div>
							{/if}
						</div>
						<div class="flex flex-col select-none">
							<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Drag</span>
							<span class="font-mono text-[10px] font-bold text-yellow-400"
								>{gameState.deck.length} kvar</span
							>
						</div>
					</div>
					{#if gameState.deck.length > 0}
						<button
							onclick={handleChanceClick}
							disabled={!isHumanTurn}
							class="gold-trimmed-btn mt-1 w-full py-1.5 font-serif text-xs font-bold tracking-wider uppercase"
						>
							Chansa
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
							<CardBack
								class="animate-fade-in h-full w-full"
								style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"
							/>
						{/if}
					</div>
					<div class="flex flex-col select-none">
						<span class="font-mono text-[8px] tracking-wider text-slate-400 uppercase">Släng</span>
						<span class="font-mono text-[10px] font-bold text-emerald-400"
							>{gameState.discardPile.length} kort</span
						>
					</div>
				</div>
			{/if}

			<!-- WebSocket status indicator -->
			{#if connectionStatus !== 'connected'}
				<div
					class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[9px] whitespace-nowrap text-slate-400"
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
		<div class="relative flex flex-grow flex-col">
			<!-- Top Row: Player status cards -->
			<div class="players-row z-10">
				{#if gameState}
					{#each gameState.players as player, idx (player.id)}
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
								: ''} {player.isDone ? 'escaped' : ''} {player.inviteStatus === 'pending'
								? 'pending-invite opacity-40 grayscale filter'
								: ''} {player.isBot ? 'opacity-60 grayscale filter' : ''}"
						>
							<!-- Left Side: Profile vertical stack -->
							<div class="player-profile-stack">
								<Avatar
									avatarConfig={player.avatarConfig}
									fallbackColor={player.color}
									fallbackName={player.name}
									class="player-avatar h-full w-full"
								/>
								<span class="player-name">
									{player.id === playerId ? 'Du' : player.name}
									{#if player.isBot}
										<span
											class="status-badge block text-[8px] font-bold tracking-wider text-slate-400 uppercase"
											>🤖 BOT</span
										>
									{/if}
									{#if player.isSkitgubbe}
										<span class="status-badge text-red-500"></span>
									{:else if player.inviteStatus === 'pending'}
										<span
											class="status-badge text-amber-550 block text-[8px] font-bold tracking-wider uppercase"
											>Inbjuden</span
										>
									{/if}
								</span>
							</div>

							<!-- Right Side: Card count symbol -->
							<div class="player-card-badge relative overflow-hidden" class:active-turn={isActive}>
								{#if gameState.phase === 1 ? player.reserveStack.length > 1 : player.hand.length > 1}
									<CardBack
										class="pointer-events-none absolute inset-0 h-full w-full"
										style="border: none; background-size: 8px 8px, 8px 8px, 8px 8px, 100% 100%; z-index: 1;"
									/>
								{/if}
								<div class="relative z-10 flex h-full w-full items-center justify-center">
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

				{#if skitgubbe && endGameStage !== 'none' && endGameStage !== 'paused' && endGameStage !== 'table_clear'}
					<!-- Skitgubbe Loss overlay -->
					<div
						class="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 transition-opacity duration-1000"
						in:fade={{ duration: 600 }}
					>
						<div class="flex h-full w-full flex-row items-center justify-center gap-10 md:gap-16">
							<!-- Left Column: Wanted Poster (Slam Animation) -->
							<div class="flex flex-1 justify-end">
								{#if endGameStage === 'poster_slam'}
									<div class="poster-slam-active relative flex w-[290px] flex-col items-center select-none">
										<!-- Dust Particle Effect (Behind Poster) -->
										{#if showDustEffect}
											<div
												class="absolute pointer-events-none z-0"
												style="width: 680px; height: 680px; top: 50%; left: 50%; transform: translate(-50%, -50%);"
											>
												<!-- Dust 1: Normal Orientation -->
												<div class="absolute inset-0" style="transform: translate(0, 0px) rotate(0deg);">
													<dotlottie-player
														src="/dust1.lottie"
														autoplay
														style="display: block; width: 100%; height: 100%;"
														onready={(e: any) => {
															console.log('Lottie Player 1: Ready');
															e.currentTarget.play();
														}}
														onload={(e: any) => {
															console.log('Lottie Player 1: Loaded /dust1.lottie');
															e.currentTarget.play();
														}}
														onerror={(e: any) => {
															console.error('Lottie Player 1: Error loading /dust1.lottie', e);
														}}
													></dotlottie-player>
												</div>
											</div>
										{/if}

										<div class="skitgubbe-poster pointer-events-none w-full" style="z-index: 10;">
											<div class="absolute inset-x-0 bottom-0 flex h-[75%] flex-col items-center justify-center gap-2 pb-[12%]">
												<div class="relative flex aspect-square w-[48%] items-center justify-center overflow-hidden rounded-2xl border border-[#2e2315]/20 bg-[#1e1b18] p-0">
													<Avatar
														avatarConfig={skitgubbe.avatarConfig}
														fallbackColor="#1e1b18"
														fallbackName={skitgubbe.name}
														class="h-full w-full rounded-2xl"
													/>
													<div class="absolute inset-0 bg-radial from-white/5 to-transparent"></div>
												</div>
												<span class="skitgubbe-poster-name max-w-[85%] truncate leading-none">
													{skitgubbe.name}
												</span>
											</div>
										</div>
									</div>
								{/if}
							</div>

							<!-- Right Column: Fanned Cards (Fly one-by-one) -->
							<div class="flex flex-1 flex-col items-start justify-center">
								<div
									class="relative flex items-center justify-center"
									style="height: calc(var(--card-height) * 1.15); width: 320px;"
								>
									{#each skitgubbe.hand as card, idx (card.id)}
										{@const N = skitgubbe.hand.length}
										{@const spacing = Math.min(32, 220 / N)}
										{@const xOffset = (idx - (N - 1) / 2) * spacing}
										{@const yOffset = Math.abs(idx - (N - 1) / 2) * 2}
										{@const rot = (idx - (N - 1) / 2) * 4}
										{@const startX = loserAvatarPos ? loserAvatarPos.x - (innerWidth * 0.75) : 0}
										{@const startY = loserAvatarPos ? loserAvatarPos.y - (innerHeight * 0.5) : -200}

										<div
											class="card-reveal-fly absolute select-none"
											style="
												--start-x: {startX}px;
												--start-y: {startY}px;
												--card-x-offset: {xOffset}px;
												--card-y-offset: {yOffset}px;
												--card-rot: {rot}deg;
												animation-delay: {idx * 250}ms;
												left: 50%;
												margin-left: calc(-1 * var(--card-width) / 2);
											"
										>
											<div
												class="inner-card-flip-active relative"
												style="
													width: var(--card-width);
													height: var(--card-height);
													transform-style: preserve-3d;
													animation-delay: {idx * 250}ms;
												"
											>
												<!-- Front of Card -->
												<CardFace
													{card}
													isTrump={false}
													class="shadow-lg"
													style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
												/>

												<!-- Back of Card -->
												<CardBack
													style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
												/>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				{/if}


				<!-- Cards currently in play -->
				{#if gameState && gameState.phase === 1}
					<!-- Phase 1 Layout: Groups of played cards arranged side-by-side -->
					<div class="table-pile-container flex items-center justify-center gap-4 overflow-visible">
						{#each gameState.tablePile as batch, idx (gameState.tablePilePlayers[idx] + '-' + (batch[0]?.id || ''))}
							{@const playerIdOfBatch = gameState.tablePilePlayers[idx]}
							{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center gap-2">
								<span
									class="rounded border border-emerald-800/30 bg-emerald-950/50 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-300"
									out:fade={{ duration: 300 }}
								>
									{player?.id === playerId ? 'Du' : player?.name}
								</span>
								<div class="semi-stacked-pile">
									{#each batch as card, cardIdx (card.id)}
										{#if endGameStage === 'none' || endGameStage === 'paused'}
											<div
												class="card relative cursor-default"
												data-card-id={card.id}
												in:cardIn|global={{ id: card.id, playerId: playerIdOfBatch, card }}
												out:cardOut|global={{ id: card.id }}
											>
												<div class="relative h-full w-full" style="transform-style: preserve-3d;">
													<!-- Front of Card -->
													<CardFace
														{card}
														isTrump={!!trumpSuit && card.suitName === trumpSuit}
														class="shadow-md"
														style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
													/>

													<!-- Back of Card (for flip transition) -->
													<CardBack
														style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
													/>
												</div>
											</div>
										{/if}
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
						{#each gameState.tablePile as batch, batchIdx (gameState.tablePilePlayers[batchIdx] + '-' + (batch[0]?.id || ''))}
							{@const playerIdOfBatch = gameState.tablePilePlayers[batchIdx]}
							{@const player = gameState.players.find((p) => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center">
								<span
									class="mb-1 font-mono text-[9px] font-bold text-slate-400"
									out:fade={{ duration: 300 }}
								>
									{player?.id === playerId ? 'Du' : player?.name}
								</span>
								<div
									class="semi-stacked-pile rounded-lg border border-emerald-900/30 bg-emerald-950/20 p-1 shadow-inner"
								>
									{#each batch as card, cardIdx (card.id)}
										{#if endGameStage === 'none' || endGameStage === 'paused'}
											<div
												class="card relative cursor-default"
												data-card-id={card.id}
												in:cardIn|global={{ id: card.id, playerId: playerIdOfBatch, card }}
												out:cardOut|global={{ id: card.id }}
											>
												<div class="relative h-full w-full" style="transform-style: preserve-3d;">
													<!-- Front of Card -->
													<CardFace
														{card}
														isTrump={!!trumpSuit && card.suitName === trumpSuit}
														class="shadow-md"
														style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
													/>

													<!-- Back of Card (for flip transition) -->
													<CardBack
														style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
													/>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</main>
		</div>
	</div>

	<!-- Exit to Lobby Button in Top Left -->
	<a
		href="/"
		class="gold-trimmed-btn absolute top-4 left-4 z-30 h-10 w-10"
		class:pulse-exit={endGameStage === 'poster_slam'}
		title="Exit to Lobby"
		aria-label="Exit to lobby"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.5"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1"
			/>
		</svg>
	</a>

	<!-- Toggle Logs Button in Top Right -->
	<button
		onclick={() => (showLogs = !showLogs)}
		class="gold-trimmed-btn absolute top-4 right-4 z-30 h-10 w-10"
		title="Toggle Game Log"
		aria-label="Toggle game log"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-5 w-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
		</svg>
	</button>

	<!-- Floating Logs Panel -->
	{#if showLogs}
		<div
			transition:fade={{ duration: 150 }}
			class="premium-modal-container absolute top-16 right-4 z-30 flex max-h-[calc(var(--app-height)*0.7)] w-80 flex-col gap-2.5 p-4"
		>
			<div class="modal-header-glass flex items-center justify-between pb-2">
				<span class="logs-title flex items-center gap-2">
					<span class="font-mono text-xs font-bold tracking-wider text-amber-400 uppercase"
						>Log</span
					>
					<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"></span>
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
			<div class="logs-panel premium-inner-box flex flex-grow flex-col gap-2.5 overflow-y-auto p-3">
				{#if gameState}
					{#each gameState.logs as log}
						<div class="log-entry text-[11px] break-words">
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
						disabled={isReplaying}
						class="pick-up-btn cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						PLOCKA
					</button>
				{/if}
				{#if isStroValid}
					<button
						onclick={handleSprinkleClick}
						disabled={isReplaying}
						class="lay-cards-btn cursor-pointer rounded-lg border border-teal-500/20 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-lg transition-all duration-300 hover:from-emerald-400 hover:to-teal-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
					>
						STRÖ ({selectedCardIds.length})
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
						class:non-playable={(isHumanTurn || anyCardPlayable) && !isPlayable}
						class:playing-fly-up={animatingPlayCardIds.includes(card.id)}
						style="{getCardStyle(
							card.id,
							i,
							isSelected,
							isHovered,
							xPosition
						)}{cardsBeingDragged.includes(card.id)
							? `; transform: translate(calc(var(--x-pos) + ${dragOffset.x}px), calc(var(--lift) + ${dragOffset.y}px)) scale(1.05) !important; z-index: 10000 !important; transition: none !important;`
							: pendingPlayOffsets[card.id]
								? `; transform: translate(calc(var(--x-pos) + ${pendingPlayOffsets[card.id].x}px), calc(var(--lift) + ${pendingPlayOffsets[card.id].y}px)) scale(1.05) !important; z-index: 10000 !important; transition: none !important;`
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
						tabindex={isReplaying ? -1 : 0}
						aria-label="{card.value} of {card.suitName}"
						data-card-id={card.id}
						in:cardIn|global={{ id: card.id }}
						out:cardOut|global={{ id: card.id }}
					>
						<div
							class="relative h-full w-full"
							style="transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1); transition-delay: {isReplaying
								? '0ms'
								: i * 100 + 'ms'}; transform: rotateY({isReplaying ? 180 : 0}deg);"
						>
							<!-- Front of Card -->
							<CardFace
								{card}
								isTrump={!!trumpSuit && card.suitName === trumpSuit}
								class="shadow-md"
								style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(0deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
							/>

							<!-- Back of Card (for flip transition) -->
							<CardBack
								style="backface-visibility: hidden; -webkit-backface-visibility: hidden; transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
							/>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</footer>
</div>

<!-- Debug Menu Floating Action Button and Panel -->
{#if allowDevSettings}
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

			<!-- God Mode Toggle -->
			<button
				onclick={() => (godMode = !godMode)}
				class="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all {godMode
					? 'border-red-500/40 bg-red-500/10 text-red-300'
					: 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}"
			>
				<span>God Mode (Play Anytime)</span>
				<span
					class="h-2.5 w-2.5 rounded-full {godMode ? 'animate-pulse bg-red-500' : 'bg-slate-700'}"
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

				<button
					onclick={() => sendWsMessage({ type: 'debugForceLose' })}
					class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-red-500/40 hover:text-red-400"
				>
					💀 Force Skitgubbe Loss
				</button>
			{/if}

			<!-- Reset Game -->
			{#if isHost}
				<button
					onclick={handleResetGameClick}
					class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-red-500/40 hover:text-red-400"
				>
					🔄 Reset Game
				</button>
			{/if}

			<!-- Test Confetti -->
			<button
				onclick={() => confettiRef?.fire()}
				class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-emerald-500/40 hover:text-emerald-400"
			>
				🎉 Test Confetti
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
{/if}

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
		<h2>Rotera mobilen!</h2>
		<p>Spelet är anpassat för horisontellt läge. Rotera mobilen för att spela!</p>
	</div>
</div>

<style>
	:global(.card.transitioning) {
		transition: none !important;
	}

	.hand-card.playing-fly-up {
		transform: translate(var(--x-pos), calc(var(--app-height) * -0.45)) scale(1.1) rotate(0deg) !important;
		opacity: 0 !important;
		transition:
			transform 0.4s cubic-bezier(0.25, 1, 0.5, 1),
			opacity 0.4s ease !important;
		z-index: 10000 !important;
		pointer-events: none;
	}

	.hand-card {
		position: absolute;
		bottom: 0;
		left: 50%;
		margin-left: calc(-1 * var(--card-width) / 2);
		transform: translate(var(--x-pos), var(--lift)) scale(var(--scale));
		z-index: var(--z-index);
		touch-action: none;
		transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
	}

	:global(.board-game-zone.drag-over-valid) {
		box-shadow: inset 0 0 50px rgba(16, 185, 129, 0.25) !important;
		background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 80%) !important;
		transition:
			background 0.3s ease,
			box-shadow 0.3s ease;
	}

	/* Skitgubbe Poster Display */
	.skitgubbe-poster {
		position: relative;
		width: 100%;
		max-width: 290px;
		aspect-ratio: 1792 / 2400;
		background-image: url('/skitgubbe_transparent.webp');
		background-size: contain;
		background-position: center;
		background-repeat: no-repeat;
		filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.6));
		background-color: transparent;
		border: none;
		padding: 0;
		display: block;
	}

	.skitgubbe-poster-name {
		font-family: 'Nanum Brush Script', cursive;
		font-size: 2.2rem;
		font-weight: 700;
		color: #2e2315; /* dark ink color on parchment */
		margin-top: 0.35rem;
		text-shadow: 0.5px 0.5px 1px rgba(255, 255, 255, 0.4);
	}

	/* Card fly-in animation */
	@keyframes card-fly-in {
		0% {
			transform: translate(var(--start-x), var(--start-y)) scale(0.2);
			opacity: 0;
		}
		100% {
			transform: translate(var(--card-x-offset), var(--card-y-offset)) scale(1) rotate(var(--card-rot));
			opacity: 1;
		}
	}
	.card-reveal-fly {
		animation: card-fly-in 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
		transform-style: preserve-3d;
	}

	/* Inner card flip animation (from face down to face up) */
	@keyframes inner-card-flip {
		0% {
			transform: rotateY(180deg);
		}
		30% {
			transform: rotateY(180deg);
		}
		100% {
			transform: rotateY(0deg);
		}
	}
	.inner-card-flip-active {
		animation: inner-card-flip 0.6s ease-in-out forwards;
	}

	/* Wanted Poster slam animation */
	@keyframes poster-slam {
		0% {
			transform: scale(4) rotate(-10deg);
			opacity: 0;
			filter: drop-shadow(0 100px 50px rgba(0, 0, 0, 0.9));
		}
		80% {
			transform: scale(1.05) rotate(2deg);
			opacity: 1;
		}
		100% {
			transform: scale(1) rotate(0deg);
			opacity: 1;
			filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.8));
		}
	}
	.poster-slam-active {
		animation: poster-slam 0.35s cubic-bezier(0.215, 0.610, 0.355, 1.000) forwards;
	}

	/* Screenshake viewport effect */
	@keyframes screenshake {
		0% { transform: translate(0, 0) rotate(0deg); }
		10% { transform: translate(-3px, 2px) rotate(-1deg); }
		20% { transform: translate(2px, -3px) rotate(1deg); }
		30% { transform: translate(-1px, 2px) rotate(0deg); }
		40% { transform: translate(3px, 1px) rotate(1deg); }
		50% { transform: translate(-2px, -2px) rotate(-1deg); }
		60% { transform: translate(2px, 3px) rotate(0deg); }
		70% { transform: translate(-1px, -1px) rotate(1deg); }
		80% { transform: translate(3px, 2px) rotate(-1deg); }
		90% { transform: translate(-2px, 1px) rotate(0deg); }
		100% { transform: translate(0, 0) rotate(0deg); }
	}
	:global(.shake-active) {
		animation: screenshake 0.4s ease-out;
	}

	/* Exit button pulse */
	@keyframes exit-pulse {
		0% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
		}
		70% {
			transform: scale(1.1);
			box-shadow: 0 0 0 10px rgba(245, 158, 11, 0);
		}
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
		}
	}
	:global(.pulse-exit) {
		animation: exit-pulse 1.5s infinite !important;
		border-color: #f59e0b !important;
		color: #f59e0b !important;
	}
</style>
