<script lang="ts">
	import { fade } from 'svelte/transition';
	import type { RoomState } from '$lib/state/roomState.svelte';

	interface Props {
		roomState: RoomState;
	}

	let { roomState }: Props = $props();
	let inputMessage = $state('');
	let chatBoxElement = $state<HTMLElement | null>(null);

	// Automatically scroll chat to bottom when showChat opens or new messages arrive
	$effect(() => {
		if (roomState.showChat && roomState.chatMessages.length > 0) {
			if (chatBoxElement) {
				chatBoxElement.scrollTop = chatBoxElement.scrollHeight;
			}
		}
	});

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = inputMessage.trim();
		if (!trimmed) return;

		roomState.sendWsMessage({
			type: 'chat',
			message: trimmed
		});
		inputMessage = '';
	}
</script>

{#if roomState.showChat}
	<div
		transition:fade={{ duration: 150 }}
		class="premium-modal-container absolute top-4 bottom-4 right-4 z-40 flex w-80 flex-col gap-2.5 p-4"
	>
		<div class="flex items-center justify-end pb-1">
			<button
				onclick={() => (roomState.showChat = false)}
				class="cursor-pointer text-slate-400 transition-colors duration-200 hover:text-white"
				aria-label="Close chat"
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

		<!-- Chat message list -->
		<div
			bind:this={chatBoxElement}
			class="logs-panel premium-inner-box flex flex-grow flex-col gap-2.5 overflow-y-auto p-3"
		>
			{#if roomState.chatMessages.length === 0}
				<div class="text-center text-[10px] text-slate-500 italic py-4">
					Inga meddelanden än. Skriv något!
				</div>
			{:else}
				{#each roomState.chatMessages as msg (msg.id)}
					{@const sender = roomState.gameState?.players.find(p => p.id === msg.playerId)}
					<div class="chat-message-entry text-[11px] leading-tight font-sans">
						<span class="font-bold font-sans" style="color: {sender?.color || '#ffd700'}">
							{sender?.id === roomState.playerId ? 'Du' : (sender?.name || 'Okänd')}:
						</span>
						{#if msg.emote}
							<span class="text-sm ml-1 select-all">{msg.emote}</span>
						{:else}
							<span class="text-slate-200 ml-1 break-words select-all">{msg.message}</span>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		<!-- Input box -->
		<form onsubmit={handleSubmit} class="flex gap-2 border-t border-slate-800/60 pt-2">
			<input
				type="text"
				bind:value={inputMessage}
				placeholder="Skriv ett meddelande..."
				maxlength="200"
				class="flex-grow bg-slate-950/80 border border-slate-800 rounded-none text-[11px] text-white px-2 py-1.5 focus:outline-none focus:border-amber-500/60"
			/>
			<button
				type="submit"
				class="flex items-center justify-center bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-slate-400 transition-colors duration-200 hover:text-white hover:border-slate-700 active:scale-95"
				aria-label="Sänd"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="h-3.5 w-3.5"
				>
					<path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
				</svg>
			</button>
		</form>
	</div>
{/if}

<style>
	.premium-modal-container {
		/* Glassmorphic semi-transparent casino aesthetic */
		background: linear-gradient(
			135deg,
			rgba(15, 15, 15, 0.7) 0%,
			rgba(30, 25, 20, 0.6) 100%
		) !important;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	/* Responsive adjustments for short horizontal screens (landscape mobile) */
	@media (max-height: 640px) {
		.premium-modal-container {
			top: 8px !important;
			bottom: 8px !important;
			gap: 6px !important;
			padding: 10px !important;
		}

		.logs-panel {
			padding: 8px !important;
			gap: 6px !important;
		}
	}
</style>


