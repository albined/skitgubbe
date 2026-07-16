<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { ApiProfile } from 'shared';
	import Avatar from '$lib/Avatar.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		otherProfiles: ApiProfile[];
		selectedInviteIds: string[];
		newRoomName: string;
		onCreateGameConfirm: () => void;
	}

	let {
		isOpen,
		onClose,
		otherProfiles,
		selectedInviteIds = $bindable(),
		newRoomName = $bindable(),
		onCreateGameConfirm
	}: Props = $props();

	// State for invite modal drag-to-scroll
	let isDragging = $state(false);
	let dragMoved = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragScrollLeft = 0;
	let scrollContainer = $state<HTMLDivElement | null>(null);

	function handleMouseDown(e: MouseEvent) {
		if (!scrollContainer) return;
		isDragging = true;
		dragMoved = false;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragScrollLeft = scrollContainer.scrollLeft;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging || !scrollContainer) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
			dragMoved = true;
		}
		if (dragMoved) {
			scrollContainer.style.scrollSnapType = 'none';
			scrollContainer.scrollLeft = dragScrollLeft - dx;
		}
	}

	function handleMouseUp() {
		if (isDragging && scrollContainer) {
			scrollContainer.style.scrollSnapType = '';
		}
		isDragging = false;
	}
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="premium-modal-container flex max-h-[calc(var(--app-height)*0.85)] w-full max-w-md flex-col gap-4 overflow-hidden p-5 sm:gap-6 sm:p-8"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto py-1 pr-1">
				<div class="flex flex-col gap-2 text-left">
					<label
						for="new_room_name"
						class="text-xs font-bold tracking-wider text-slate-400 uppercase">Namn på spelet</label
					>
					<input
						id="new_room_name"
						type="text"
						bind:value={newRoomName}
						placeholder=""
						class="rounded-none border border-amber-900/40 bg-slate-950/60 px-4 py-3 text-base text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
						maxlength="20"
					/>
				</div>

				{#if otherProfiles.length === 0}
					<div class="flex flex-col items-center gap-2 py-4">
						<p class="text-center text-sm font-semibold text-amber-500/80">
							Inga andra konton finns.
						</p>
						<p class="text-center text-xs text-slate-400">
							Det måste finnas minst en annan spelare för att skapa ett spel.
						</p>
					</div>
				{:else}
					<div
						bind:this={scrollContainer}
						onmousedown={handleMouseDown}
						role="presentation"
						class="no-scrollbar flex w-full shrink-0 cursor-grab snap-x gap-4 overflow-x-auto pb-4 select-none active:cursor-grabbing"
					>
						{#each otherProfiles as p}
							{@const isSelected = selectedInviteIds.includes(p.id)}
							<button
								type="button"
								onclick={(e) => {
									if (dragMoved) {
										e.preventDefault();
										return;
									}
									if (isSelected) {
										selectedInviteIds = selectedInviteIds.filter((id) => id !== p.id);
									} else {
										if (selectedInviteIds.length >= 9) return;
										selectedInviteIds = [...selectedInviteIds, p.id];
									}
								}}
								class="flex shrink-0 cursor-pointer snap-center flex-col items-center gap-2 border p-3 text-center transition-all {isSelected
									? 'border-amber-500 bg-amber-500/10'
									: 'border-transparent hover:bg-slate-900/50'}"
							>
								<div class="relative">
									<Avatar
										avatarConfig={p.avatar_config}
										fallbackColor={p.color}
										fallbackName={p.name}
										class="h-12 w-12 rounded-full transition-all sm:h-14 sm:w-14 {isSelected
											? 'ring-2 ring-amber-500'
											: ''}"
									/>
									{#if isSelected}
										<div
											class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-500"
										>
											<span class="text-[10px] font-bold text-slate-950">✓</span>
										</div>
									{/if}
								</div>
								<span class="w-16 truncate text-xs font-semibold text-slate-200">{p.name}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex shrink-0 gap-3">
				<button
					type="button"
					onclick={() => {
						onClose();
						selectedInviteIds = [];
						newRoomName = '';
						isDragging = false;
						dragMoved = false;
					}}
					class="silver-trimmed-btn flex-1 py-2 font-serif text-sm font-bold tracking-wider uppercase"
				>
					Avbryt
				</button>
				<button
					type="button"
					onclick={onCreateGameConfirm}
					disabled={selectedInviteIds.length === 0}
					class="gold-trimmed-btn flex-1 py-2 font-serif text-sm font-bold tracking-wider uppercase"
				>
					Skapa spelet
				</button>
			</div>
		</div>
	</div>
{/if}
