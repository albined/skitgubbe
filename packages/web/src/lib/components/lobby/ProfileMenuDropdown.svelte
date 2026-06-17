<script lang="ts">
	import type { LobbyState } from '$lib/state/lobbyState.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import { pwa } from '$lib/pwa.svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		state: LobbyState;
	}

	let { state }: Props = $props();

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (state.showProfileDropdown && !target.closest('.profile-chip-container')) {
			state.showProfileDropdown = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

{#if state.activeProfile}
	<div class="profile-chip-container fixed top-4 right-4 z-50">
		<button
			onclick={() => (state.showProfileDropdown = !state.showProfileDropdown)}
			class="flex cursor-pointer items-center gap-2 border-0 bg-transparent px-2 py-1 text-slate-200 shadow-none hover:text-white focus:outline-none"
		>
			<Avatar
				avatarConfig={state.activeProfile.avatar_config}
				fallbackColor={state.activeProfile.color}
				fallbackName={state.activeProfile.name}
				class="h-5 w-5 rounded-full"
			/>
			<span class="text-base font-semibold">{state.activeProfile.name}</span>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-3 w-3 text-slate-400 transition-transform duration-200 {state.showProfileDropdown
					? 'rotate-180'
					: ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if state.showProfileDropdown}
			<div
				class="premium-modal-container absolute right-0 z-50 mt-2 w-48 py-1.5"
				style="position: absolute;"
				transition:fade={{ duration: 100 }}
			>
				{#if pwa.installPrompt}
					<button
						onclick={() => {
							pwa.install();
							state.showProfileDropdown = false;
						}}
						class="hover:text-amber-250 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-amber-400 transition-colors hover:bg-white/5"
					>
						Installera app
					</button>
					<div class="my-1 h-[1px] bg-white/5"></div>
				{/if}
				{#if state.notificationsSupported}
					<button
						disabled={state.isTogglingNotifications}
						onclick={() => {
							state.toggleNotifications();
							state.showProfileDropdown = false;
						}}
						class="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
					>
						<span class="flex items-center gap-2"> Notiser </span>
						<span
							class="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider {state.notificationsEnabled
								? 'bg-emerald-500/20 text-emerald-400'
								: 'bg-slate-700/30 text-slate-500'}"
						>
							{state.isTogglingNotifications ? '...' : state.notificationsEnabled ? 'På' : 'Av'}
						</span>
					</button>
					<div class="my-1 h-[1px] bg-white/5"></div>
				{/if}
				<button
					onclick={() => {
						window.location.href = '/avatar';
						state.showProfileDropdown = false;
					}}
					class="hover:text-amber-250 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-amber-400 transition-colors hover:bg-white/5"
				>
					Ändra din avatar
				</button>
				<div class="my-1 h-[1px] bg-white/5"></div>
				<button
					onclick={() => {
						state.loadAccessLogs();
						state.showLogsModal = true;
						state.showProfileDropdown = false;
					}}
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
				>
					Senaste inloggningarna
				</button>
				<div class="my-1 h-[1px] bg-white/5"></div>
				<button
					onclick={() => {
						state.openStatsDashboard();
						state.showProfileDropdown = false;
					}}
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
				>
					Profil Stats
				</button>
				<div class="my-1 h-[1px] bg-white/5"></div>
				<button
					onclick={() => {
						state.openArchiveModal();
						state.showProfileDropdown = false;
					}}
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
				>
					Spel arkiv
				</button>
				<div class="my-1 h-[1px] bg-white/5"></div>
				<button
					onclick={() => {
						state.isArchiveMode = true;
						state.selectedGamesToArchive = [];
						state.showProfileDropdown = false;
					}}
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
				>
					Arkivera rum
				</button>
				<div class="my-1 h-[1px] bg-white/5"></div>
				<button
					onclick={() => {
						state.handleLogout();
					}}
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/5"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-3.5 w-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h4a3 3 0 013 3v1"
						/>
					</svg>
					Logga ut / Byt konto
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.profile-chip-container {
		font-family: 'Cormorant Garamond', Georgia, serif;
	}
</style>
