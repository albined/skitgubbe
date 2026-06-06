<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
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
		'#ec4899', // pink
	];

	// Synchronized Server State
	let gameState = $state<GameState | null>(null);
	let yourPlayerId = $state<string>('');

	// Client interaction states
	let selectedCardIds = $state<string[]>([]);
	let hoveredCardId = $state<string | null>(null);
	let focusedCardId = $state<string | null>(null);
	let fanCenterIdx = $state(-1);

	// Screen sizing & layout
	let containerWidth = $state(800);
	let innerHeight = $state(800);
	let innerWidth = $state(800);

	const cardWidth = $derived(
		Math.max(52, Math.min(Math.min(innerHeight * 0.15, innerWidth * 0.14), 125))
	);
	const maxHandWidth = $derived(Math.max(cardWidth, containerWidth - cardWidth));

	// Derived mappings from synchronized game state
	const localPlayer = $derived(gameState?.players.find(p => p.id === playerId) || null);
	const isHost = $derived(localPlayer?.isHost || false);
	const humanHand = $derived(localPlayer ? localPlayer.hand : []);
	const selectedCards = $derived(humanHand.filter(c => selectedCardIds.includes(c.id)));

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

	const isSelectionValid = $derived(
		gameState &&
		isValidPlay(
			selectedCards,
			humanHand,
			gameState.tablePile,
			gameState.phase,
			gameState.tieBreakerActive,
			gameState.tiedPlayerIds,
			playerId,
			trumpSuit
		)
	);

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
			if (!selectedCards.every(c => c.value === firstVal)) return false;
			return state.tablePilePlayers.some((pId, idx) => 
				pId === playerId && state.tablePile[idx].length > 0 && state.tablePile[idx][0].value === firstVal
			);
		})()
	);

	const activeSpreadCardId = $derived(hoveredCardId ?? focusedCardId);
	const activeSpreadIdx = $derived(
		activeSpreadCardId ? humanHand.findIndex(c => c.id === activeSpreadCardId) : -1
	);

	// Dynamic room URL
	const roomUrl = $derived(typeof window !== 'undefined' ? window.location.href : '');
	let copyText = $state('Copy Link');

	function copyRoomUrl() {
		navigator.clipboard.writeText(roomUrl);
		copyText = 'Copied!';
		setTimeout(() => copyText = 'Copy Link', 2000);
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
		if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
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

	// Clear local card selection if it's no longer the client's turn,
	// or filter out cards that are no longer in our hand.
	$effect(() => {
		if (gameState) {
			const activePlayer = gameState.players[gameState.activePlayerIdx];
			if (activePlayer && activePlayer.id !== playerId) {
				untrack(() => {
					if (selectedCardIds.length > 0) {
						selectedCardIds = [];
					}
				});
			} else if (localPlayer) {
				untrack(() => {
					const filtered = selectedCardIds.filter(id => localPlayer.hand.some(c => c.id === id));
					if (filtered.length !== selectedCardIds.length) {
						selectedCardIds = filtered;
					}
				});
			}
		}
	});

	function toggleSelect(cardId: string) {
		if (selectedCardIds.includes(cardId)) {
			selectedCardIds = selectedCardIds.filter(id => id !== cardId);
		} else {
			selectedCardIds = [...selectedCardIds, cardId];
		}
	}

	function handleCardClick(idx: number, cardId: string) {
		if (humanHand.length > 15) {
			if (fanCenterIdx === -1) {
				fanCenterIdx = idx;
			} else {
				const L = Math.max(0, fanCenterIdx - 2);
				const R = Math.min(humanHand.length - 1, fanCenterIdx + 2);
				
				if (humanHand.length >= 20 && (idx === L || idx === R)) {
					fanCenterIdx = idx;
				} else if (Math.abs(idx - fanCenterIdx) <= 2) {
					toggleSelect(cardId);
				} else {
					fanCenterIdx = idx;
				}
			}
		} else {
			toggleSelect(cardId);
		}
	}

	function handleLayCardsClick() {
		if (!isHumanTurn) return;
		sendWsMessage({ type: 'playCards', cardIds: selectedCardIds });
	}

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
			const N_compressed = (total - 1) - N_wide;

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
					const isWideGap = (i >= L && i <= R);
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
		if (isHovered) lift -= cardWidth * 0.20;

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
		return `box-shadow: ${shadow}; transform: translate(${-layers/2}px, ${-layers/2}px);`;
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
					transform: translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg) rotateY(${rotateY}deg);
					opacity: ${t};
				`;
			}
		};
	}

	const gameWinner = $derived(
		gameState?.players.find(p => p.isDone && !gameState?.players.some(op => op.isSkitgubbe))?.name ?? null
	);
	const skitgubbe = $derived(
		gameState?.players.find(p => p.isSkitgubbe)?.name ?? null
	);

	const handCount = $derived(humanHand.length);
	const deckShadowStyle = $derived(gameState ? getDeckShadowStyle(gameState.deck.length) : '');
</script>

<svelte:window bind:innerHeight={innerHeight} bind:innerWidth={innerWidth} onclick={handleWindowClick} />

<div class="felt-overlay"></div>

<!-- Joining Modal Overlay -->
{#if showJoinModal}
	<div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
		<div class="glass-panel max-w-md w-full p-8 rounded-2xl border border-slate-700/30 flex flex-col gap-6 shadow-2xl">
			<div class="text-center">
				<h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">Skitgubbe</h1>
				<p class="text-slate-400 text-xs mt-1">Select your name and avatar color to join room</p>
			</div>

			<div class="flex flex-col gap-2">
				<label for="username" class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
				<input 
					id="username"
					type="text" 
					bind:value={tempName}
					placeholder="Enter your name" 
					class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-medium"
					maxlength="15"
				/>
			</div>

			<div class="flex flex-col gap-2">
				<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avatar Color</span>
				<div class="grid grid-cols-6 gap-3">
					{#each PRESET_COLORS as color}
						<button 
							onclick={() => tempColor = color} 
							class="w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110 cursor-pointer shadow-md"
							style="background-color: {color}; border-color: {tempColor === color ? '#ffd700' : 'transparent'};"
							aria-label="Select color {color}"
						></button>
					{/each}
				</div>
			</div>

			{#if joinError}
				<span class="text-red-400 text-xs text-center font-semibold">{joinError}</span>
			{/if}

			<button 
				onclick={handleJoinConfirm}
				class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold tracking-wide transition-all duration-300 active:scale-95 shadow-lg border border-yellow-500/20"
			>
				JOIN GAME
			</button>
		</div>
	</div>
{/if}

<!-- Waiting Lobby Overlay -->
{#if gameState && gameState.status === 'waiting'}
	<div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 flex items-center justify-center p-4">
		<div class="glass-panel max-w-xl w-full p-8 rounded-2xl border border-slate-700/30 flex flex-col gap-8 shadow-2xl">
			
			<div class="text-center">
				<span class="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
					Room Lobby
				</span>
				<h2 class="text-2xl font-extrabold text-white mt-3">Waiting for players to join...</h2>
				
				<!-- Room Link -->
				<div class="mt-4 flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 max-w-sm mx-auto">
					<span class="text-xs font-mono text-slate-400 select-all truncate">{roomUrl}</span>
					<button 
						onclick={copyRoomUrl}
						class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 active:scale-95 transition-all cursor-pointer shadow border border-slate-700/40"
					>
						{copyText}
					</button>
				</div>
			</div>

			<!-- Joined Players list -->
			<div class="flex flex-col gap-3">
				<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Players ({gameState.players.length})</span>
				<div class="flex flex-col gap-2 bg-slate-900/50 border border-slate-850 rounded-xl p-4">
					{#each gameState.players as p}
						<div class="flex items-center gap-3 py-1 border-b border-slate-800/40 last:border-0">
							<div class="w-4 h-4 rounded-full" style="background-color: {p.color};"></div>
							<span class="text-sm font-semibold text-white flex items-center gap-2">
								{p.name}
								{#if p.id === playerId}
									<span class="text-[9px] text-amber-400 font-mono font-bold uppercase tracking-widest">(You)</span>
								{/if}
								{#if p.isHost}
									<span class="text-[9px] text-yellow-500 font-mono font-bold uppercase tracking-widest bg-yellow-950/30 border border-yellow-800/20 px-1.5 py-0.5 rounded">Host</span>
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
						class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 disabled:from-slate-850 disabled:to-slate-900 disabled:text-slate-500 text-slate-950 font-bold tracking-wide transition-all duration-300 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-lg border border-yellow-500/20"
					>
						{gameState.players.length < 2 ? 'NEED AT LEAST 2 PLAYERS' : 'START GAME'}
					</button>
				{:else}
					<div class="text-center py-3 text-xs text-amber-400 font-medium animate-pulse flex items-center justify-center gap-2 bg-amber-950/15 border border-amber-900/20 rounded-xl">
						<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
						Waiting for host to start the game...
					</div>
				{/if}
			</div>

		</div>
	</div>
{/if}

<div class="game-layout relative w-screen h-screen flex flex-col justify-between select-none overflow-hidden" style="--card-width: {cardWidth}px; --card-height: {cardWidth * 1.4}px; --hand-container-height: {cardWidth * 1.4 * 1.35}px;">
	
	<!-- Top Container: Sidebars and Center Game Board -->
	<div class="flex-grow flex w-full overflow-hidden">
		
		<!-- Left Sidebar: Draw, Discard, and Trump -->
		<div class="left-sidebar flex flex-col items-center justify-start flex-shrink-0 z-10">
			
			<div class="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest mt-1 mb-2">
				Phase {gameState?.phase || 1}
			</div>

			<!-- Trump Box -->
			<div class="compact-pile-box w-full flex items-center justify-start gap-2">
				{#if gameState?.trumpCard}
					<div class="rounded relative cursor-default" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<div class="card-face shadow-md" style="padding: 1px; border: 1.5px solid #ffd700; border-radius: 4px;">
							<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
								<rect width="125" height="175" rx="12" fill="#ffffff" />
								<text x="14" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{gameState.trumpCard.value}</text>
								<text x="14" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{gameState.trumpCard.suit}</text>
								
								<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="56" fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{gameState.trumpCard.suit}</text>
								
								<g transform="rotate(180 62.5 87.5)">
									<text x="14" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{gameState.trumpCard.value}</text>
									<text x="14" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" fill={gameState.trumpCard.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{gameState.trumpCard.suit}</text>
								</g>
							</svg>
						</div>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] font-bold text-yellow-400 uppercase font-mono truncate max-w-[65px]">{gameState.trumpCard.suitName}</span>
					</div>
				{:else if gameState?.hiddenTrumpStorage}
					{@const owner = gameState.players.find(p => p.id === (gameState ? gameState.hiddenTrumpStorage?.playerId : ''))}
					<div class="rounded border border-dashed border-slate-700 bg-slate-950/20 flex flex-col justify-center items-center text-center p-0.5 text-[6px] text-slate-500 font-mono leading-none" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<span>HELD BY<br/>{owner?.name.toUpperCase()}</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] text-slate-500 uppercase font-mono">Hidden</span>
					</div>
				{:else}
					<div class="rounded border border-dashed border-slate-800 bg-slate-950/5 flex flex-col justify-center items-center text-[7px] text-slate-600 font-mono leading-none" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);" transition:fade>
						<span>NONE</span>
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Trump</span>
						<span class="text-[9px] text-slate-500 uppercase font-mono">None</span>
					</div>
				{/if}
			</div>

			<!-- Draw Pile Box (Phase 1) or Discard Pile Box (Phase 2) -->
			{#if gameState && gameState.phase === 1}
				<div class="compact-pile-box w-full flex flex-col items-start gap-2 mt-2" transition:fade>
					<div class="flex items-center justify-start gap-2 w-full">
						<div class="rounded relative overflow-hidden flex-shrink-0 border border-amber-500/30 shadow-md" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);">
							{#if gameState.deck.length > 0}
								<div class="w-full h-full card-back" style="border-width: 2px; border-radius: 4px; background-size: 100% 100%, 8px 8px, 8px 8px;"></div>
							{:else}
								<div class="w-full h-full bg-emerald-950/40 border border-dashed border-emerald-700/60 rounded flex items-center justify-center text-[7px] text-emerald-600/70 font-bold font-mono">
									EMPTY
								</div>
							{/if}
						</div>
						<div class="flex flex-col select-none">
							<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Draw</span>
							<span class="text-[10px] font-bold font-mono text-yellow-400">{gameState.deck.length} left</span>
						</div>
					</div>
					{#if gameState.deck.length > 0}
						<button
							onclick={handleChanceClick}
							disabled={!isHumanTurn}
							class="chance-btn w-full rounded bg-amber-500 disabled:bg-slate-800/40 hover:bg-amber-600 disabled:text-slate-500 text-slate-950 font-bold tracking-wide uppercase transition-all duration-200 border border-slate-700/30 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer shadow-md text-xs py-1"
						>
							Chance
						</button>
					{/if}
				</div>
			{:else if gameState}
				<div class="compact-pile-box w-full flex items-center justify-start gap-2 mt-2" transition:fade>
					<div class="rounded border border-emerald-800/40 bg-emerald-950/20 relative flex items-center justify-center shadow-inner flex-shrink-0" style="width: var(--sidebar-card-width); height: var(--sidebar-card-height); min-width: var(--sidebar-card-width); min-height: var(--sidebar-card-height);">
						{#if gameState.discardPile.length > 0}
							<div class="w-full h-full card-face animate-fade-in" style="padding: 1px; border-radius: 4px;">
								<div class="text-[7px] font-bold text-center mt-2 text-slate-600 font-mono leading-none">BURNED</div>
							</div>
						{:else}
							<div class="text-[7px] text-emerald-700/60 font-bold font-mono">BURN</div>
						{/if}
					</div>
					<div class="flex flex-col select-none">
						<span class="text-[8px] uppercase font-mono tracking-wider text-slate-400">Discard</span>
						<span class="text-[10px] font-bold font-mono text-emerald-400">{gameState.discardPile.length} cards</span>
					</div>
				</div>
			{/if}

			<!-- WebSocket status indicator -->
			<div class="mt-auto mb-4 flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
				<span class="w-1.5 h-1.5 rounded-full {connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400 animate-ping'}"></span>
				{connectionStatus.toUpperCase()}
			</div>

		</div>

		<!-- Center Area: Players Row & Table Pile -->
		<div class="flex-grow flex flex-col relative overflow-hidden">
			
			<!-- Top Row: Player status cards -->
			<div class="players-row flex justify-center items-center w-full z-10 gap-6">
				{#if gameState}
					{#each gameState.players as player, idx}
						{@const isActive = gameState.activePlayerIdx === idx && !gameState.trickWinnerId && gameState.status === 'playing'}
						<div class="player-box transition-all duration-300 {isActive ? 'active-turn' : ''} {player.isDone ? 'escaped' : ''}">
							<div class="player-avatar" style="background-color: {player.color}">
								{player.name.substring(0, 2).toUpperCase()}
							</div>
							<div class="player-info">
								<span class="player-name flex items-center gap-1.5">
									{player.name}
									{#if player.isDone}
										<span class="text-[10px] text-emerald-400 font-bold font-mono">✓ ESCAPED</span>
									{:else if player.isSkitgubbe}
										<span class="text-[10px] text-red-500 font-bold font-mono">💀 LOSER</span>
									{/if}
								</span>
								<span class="player-stats">
									Cards: <span class="text-white font-bold">{player.hand.length}</span>
									{#if gameState.phase === 1}
										<br/>Reserve: <span class="text-amber-400 font-bold">{player.reserveStack.length}</span>
									{/if}
								</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Main play field (Table) -->
			<main class="board-game-zone flex-grow w-full flex justify-center items-center relative max-w-5xl mx-auto overflow-visible px-4">
				
				<!-- Ornate felt inner circle rim -->
				<div class="absolute inset-0 rounded-full border border-emerald-900/10 pointer-events-none opacity-20 my-12"></div>
				
				{#if errorMessage}
					<div class="absolute top-6 px-4 py-2 rounded-full bg-red-950/90 text-red-200 text-xs font-semibold tracking-wide border border-red-500/20 z-20 shadow-lg animate-bounce">
						⚠️ {errorMessage}
					</div>
				{/if}

				{#if gameWinner}
					<!-- Game Won overlay -->
					<div class="absolute inset-0 bg-emerald-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center rounded-2xl gap-4">
						<span class="text-yellow-400 text-4xl font-extrabold animate-bounce">Winner!</span>
						<span class="text-white text-2xl font-medium">{gameWinner} escapes first and wins!</span>
						{#if localPlayer?.isHost}
							<button onclick={handleResetGameClick} class="lay-cards-btn px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide mt-2">
								Reset Room
							</button>
						{:else}
							<span class="text-slate-400 text-xs">Waiting for host to reset...</span>
						{/if}
					</div>
				{:else if skitgubbe}
					<!-- Skitgubbe Loss overlay -->
					<div class="absolute inset-0 bg-red-950/90 backdrop-blur-md z-40 flex flex-col items-center justify-center rounded-2xl gap-4">
						<span class="text-red-500 text-4xl font-extrabold animate-pulse">Skitgubbe!</span>
						<span class="text-white text-2xl font-medium">{skitgubbe} is the Skitgubbe!</span>
						{#if localPlayer?.isHost}
							<button onclick={handleResetGameClick} class="lay-cards-btn px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide mt-2">
								Reset Room
							</button>
						{:else}
							<span class="text-slate-400 text-xs">Waiting for host to reset...</span>
						{/if}
					</div>
				{:else if gameState?.trickWinnerId}
					<!-- Phase 1 Trick Resolution splash overlay -->
					{@const winner = gameState.players.find(p => p.id === gameState?.trickWinnerId)}
					<div class="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-2xl gap-2 shadow-2xl border border-emerald-800/20">
						<span class="text-yellow-400 text-3xl font-extrabold animate-bounce tracking-tight">Trick Won!</span>
						<span class="text-white text-lg font-medium">{winner?.name} takes the trick cards</span>
						<span class="text-slate-400 text-xs font-mono">Setting up next trick...</span>
					</div>
				{/if}

				<!-- Cards currently in play -->
				{#if gameState && gameState.phase === 1}
					<!-- Phase 1 Layout: Groups of played cards arranged side-by-side -->
					<div class="table-pile-container flex items-center justify-center overflow-visible gap-4">
						{#each gameState.tablePile as batch, idx}
							{@const playerIdOfBatch = gameState.tablePilePlayers[idx]}
							{@const player = gameState.players.find(p => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center gap-2" transition:fade>
								<span class="text-[9px] font-bold font-mono text-slate-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
									{player?.name}
								</span>
								<div class="semi-stacked-pile">
									{#each batch as card}
										<div class="card cursor-default relative">
											<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
												<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
													<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
													
													<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
													<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<g transform="rotate(180 62.5 87.5)">
														<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
														<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													</g>
												</svg>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}

						{#if gameState.tablePile.length === 0}
							<div class="text-emerald-700/50 font-mono text-sm uppercase tracking-widest text-center">
								Trick lead starts here
							</div>
						{/if}
					</div>
				{:else if gameState}
					<!-- Phase 2 Layout: Horizontally fanned out sequential play batches -->
					<div class="table-pile-container-phase2 flex items-center justify-center flex-wrap max-w-4xl overflow-visible gap-3">
						{#each gameState.tablePile as batch, batchIdx}
							{@const playerIdOfBatch = gameState.tablePilePlayers[batchIdx]}
							{@const player = gameState.players.find(p => p.id === playerIdOfBatch)}
							<div class="flex flex-col items-center" transition:fade>
								<span class="text-[9px] font-bold font-mono text-slate-400 mb-1">
									{player?.name}
								</span>
								<div class="semi-stacked-pile p-1 bg-emerald-950/20 border border-emerald-900/30 rounded-lg shadow-inner">
									{#each batch as card}
										<div class="card cursor-default relative">
											<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
												<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
													<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
													
													<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
													<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													
													<g transform="rotate(180 62.5 87.5)">
														<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
														<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
													</g>
												</svg>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/each}

						{#if gameState.tablePile.length === 0}
							<div class="text-emerald-700/50 font-mono text-sm uppercase tracking-widest text-center">
								Table is empty. Lead play!
							</div>
						{/if}
					</div>
				{/if}

			</main>

		</div>

		<!-- Right Sidebar: Scrollable Game Logs Panel -->
		<div class="right-sidebar flex flex-col p-3 flex-shrink-0 z-10">
			<span class="logs-title mb-2 flex items-center gap-1.5">
				<span>📜 Logs</span>
				<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
			</span>
			<div class="logs-panel flex-grow rounded-xl overflow-y-auto p-3 flex flex-col gap-2 shadow-inner border border-slate-700/30">
				{#if gameState}
					{#each gameState.logs as log}
						<div class="text-[10px] break-words">
							{log}
						</div>
					{/each}
				{/if}
			</div>
		</div>

	</div>

	<!-- Bottom Area: Actions & Player Hand -->
	<footer class="game-footer w-full flex flex-col items-center gap-4 relative z-10 pb-4">
		
		<!-- Buttons actions panel -->
		<div class="action-buttons-panel w-[80vw] max-w-5xl flex justify-between px-2 relative overflow-visible items-center">
			
			<!-- Left side status indicators -->
			<div class="text-xs font-mono text-slate-300">
				{#if isHumanTurn}
					<span class="text-green-400 font-bold">● YOUR TURN</span>
				{:else if gameState?.trickWinnerId}
					<span class="text-slate-400">Trick Resolving...</span>
				{:else if gameState?.status === 'playing'}
					{@const activeP = gameState.players[gameState.activePlayerIdx]}
					<span class="text-yellow-400">{activeP?.name}'s Turn...</span>
				{:else}
					<span class="text-slate-400">Waiting...</span>
				{/if}
			</div>

			<!-- Right side trigger buttons -->
			<div class="flex gap-3">
				{#if gameState && gameState.phase === 2 && isHumanTurn && gameState.tablePile.length > 0}
					<button
						onclick={handlePickUpClick}
						class="pick-up-btn font-bold tracking-wide transition-all duration-300 active:scale-95 cursor-pointer text-xs py-1.5 px-3 rounded-lg"
					>
						PICK UP BATCH
					</button>
				{/if}
				{#if isStroValid}
					<button 
						onclick={handleSprinkleClick}
						class="lay-cards-btn bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold transition-all duration-300 active:scale-95 cursor-pointer shadow-lg border border-teal-500/20 text-xs py-1.5 px-3 rounded-lg"
					>
						SPRINKLE ({selectedCardIds.length})
					</button>
				{:else if isHumanTurn && selectedCardIds.length > 0 && isSelectionValid}
					<button 
						onclick={handleLayCardsClick}
						class="lay-cards-btn font-bold tracking-wide shadow-2xl transition-all duration-300 active:scale-95 cursor-pointer text-xs py-1.5 px-3 rounded-lg"
					>
						{#if gameState?.phase === 1}
							PLAY CARD(S) ({selectedCardIds.length})
						{:else}
							LAY CARDS ({selectedCardIds.length})
						{/if}
					</button>
				{/if}
			</div>

		</div>

		<!-- Hand Container -->
		<div 
			bind:clientWidth={containerWidth}
			class="w-[80vw] max-w-5xl flex justify-center items-end relative overflow-visible pb-4"
			style="height: var(--hand-container-height);"
		>
			{#if humanHand.length > 0}
				{#each humanHand as card, i (card.id)}
					{@const xPosition = getCardX(i, handCount, activeSpreadIdx)}
					{@const isSelected = selectedCardIds.includes(card.id)}
					{@const isHovered = hoveredCardId === card.id}
					
					<div
						class="card hand-card absolute select-none"
						class:selected={isSelected}
						style={getCardStyle(card.id, i, isSelected, isHovered, xPosition)}
						onclick={() => handleCardClick(i, card.id)}
						onpointerenter={() => hoveredCardId = card.id}
						onpointerleave={() => { if (hoveredCardId === card.id) hoveredCardId = null; }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(i, card.id); }}
						role="button"
						tabindex="0"
						aria-label="{card.value} of {card.suitName}"
						in:drawTransition={{ duration: 500, targetX: xPosition }}
						out:fade={{ duration: 150 }}
					>
						<div class="w-full h-full relative" style="transform-style: preserve-3d;">
							
							<!-- Front of Card -->
							<div class="card-face shadow-md" style="padding: 0; border: none; background: transparent;">
								<svg viewBox="0 0 125 175" class="w-full h-full pointer-events-none select-none" xmlns="http://www.w3.org/2000/svg">
									<rect width="125" height="175" rx="12" fill="#ffffff" stroke="rgba(0,0,0,0.15)" stroke-width="1.5" />
									
									<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
									<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									
									<text x="62.5" y="105" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									
									<g transform="rotate(180 62.5 87.5)">
										<text x="14" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.value}</text>
										<text x="14" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill={card.color === 'red' ? '#dc2626' : '#1e293b'} text-anchor="middle">{card.suit}</text>
									</g>
								</svg>
							</div>
							
							<!-- Back of Card (for flip transition) -->
							<div class="card-back-red" style="backface-visibility: hidden; transform: rotateY(180deg);"></div>
						</div>
					</div>
				{/each}
			{:else}
				<div 
					transition:fade
					class="text-slate-400 text-sm font-medium bg-emerald-950/20 border border-emerald-800/30 px-6 py-3 rounded-2xl flex flex-col items-center gap-1.5 text-center mb-6"
				>
					<span>Your hand is empty / Spectating</span>
				</div>
			{/if}
		</div>
	</footer>
</div>

<!-- Floating Action Button for Reset -->
{#if localPlayer?.isHost}
	<button
		id="reset-game-btn"
		onclick={handleResetGameClick}
		class="reset-btn fixed z-30 flex items-center justify-center rounded-full glass-panel text-white hover:text-red-400 border border-slate-700/60 hover:border-red-500/30 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
		title="Reset Game"
		aria-label="Reset game board"
	>
		<svg 
			xmlns="http://www.w3.org/2000/svg" 
			class="h-5.5 w-5.5 transition-transform duration-500 group-hover:rotate-180" 
			fill="none" 
			viewBox="0 0 24 24" 
			stroke="currentColor" 
			stroke-width="2"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5M4 9h5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
		</svg>
	</button>
{/if}

<!-- Portrait Orientation Warning Overlay -->
<div class="portrait-warning">
	<div class="warning-content">
		<svg xmlns="http://www.w3.org/2000/svg" class="rotate-phone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
		<h2>Please Rotate Your Device</h2>
		<p>This sandbox is optimized for horizontal (landscape) layout. Turn your phone to start playing!</p>
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
	}
</style>
