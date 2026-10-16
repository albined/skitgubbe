<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	interface Props {
		title: string;
		/** Widest the window gets; it shrinks to fit narrower screens. */
		width: number;
		/** Fill the available height instead of hugging the content. */
		tall?: boolean;
		onClose: () => void;
		/** Extra header controls, placed between the title and the close button. */
		head?: Snippet;
		children: Snippet;
	}

	let { title, width, tall = false, onClose, head, children }: Props = $props();

	// Only a press that starts on the scrim closes, so a drag that ends outside doesn't.
	let pressedScrim = false;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="sheet-overlay"
	role="presentation"
	onpointerdown={(e) => (pressedScrim = e.target === e.currentTarget)}
	onclick={(e) => {
		if (pressedScrim && e.target === e.currentTarget) onClose();
	}}
	transition:fade={{ duration: 150 }}
>
	<div
		class="premium-modal-container lobby-sheet"
		class:is-tall={tall}
		style="--sheet-w: {width}px"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		transition:scale={{ duration: 200, start: 0.96 }}
	>
		<header class="sheet-head">
			<h2 class="sheet-title">
				<span class="sheet-dia" aria-hidden="true">◆</span><span>{title}</span>
			</h2>
			{@render head?.()}
			<button type="button" class="sheet-close" onclick={onClose} aria-label="Stäng">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="22"
					height="22"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</header>
		{@render children()}
	</div>
</div>

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: max(8px, var(--safe-area-inset-top)) max(12px, var(--safe-area-inset-right))
			max(8px, var(--safe-area-inset-bottom)) max(12px, var(--safe-area-inset-left));
		background: rgba(2, 6, 23, 0.9);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.lobby-sheet {
		display: flex;
		flex-direction: column;
		width: min(100%, var(--sheet-w));
		max-height: min(100%, 680px);
		color: #e2e8f0;
		font-size: 14px;
		line-height: 1.35;
	}

	.lobby-sheet.is-tall {
		height: min(100%, 680px);
	}

	.sheet-head {
		flex: none;
		display: flex;
		align-items: center;
		gap: 12px;
		height: 42px;
		padding: 0 2px 0 16px;
		border-bottom: 1px solid rgba(227, 186, 90, 0.2);
	}

	.sheet-title {
		margin: 0 auto 0 0;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 9px;
		font:
			700 19px/1 'Cormorant Garamond',
			Georgia,
			serif;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #f1f5f9;
		white-space: nowrap;
	}

	.sheet-title > span:last-child {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sheet-dia {
		color: #e3ba5a;
		font-size: 0.6em;
		line-height: 1;
	}

	.sheet-close {
		flex: none;
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: #94a3b8;
		cursor: pointer;
		transition: color 0.15s;
	}

	.sheet-close:hover {
		color: #fff;
	}

	/* Shared by the windows that render inside the sheet; kept at one class so they can override it. */
	:global(.sheet-body) {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
		padding: 12px 16px;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(212, 175, 55, 0.3) transparent;
	}

	:global(.sheet-empty) {
		margin: 0;
		padding: 32px 16px;
		text-align: center;
		font-size: 14px;
		color: #94a3b8;
	}

	@media (max-height: 360px) {
		.sheet-head {
			height: 38px;
		}
		:global(.sheet-body) {
			padding-block: 8px;
		}
	}

	@media (max-width: 720px) {
		.sheet-title {
			font-size: 17px;
			letter-spacing: 0.08em;
		}
	}
</style>
