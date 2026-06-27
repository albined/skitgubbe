<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { RoomState } from '$lib/state/roomState.svelte';

	interface Props {
		roomState: RoomState;
	}

	let { roomState }: Props = $props();
</script>

{#if roomState.allowDevSettings}
	<div class="fixed bottom-6 left-6 z-30 flex flex-col items-start gap-3">
		{#if roomState.showDebugMenu}
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
					onclick={() => (roomState.autoplay = !roomState.autoplay)}
					class="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all {roomState.autoplay
						? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
						: 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}"
				>
					<span>Autoplay Turn</span>
					<span
						class="h-2.5 w-2.5 rounded-full {roomState.autoplay
							? 'animate-pulse bg-amber-400'
							: 'bg-slate-700'}"
					></span>
				</button>

				<!-- God Mode Toggle -->
				<button
					onclick={() => (roomState.godMode = !roomState.godMode)}
					class="flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-all {roomState.godMode
						? 'border-red-500/40 bg-red-500/10 text-red-300'
						: 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'}"
				>
					<span>God Mode (Play Anytime)</span>
					<span
						class="h-2.5 w-2.5 rounded-full {roomState.godMode
							? 'animate-pulse bg-red-500'
							: 'bg-slate-700'}"
					></span>
				</button>

				<!-- Skip to Phase 2 -->
				{#if roomState.gameState && roomState.gameState.status === 'playing'}
					<button
						onclick={() => roomState.sendWsMessage({ type: 'debugSkipToPhase2' })}
						class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-amber-500/40 hover:text-amber-300"
					>
						⏭️ Skip to Phase 2
					</button>

					<button
						onclick={() => roomState.sendWsMessage({ type: 'debugForceLose' })}
						class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-red-500/40 hover:text-red-400"
					>
						💀 Force Skitgubbe Loss
					</button>
				{/if}

				<!-- Reset Game -->
				{#if roomState.isHost}
					<button
						onclick={() => roomState.handleResetGameClick()}
						class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-red-500/40 hover:text-red-400"
					>
						🔄 Reset Game
					</button>
				{/if}

				<!-- Test Confetti -->
				<button
					onclick={() => roomState.confettiRef?.fire()}
					class="w-full cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-300 transition-all hover:border-emerald-500/40 hover:text-emerald-400"
				>
					🎉 Test Confetti
				</button>
			</div>
		{/if}

		<button
			onclick={() => (roomState.showDebugMenu = !roomState.showDebugMenu)}
			class="glass-panel flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-slate-700/60 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:border-amber-500/30 hover:text-amber-400 active:scale-95"
			title="Debug Menu"
			aria-label="Toggle debug menu"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-6 w-6 transition-transform duration-300 {roomState.showDebugMenu
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
