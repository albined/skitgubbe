<script lang="ts">
	import type { ApiProfile } from 'shared';
	import Avatar from '$lib/Avatar.svelte';
	import LobbySheet from './LobbySheet.svelte';

	const MAX_INVITES = 9;

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		otherProfiles: ApiProfile[];
		selectedInviteIds: string[];
		newRoomName: string;
		suggestedRoomName: string;
		onCreateGameConfirm: () => void;
	}

	let {
		isOpen,
		onClose,
		otherProfiles,
		selectedInviteIds = $bindable(),
		newRoomName = $bindable(),
		suggestedRoomName,
		onCreateGameConfirm
	}: Props = $props();

	let isFull = $derived(selectedInviteIds.length >= MAX_INVITES);

	// Drag-to-scroll for a mouse; touch scrolls natively.
	let row = $state<HTMLDivElement | null>(null);
	let drag: { x: number; left: number; moved: boolean } | null = null;
	let isDragging = $state(false);
	let suppressClick = false;

	function handlePointerDown(e: PointerEvent) {
		if (!row || e.pointerType !== 'mouse') return;
		e.preventDefault();
		drag = { x: e.clientX, left: row.scrollLeft, moved: false };
	}

	function handlePointerMove(e: PointerEvent) {
		if (!drag || !row) return;
		const dx = e.clientX - drag.x;
		if (Math.abs(dx) > 5) {
			drag.moved = true;
			isDragging = true;
		}
		if (drag.moved) row.scrollLeft = drag.left - dx;
	}

	function handlePointerUp() {
		if (!drag) return;
		suppressClick = drag.moved;
		drag = null;
		isDragging = false;
		// The click that ends a drag fires right after pointerup; let only that one through as a no-op.
		setTimeout(() => (suppressClick = false), 0);
	}

	function togglePlayer(id: string) {
		if (suppressClick) return;
		if (selectedInviteIds.includes(id)) {
			selectedInviteIds = selectedInviteIds.filter((x) => x !== id);
		} else if (!isFull) {
			selectedInviteIds = [...selectedInviteIds, id];
		}
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

{#if isOpen}
	<LobbySheet title="Nytt spel" width={540} {onClose}>
		<div class="sheet-body">
			{#if otherProfiles.length === 0}
				<p class="sheet-empty">Inga andra konton finns.</p>
			{:else}
				<div
					bind:this={row}
					class="people"
					class:is-dragging={isDragging}
					onpointerdown={handlePointerDown}
					role="group"
					aria-label="Spelare"
				>
					{#each otherProfiles as p (p.id)}
						{@const isSelected = selectedInviteIds.includes(p.id)}
						<button
							type="button"
							class="person"
							class:is-on={isSelected}
							aria-pressed={isSelected}
							disabled={isFull && !isSelected}
							onclick={() => togglePlayer(p.id)}
						>
							<span class="person-av">
								<Avatar
									avatarConfig={p.avatar_config}
									fallbackColor={p.color}
									fallbackName={p.name}
									class="person-face h-full w-full rounded-full"
								/>
								{#if isSelected}
									<span class="tick" aria-hidden="true"><i>✓</i></span>
								{/if}
							</span>
							<span class="person-name">{p.name}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<form
			class="invite-bar"
			onsubmit={(e) => {
				e.preventDefault();
				onCreateGameConfirm();
			}}
		>
			<label class="name-field">
				<span class="sr-only">Namn på spelet</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="15"
					height="15"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
				</svg>
				<input
					type="text"
					bind:value={newRoomName}
					placeholder={suggestedRoomName}
					maxlength="20"
					autocomplete="off"
				/>
			</label>
			<button
				type="submit"
				disabled={selectedInviteIds.length === 0}
				class="premium-modal-btn premium-modal-btn-primary create-btn"
			>
				<span class="premium-modal-btn-content">Skapa spelet</span>
			</button>
		</form>
	</LobbySheet>
{/if}

<style>
	.people {
		display: flex;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x proximity;
		scrollbar-width: none;
		/* The next face peeks in under a fade, so it's clear the row scrolls. */
		padding-inline-end: 36px;
		-webkit-mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent);
		mask-image: linear-gradient(to right, #000 calc(100% - 36px), transparent);
		cursor: grab;
		-webkit-user-select: none;
		user-select: none;
	}

	.people::-webkit-scrollbar {
		display: none;
	}

	.people.is-dragging {
		cursor: grabbing;
		scroll-snap-type: none;
	}

	.person {
		flex: none;
		width: 78px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 7px 2px 5px;
		border: 0;
		background: none;
		color: #e2e8f0;
		cursor: pointer;
		scroll-snap-align: start;
		transition: opacity 0.2s;
		-webkit-user-drag: none;
	}

	.person:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.person-av {
		position: relative;
		width: 48px;
		height: 48px;
	}

	.person-av :global(.person-face) {
		outline: 2px solid transparent;
		outline-offset: 2px;
		transition: outline-color 0.2s;
	}

	.person.is-on .person-av :global(.person-face) {
		outline-color: #e3ba5a;
	}

	.tick {
		position: absolute;
		top: -4px;
		right: -6px;
		width: 17px;
		height: 17px;
		display: grid;
		place-items: center;
		background: linear-gradient(
			135deg,
			#ffe89e 0%,
			#e3ba5a 25%,
			#b88728 45%,
			#fceeac 55%,
			#d19f33 70%,
			#875c12 100%
		);
		transform: rotate(45deg);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
	}

	.tick i {
		transform: rotate(-45deg);
		font:
			800 10px/1 'Outfit',
			sans-serif;
		font-style: normal;
		color: #261600;
	}

	.person-name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		font-weight: 600;
		color: #cbd5e1;
	}

	.person:hover:not(:disabled) .person-name {
		color: #fff;
	}

	.person.is-on .person-name {
		color: #ffe89e;
	}

	.invite-bar {
		flex: none;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 18px 12px 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
	}

	.name-field {
		position: relative;
		flex: 1 1 auto;
		min-width: 0;
	}

	.name-field svg {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: #64748b;
		pointer-events: none;
	}

	.name-field input {
		width: 100%;
		height: 40px;
		padding: 0 12px 0 34px;
		border: 1px solid rgba(120, 53, 15, 0.4);
		border-radius: 0;
		background: rgba(2, 6, 23, 0.6);
		color: #fff;
		font-size: 15px;
	}

	.name-field input::placeholder {
		color: #94a3b8;
		font-style: italic;
	}

	.name-field input:focus {
		outline: none;
		border-color: rgba(120, 53, 15, 0.4);
		box-shadow: 0 0 0 1px #f59e0b;
	}

	.create-btn {
		flex: none;
		height: 38px;
		padding: 0 26px;
		font-size: 14px;
		letter-spacing: 0.08em;
		white-space: nowrap;
	}

	@media (max-height: 360px) {
		.person {
			padding-block: 5px 3px;
			gap: 4px;
		}
		.person-av {
			width: 42px;
			height: 42px;
		}
		.invite-bar {
			padding-block: 7px 9px;
		}
	}
</style>
