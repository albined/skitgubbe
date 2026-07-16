import { untrack } from 'svelte';
import {
	isValidPlay,
	getLegalPlays,
	getLegalPlaysPhase1,
	realCards,
	type SanitizedGameState,
	type Card,
	type ChatMessage,
	type ClientMessage,
	type ServerMessage,
	type ApiCurrentSkitgubbe
} from 'shared';
import { env } from '$env/dynamic/public';
import type { CardDragState } from './cardDragState.svelte';
import { CardTransitions } from './cardTransitions.svelte';

const MAX_CHAT_MESSAGES = 100;

export class RoomState {
	roomId: string;
	allowDevSettings = env.PUBLIC_ALLOW_DEV_SETTINGS === 'true';

	// WebSocket & Connection State
	socket: WebSocket | null = null;
	reconnectTimeout: number | undefined = undefined;
	connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	errorMessage = $state<string>('');
	showDisconnectedOverlay = $state(false);
	overlayTimeout: number | undefined = undefined;
	reconnectAttempts = 0;
	isUnloading = false;
	trackedTimeouts = new Set<number>();
	maxChatId = 0;

	// Client info & Local State
	playerId = $state<string>('');
	playerName = $state<string>('');
	playerColor = $state<string>('');

	// Synchronized Server State
	gameState = $state<SanitizedGameState | null>(null);
	yourPlayerId = $state<string>('');
	globalSkitgubbe = $state<ApiCurrentSkitgubbe | null>(null);

	// Replay Controller State
	isReplaying = $state(false);
	replayQueue: SanitizedGameState[] = [];
	replayTimer: number | undefined = undefined;
	godMode = $state(false);

	// Client interaction states
	selectedCardIds = $state<string[]>([]);
	hoveredCardId = $state<string | null>(null);
	focusedCardId = $state<string | null>(null);
	fanCenterIdx = $state(-1);
	autoplay = $state(false);
	showDebugMenu = $state(false);
	showLogs = $state(false);
	showChat = $state(false);
	showEmoteMenu = $state(false);
	chatMessages = $state<ChatMessage[]>([]);
	activeBubbles = $state<
		Map<string, { type: 'chat' | 'emote'; content: string; timestamp: number }>
	>(new Map());
	activeTimeouts = new Map<string, number>();
	lastSeenChatId = $state<number>(0);
	catchUpChatQueue = $state<ChatMessage[]>([]);
	catchUpTimer: number | undefined = undefined;
	waitingForInitialState = false;

	// Skitgubbe game over animation state
	endGameStage = $state<'none' | 'paused' | 'table_clear' | 'cards_reveal' | 'poster_slam'>('none');
	shakeActive = $state(false);
	showDustEffect = $state(false);
	loserAvatarPos = $state<{ x: number; y: number } | null>(null);

	// Confetti reference and escape celebration tracking (bound to the
	// Confetti.svelte instance by the room page)
	confettiRef: { fire: (primaryColorHex?: string) => Promise<void> } | null = null;
	prevDonePlayerIds = new Set<string>();
	isFirstStateUpdate = true;

	// Screen sizing & layout
	containerWidth = $state(800);
	innerHeight = $state(800);
	innerWidth = $state(800);

	copyText = $state('Copy Link');

	// FLIP / card-fly animation state and transitions
	transitions = new CardTransitions(this);

	// Reference to drag state (assigned after initialization)
	dragState: CardDragState | null = null;

	// Derived calculations
	cardWidth = $derived(
		Math.max(52, Math.min(Math.min(this.innerHeight * 0.15, this.innerWidth * 0.14), 125))
	);
	maxHandWidth = $derived(Math.max(this.cardWidth, this.containerWidth - this.cardWidth));
	localPlayer = $derived(this.gameState?.players.find((p) => p.id === this.playerId) || null);
	isHost = $derived(this.localPlayer?.isHost || false);
	// The local player's own hand is never masked on the wire; realCards is a
	// type-level narrowing so rule logic (getLegalPlays, isValidPlay) accepts it.
	humanHand = $derived(this.localPlayer ? realCards(this.localPlayer.hand) : []);
	selectedCards = $derived(this.humanHand.filter((c) => this.selectedCardIds.includes(c.id)));

	isLocalSkitgubbe = $derived(
		(this.globalSkitgubbe && this.playerId === this.globalSkitgubbe.id) ||
			(this.localPlayer?.isSkitgubbe ?? false)
	);

	isHumanTurn = $derived(
		!!(
			this.gameState &&
			this.gameState.status === 'playing' &&
			(this.gameState.players[this.gameState.activePlayerIdx]?.id === this.playerId ||
				this.godMode) &&
			!this.gameState.trickWinnerId &&
			this.localPlayer &&
			!this.localPlayer.isDone &&
			!this.localPlayer.isSkitgubbe
		)
	);

	trumpSuit = $derived(this.gameState?.trumpCard ? this.gameState.trumpCard.suitName : null);

	isStroValid = $derived(
		!!(
			this.gameState &&
			this.gameState.phase === 1 &&
			!this.gameState.trickWinnerId &&
			this.selectedCardIds.length > 0 &&
			(() => {
				const state = this.gameState;
				if (!state) return false;
				if (this.selectedCards.length === 0) return false;
				const firstVal = this.selectedCards[0].value;
				if (!this.selectedCards.every((c) => c.value === firstVal)) return false;
				return state.tablePilePlayers.some(
					(pId, idx) =>
						pId === this.playerId &&
						state.tablePile[idx].length > 0 &&
						state.tablePile[idx][0].value === firstVal
				);
			})()
		)
	);

	activeSpreadCardId = $derived(this.hoveredCardId ?? this.focusedCardId);
	activeSpreadIdx = $derived(
		this.activeSpreadCardId ? this.humanHand.findIndex((c) => c.id === this.activeSpreadCardId) : -1
	);

	roomUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');
	gameWinner = $derived(
		this.gameState?.players.find(
			(p) => p.isDone && !this.gameState?.players.some((op) => op.isSkitgubbe)
		) ?? null
	);
	skitgubbe = $derived(this.gameState?.players.find((p) => p.isSkitgubbe) ?? null);
	handCount = $derived(this.humanHand.length);
	deckShadowStyle = $derived(
		this.gameState ? this.getDeckShadowStyle(this.gameState.deck.length) : ''
	);

	constructor(roomId: string) {
		this.roomId = roomId;

		if (typeof window !== 'undefined') {
			const storedId = localStorage.getItem(`skitgubbe_last_seen_chat_id_${this.roomId}`);
			this.lastSeenChatId = storedId ? parseInt(storedId, 10) : 0;

			window.addEventListener('visibilitychange', this.handleVisibilityChange);
			window.addEventListener('beforeunload', this.handleBeforeUnload);
		}

		$effect(() => {
			if (this.connectionStatus === 'connected') {
				if (this.overlayTimeout) {
					clearTimeout(this.overlayTimeout);
					this.overlayTimeout = undefined;
				}
				this.showDisconnectedOverlay = false;
			} else {
				if (!this.showDisconnectedOverlay && !this.overlayTimeout) {
					this.overlayTimeout = window.setTimeout(() => {
						this.showDisconnectedOverlay = true;
						this.overlayTimeout = undefined;
					}, 1500);
				}
			}
		});

		$effect(() => {
			const skitgubbe = this.skitgubbe;
			if (this.gameState && this.gameState.status === 'ended' && skitgubbe && !this.isReplaying) {
				if (this.endGameStage === 'none') {
					this.endGameStage = 'paused';

					this.trackTimeout(() => {
						const loserEl = document.querySelector(`[data-player-id="${skitgubbe.id}"]`);
						if (loserEl) {
							const rect = loserEl.getBoundingClientRect();
							this.loserAvatarPos = {
								x: rect.left + rect.width / 2,
								y: rect.top + rect.height / 2
							};
						}
					}, 100);

					this.trackTimeout(() => {
						this.endGameStage = 'table_clear';

						this.trackTimeout(() => {
							this.endGameStage = 'cards_reveal';

							const cardCount = skitgubbe.hand.length;
							const cardsRevealTime = cardCount * 250 + 1000;

							this.trackTimeout(() => {
								this.endGameStage = 'poster_slam';

								this.trackTimeout(() => {
									this.shakeActive = true;
									this.showDustEffect = true;
									this.trackTimeout(() => {
										this.shakeActive = false;
									}, 400);
								}, 300);
							}, cardsRevealTime);
						}, 1000);
					}, 1500);
				}
			} else {
				if (this.endGameStage !== 'none') {
					this.endGameStage = 'none';
					this.shakeActive = false;
					this.showDustEffect = false;
					this.loserAvatarPos = null;
				}
			}
		});

		$effect(() => {
			if (this.gameState && this.gameState.status === 'playing') {
				const currentDoneIds = new Set<string>(
					this.gameState.players.filter((p) => p.isDone).map((p) => p.id)
				);

				if (this.isFirstStateUpdate) {
					this.prevDonePlayerIds = currentDoneIds;
					this.isFirstStateUpdate = false;
				} else {
					for (const p of this.gameState.players) {
						if (p.isDone && !this.prevDonePlayerIds.has(p.id)) {
							this.confettiRef?.fire(p.color);
						}
					}
					this.prevDonePlayerIds = currentDoneIds;
				}
			} else if (!this.gameState || this.gameState.status === 'ended') {
				this.prevDonePlayerIds.clear();
				this.isFirstStateUpdate = true;
			}
		});

		$effect(() => {
			if (this.gameState) {
				const activePlayer = this.gameState.players[this.gameState.activePlayerIdx];
				if (this.gameState.phase === 2 && activePlayer && activePlayer.id !== this.playerId) {
					untrack(() => {
						if (this.selectedCardIds.length > 0) {
							this.selectedCardIds = [];
						}
					});
				} else if (this.localPlayer) {
					untrack(() => {
						const filtered = this.selectedCardIds.filter((id) =>
							this.localPlayer!.hand.some((c) => c.id === id)
						);
						if (filtered.length !== this.selectedCardIds.length) {
							this.selectedCardIds = filtered;
						}
					});
				}
			}
		});

		$effect(() => {
			if (this.autoplay && this.isHumanTurn && this.gameState && !this.isReplaying) {
				const timer = setTimeout(() => {
					untrack(() => {
						if (this.autoplay && this.isHumanTurn && this.gameState && !this.isReplaying) {
							this.triggerAutoplay();
						}
					});
				}, 1000);
				return () => clearTimeout(timer);
			}
		});

		$effect(() => {
			if (this.showChat) {
				untrack(() => {
					this.markChatsAsRead();
					this.catchUpChatQueue = [];
					if (this.catchUpTimer) {
						clearTimeout(this.catchUpTimer);
						this.catchUpTimer = undefined;
					}
				});
			}
		});
	}

	async init(): Promise<void> {
		try {
			try {
				const sgRes = await fetch('/api/skitgubbe/current');
				if (sgRes.ok) {
					this.globalSkitgubbe = await sgRes.json();
				}
			} catch (err) {
				console.error('Failed to fetch global skitgubbe:', err);
			}

			const cachedId = sessionStorage.getItem('skitgubbe_playerId');
			const cachedName = sessionStorage.getItem('skitgubbe_playerName');
			const cachedColor = sessionStorage.getItem('skitgubbe_playerColor');

			if (cachedId && cachedName && cachedColor) {
				this.playerId = cachedId;
				this.playerName = cachedName;
				this.playerColor = cachedColor;
				this.connectWebSocket();
			} else {
				const res = await fetch('/api/profiles/me');
				if (res.ok) {
					const profile = await res.json();
					this.playerId = profile.id;
					this.playerName = profile.name;
					this.playerColor = profile.color;
					sessionStorage.setItem('skitgubbe_playerId', this.playerId);
					sessionStorage.setItem('skitgubbe_playerName', this.playerName);
					sessionStorage.setItem('skitgubbe_playerColor', this.playerColor);
					this.connectWebSocket();
				} else {
					window.location.href = '/';
				}
			}
		} catch (e) {
			console.error('Failed to authenticate in room:', e);
			window.location.href = '/';
		}
	}

	getWsUrl(): string {
		const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		if (window.location.hostname === 'localhost') {
			return `${proto}//localhost:3000/api/room/${this.roomId}/ws`;
		}
		return `${proto}//${window.location.host}/api/room/${this.roomId}/ws`;
	}

	connectWebSocket() {
		if (!this.playerId || !this.playerName) return;
		if (
			this.socket &&
			(this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}
		this.connectionStatus = 'connecting';
		this.waitingForInitialState = true;

		const wsUrl = this.getWsUrl();
		this.socket = new WebSocket(wsUrl);

		this.socket.onopen = () => {
			this.connectionStatus = 'connected';
			this.errorMessage = '';
			this.reconnectAttempts = 0;

			const storedSeqStr = localStorage.getItem(`skitgubbe_last_seq_${this.roomId}`);
			const lastSeq = storedSeqStr ? parseInt(storedSeqStr, 10) : undefined;

			this.sendWsMessage({
				type: 'join',
				playerId: this.playerId,
				name: this.playerName,
				color: this.playerColor,
				lastSeq: isNaN(lastSeq as number) ? undefined : lastSeq
			});
		};

		this.socket.onmessage = (event) => {
			try {
				const data: ServerMessage = JSON.parse(event.data);
				if (data.type === 'replay') {
					this.yourPlayerId = data.yourPlayerId;
					this.waitingForInitialState = false;
					this.runReplay(data.states);
				} else if (data.type === 'stateUpdate') {
					if (this.isReplaying) {
						const lastQueued = this.replayQueue[this.replayQueue.length - 1];
						if (
							!lastQueued ||
							(data.state.seq !== undefined &&
								lastQueued.seq !== undefined &&
								data.state.seq > lastQueued.seq)
						) {
							this.replayQueue.push(data.state);
						}
						return;
					}

					const isPlayerInGame = data.state.players.some((p) => p.id === this.playerId);
					if (isPlayerInGame && data.yourPlayerId !== this.playerId) {
						return;
					}

					this.transitions.onStateReceived(data.state, this.playerId || data.yourPlayerId);
					this.gameState = data.state;
					this.yourPlayerId = data.yourPlayerId;
					this.transitions.animatingPlayCardIds = [];
					if (this.dragState) {
						this.dragState.pendingPlayOffsets = {};
					}

					if (this.gameState && this.gameState.seq !== undefined) {
						localStorage.setItem(
							`skitgubbe_last_seq_${this.roomId}`,
							this.gameState.seq.toString()
						);
					}

					if (this.waitingForInitialState) {
						this.waitingForInitialState = false;
						this.playCatchUpChats();
					}
				} else if (data.type === 'chatHistory') {
					this.chatMessages = data.messages.slice(-MAX_CHAT_MESSAGES);
					for (const msg of data.messages) {
						if (msg.id > this.maxChatId) {
							this.maxChatId = msg.id;
						}
					}
					if (this.showChat) {
						this.markChatsAsRead();
					} else {
						const missed = data.messages.filter(
							(msg) => msg.playerId !== this.playerId && msg.id > this.lastSeenChatId
						);
						this.catchUpChatQueue = missed.slice(0, 5);
					}
				} else if (data.type === 'chatMessage') {
					this.chatMessages.push(data);
					if (this.chatMessages.length > MAX_CHAT_MESSAGES) {
						this.chatMessages.shift();
					}
					if (data.id > this.maxChatId) {
						this.maxChatId = data.id;
					}
					if (this.showChat) {
						this.markChatsAsRead();
					}
					if (this.isReplaying) {
						if (data.playerId !== this.playerId) {
							this.catchUpChatQueue.push(data);
						}
					} else {
						this.triggerBubble(data.playerId, data.message, data.emote);
					}
				} else if (data.type === 'error') {
					this.errorMessage = data.message;
					if (this.dragState) {
						this.dragState.pendingPlayOffsets = {};
					}
					this.trackTimeout(() => {
						if (this.errorMessage === data.message) this.errorMessage = '';
					}, 4000);
				}
			} catch (e) {
				console.error('Failed to parse WebSocket message:', e);
			}
		};

		this.socket.onclose = () => {
			this.connectionStatus = 'disconnected';
			if (this.isUnloading || (typeof document !== 'undefined' && document.hidden)) {
				return;
			}
			const calculatedDelay = Math.min(30000, 3000 * Math.pow(2, this.reconnectAttempts));
			const jitter = (Math.random() * 0.4 - 0.2) * calculatedDelay;
			const delay = calculatedDelay + jitter;

			this.reconnectAttempts++;
			this.reconnectTimeout = window.setTimeout(() => this.connectWebSocket(), delay);
		};

		this.socket.onerror = (e) => {
			console.error('WebSocket error:', e);
		};
	}

	sendWsMessage(msg: ClientMessage) {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(msg));
		}
	}

	runReplay(states: SanitizedGameState[]) {
		if (states.length === 0) return;
		this.isReplaying = true;
		this.replayQueue = [...states];

		if (this.replayTimer) {
			clearTimeout(this.replayTimer);
		}

		this.transitions.seedReconnectCards(states[0], this.playerId || this.yourPlayerId);

		let currentIndex = 0;
		this.gameState = this.replayQueue[currentIndex];
		if (this.gameState && this.gameState.seq !== undefined) {
			localStorage.setItem(`skitgubbe_last_seq_${this.roomId}`, this.gameState.seq.toString());
		}

		const nextStep = () => {
			currentIndex++;
			if (currentIndex < this.replayQueue.length) {
				this.transitions.captureCardRects();
				this.gameState = this.replayQueue[currentIndex];
				if (this.gameState && this.gameState.seq !== undefined) {
					localStorage.setItem(`skitgubbe_last_seq_${this.roomId}`, this.gameState.seq.toString());
				}
				this.replayTimer = window.setTimeout(nextStep, 1200);
			} else {
				this.isReplaying = false;
				this.replayQueue = [];
				this.replayTimer = undefined;
				this.playCatchUpChats();
			}
		};

		this.replayTimer = window.setTimeout(nextStep, 1200);
	}

	toggleSelect(cardId: string) {
		if (this.selectedCardIds.includes(cardId)) {
			this.selectedCardIds = this.selectedCardIds.filter((id) => id !== cardId);
		} else {
			const card = this.humanHand.find((c) => c.id === cardId);
			if (!card) return;

			const currentSelected = this.humanHand.filter((c) => this.selectedCardIds.includes(c.id));
			const proposedWithSelected = [...currentSelected, card];
			const proposedAlone = [card];

			if (this.isPlayableGroup(proposedWithSelected)) {
				this.selectedCardIds = [...this.selectedCardIds, cardId];
			} else if (this.isPlayableGroup(proposedAlone)) {
				this.selectedCardIds = [cardId];
			}
		}
	}

	handleCardClick(idx: number, cardId: string) {
		const total = this.humanHand.length;
		if (total > 15) {
			if (this.fanCenterIdx === -1) {
				this.fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
			} else {
				const isFanned = Math.abs(idx - this.fanCenterIdx) <= 2;
				const isEdgemostHandCard = idx <= 1 || idx >= total - 2;

				if (isFanned) {
					const isFanEdge = idx === this.fanCenterIdx - 2 || idx === this.fanCenterIdx + 2;
					if (total >= 20 && isFanEdge && !isEdgemostHandCard) {
						this.fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
					} else {
						this.toggleSelect(cardId);
					}
				} else {
					this.fanCenterIdx = Math.max(2, Math.min(total - 3, idx));
				}
			}
		} else {
			this.toggleSelect(cardId);
		}
	}

	triggerAutoplay() {
		if (this.isReplaying || !this.isHumanTurn || !this.gameState) return;

		const validPlays =
			this.gameState.phase === 2
				? getLegalPlays(this.humanHand, this.gameState.tablePile, this.trumpSuit)
				: getLegalPlaysPhase1(this.humanHand);

		if (validPlays.length > 0) {
			const randomPlay = validPlays[Math.floor(Math.random() * validPlays.length)];
			this.sendWsMessage({
				type: 'playCards',
				cardIds: randomPlay.map((c) => c.id),
				debugForce: this.godMode || undefined
			});
			return;
		}

		if (this.gameState.phase === 1 && this.gameState.deck.length > 0) {
			this.sendWsMessage({ type: 'chance', debugForce: this.godMode || undefined });
			return;
		}

		if (this.gameState.phase === 2 && this.gameState.tablePile.length > 0) {
			this.sendWsMessage({ type: 'pickUp', debugForce: this.godMode || undefined });
			return;
		}
	}

	handleSprinkleClick() {
		if (this.isReplaying) return;
		if (!this.isStroValid) return;
		this.transitions.addAnimatingCardIds(this.selectedCardIds);
		this.sendWsMessage({ type: 'sprinkle', cardIds: this.selectedCardIds });
		this.selectedCardIds = [];
	}

	handleChanceClick() {
		if (this.isReplaying) return;
		if (this.gameState?.phase !== 1 || !this.isHumanTurn || this.gameState.deck.length === 0)
			return;
		this.sendWsMessage({ type: 'chance', debugForce: this.godMode || undefined });
	}

	handlePickUpClick() {
		if (this.isReplaying) return;
		if (!this.isHumanTurn || this.gameState?.phase !== 2) return;
		this.sendWsMessage({ type: 'pickUp', debugForce: this.godMode || undefined });
	}

	handleResetGameClick() {
		if (this.isReplaying) return;
		this.sendWsMessage({ type: 'resetGame' });
	}

	checkDropValidity(cards: Card[]): 'play' | 'sprinkle' | null {
		const state = this.gameState;
		if (!state || cards.length === 0) return null;

		if (this.isHumanTurn) {
			if (isValidPlay(cards, state.tablePile, state.phase, this.trumpSuit)) {
				return 'play';
			}
		}

		if (state.phase === 1 && !state.trickWinnerId) {
			const firstVal = cards[0].value;
			const allSameValue = cards.every((c) => c.value === firstVal);
			const playerHasMatchingOnTable = state.tablePilePlayers.some(
				(pId, idx) =>
					pId === this.playerId &&
					state.tablePile[idx].length > 0 &&
					state.tablePile[idx][0].value === firstVal
			);
			if (allSameValue && playerHasMatchingOnTable) {
				return 'sprinkle';
			}
		}

		return null;
	}

	anyCardPlayable = $derived(
		this.gameState && this.humanHand.some((card) => this.checkDropValidity([card]) !== null)
	);

	isPlayableGroup(cards: Card[]): boolean {
		return this.checkDropValidity(cards) !== null;
	}

	getDeckShadowStyle(count: number): string {
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

	copyRoomUrl() {
		navigator.clipboard.writeText(this.roomUrl);
		this.copyText = 'Copied!';
		this.trackTimeout(() => (this.copyText = 'Copy Link'), 2000);
	}

	trackTimeout(cb: () => void, delay: number): number {
		const id = window.setTimeout(() => {
			try {
				cb();
			} finally {
				this.trackedTimeouts.delete(id);
			}
		}, delay);
		this.trackedTimeouts.add(id);
		return id;
	}

	handleVisibilityChange = () => {
		if (typeof document !== 'undefined') {
			if (document.hidden) {
				if (this.reconnectTimeout) {
					clearTimeout(this.reconnectTimeout);
					this.reconnectTimeout = undefined;
				}
			} else {
				this.reconnectAttempts = 0;
				this.connectWebSocket();
			}
		}
	};

	handleBeforeUnload = () => {
		this.isUnloading = true;
	};

	destroy() {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
		}
		if (this.overlayTimeout) {
			clearTimeout(this.overlayTimeout);
		}
		if (this.replayTimer) {
			clearTimeout(this.replayTimer);
		}
		for (const timeoutId of this.activeTimeouts.values()) {
			clearTimeout(timeoutId);
		}
		this.activeTimeouts.clear();

		for (const timeoutId of this.trackedTimeouts) {
			clearTimeout(timeoutId);
		}
		this.trackedTimeouts.clear();

		if (this.catchUpTimer) {
			clearTimeout(this.catchUpTimer);
			this.catchUpTimer = undefined;
		}

		if (typeof window !== 'undefined') {
			window.removeEventListener('visibilitychange', this.handleVisibilityChange);
			window.removeEventListener('beforeunload', this.handleBeforeUnload);
		}

		if (this.socket) {
			this.socket.onclose = null;
			this.socket.close();
		}
	}

	triggerBubble(playerId: string, message?: string, emote?: string) {
		const content = emote || message || '';
		if (!content) return;

		if (this.activeTimeouts.has(playerId)) {
			clearTimeout(this.activeTimeouts.get(playerId));
		}

		this.activeBubbles.set(playerId, {
			type: emote ? 'emote' : 'chat',
			content,
			timestamp: Date.now()
		});
		this.activeBubbles = new Map(this.activeBubbles);

		const timeoutId = window.setTimeout(() => {
			this.activeBubbles.delete(playerId);
			this.activeBubbles = new Map(this.activeBubbles);
			this.activeTimeouts.delete(playerId);
		}, 4000);

		this.activeTimeouts.set(playerId, timeoutId);
	}

	get unreadChatCount(): number {
		if (this.showChat) return 0;
		return this.chatMessages.filter(
			(msg) => msg.playerId !== this.playerId && msg.id > this.lastSeenChatId
		).length;
	}

	markChatsAsRead() {
		if (this.maxChatId > this.lastSeenChatId) {
			this.lastSeenChatId = this.maxChatId;
			localStorage.setItem(`skitgubbe_last_seen_chat_id_${this.roomId}`, this.maxChatId.toString());
		}
	}

	playCatchUpChats() {
		if (this.catchUpChatQueue.length === 0) return;
		if (this.catchUpTimer) {
			clearTimeout(this.catchUpTimer);
		}

		const nextChat = () => {
			if (this.catchUpChatQueue.length === 0 || this.showChat) {
				this.catchUpChatQueue = [];
				this.catchUpTimer = undefined;
				return;
			}
			const msg = this.catchUpChatQueue.shift();
			if (msg) {
				this.triggerBubble(msg.playerId, msg.message, msg.emote);
			}
			if (this.catchUpChatQueue.length > 0) {
				this.catchUpTimer = this.trackTimeout(nextChat, 500);
			} else {
				this.catchUpTimer = undefined;
			}
		};
		nextChat();
	}
}
