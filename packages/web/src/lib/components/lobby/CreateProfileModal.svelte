<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { PRESET_COLORS } from '$lib/state/lobbyState.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		newProfileName: string;
		newProfileColor: string;
		createError: string;
		onCreateProfile: (e: Event) => void;
	}

	let {
		isOpen,
		onClose,
		newProfileName = $bindable(),
		newProfileColor = $bindable(),
		createError,
		onCreateProfile
	}: Props = $props();
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="glass-panel flex w-full max-w-md flex-col gap-6 rounded-2xl border border-white/10 p-8 shadow-2xl"
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			<div class="text-center">
				<h2 class="text-3xl font-bold text-slate-100">Create New Profile</h2>
				<p class="mt-1 text-sm text-slate-400">Select a name and pick your player color theme</p>
			</div>

			<form onsubmit={onCreateProfile} class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<label
						for="new_username"
						class="text-xs font-bold tracking-wider text-slate-400 uppercase">Display Name</label
					>
					<input
						id="new_username"
						type="text"
						bind:value={newProfileName}
						placeholder="E.g. Spade Ace"
						class="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-lg text-white placeholder-slate-600 focus:ring-1 focus:ring-amber-500 focus:outline-none"
						maxlength="15"
						required
					/>
				</div>

				<div class="flex flex-col gap-2">
					<span class="text-xs font-bold tracking-wider text-slate-400 uppercase">Color Theme</span>
					<div class="grid grid-cols-4 gap-3">
						{#each PRESET_COLORS as color}
							<button
								type="button"
								onclick={() => (newProfileColor = color)}
								class="aspect-square w-full cursor-pointer rounded-xl border-2 shadow-md transition-all duration-200 hover:scale-105"
								style="background-color: {color}; border-color: {newProfileColor === color
									? '#ffd700'
									: 'transparent'};"
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>
				</div>

				{#if createError}
					<span class="text-center text-xs font-semibold text-red-400">{createError}</span>
				{/if}

				<div class="mt-2 flex gap-3">
					<button
						type="button"
						onclick={onClose}
						class="premium-modal-btn premium-modal-btn-secondary flex-1"
					>
						<span class="premium-modal-btn-content">Cancel</span>
					</button>
					<button type="submit" class="premium-modal-btn premium-modal-btn-primary flex-1">
						<span class="premium-modal-btn-content">Create & Play</span>
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
