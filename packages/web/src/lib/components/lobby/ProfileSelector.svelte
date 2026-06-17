<script lang="ts">
	import { fade } from 'svelte/transition';
	import Avatar from '$lib/Avatar.svelte';

	interface Props {
		profiles: any[];
		onSelectProfile: (id: string) => void;
	}

	let { profiles, onSelectProfile }: Props = $props();
</script>

<div
	class="profile-selector-container flex w-full max-w-4xl flex-col items-center gap-10"
	in:fade={{ duration: 300 }}
>
	<div class="text-center">
		<h1
			class="bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-5xl font-bold text-transparent drop-shadow-md sm:text-6xl md:text-7xl"
		>
			Skitgubbe
		</h1>
		<p class="mt-3 text-lg tracking-wide text-slate-300 sm:text-xl md:text-2xl">Vem spelar?</p>
	</div>

	<!-- Profile Select Grid -->
	<div
		class="profile-select-list grid grid-cols-2 items-center justify-center gap-8 py-6 sm:grid-cols-3 md:grid-cols-4"
	>
		{#each profiles as p}
			<button
				onclick={() => onSelectProfile(p.id)}
				class="group flex cursor-pointer flex-col items-center gap-3 border-0 bg-transparent transition-transform duration-200 hover:scale-105 focus:outline-none"
			>
				<div
					class="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-transparent text-5xl font-black text-white uppercase shadow-xl transition-all duration-300 group-hover:border-yellow-400 sm:h-28 sm:w-28"
					style="background-color: {p.color}; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.25);"
				>
					<Avatar
						avatarConfig={p.avatar_config}
						fallbackColor={p.color}
						fallbackName={p.name}
						class="h-full w-full rounded-2xl"
					/>

					<!-- Soft Inner Radial Glow -->
					<div class="absolute inset-0 rounded-2xl bg-radial from-white/10 to-transparent"></div>
				</div>
				<span
					class="w-24 truncate text-center text-xl text-slate-300 transition-colors duration-200 group-hover:text-white sm:w-28"
				>
					{p.name}
				</span>
			</button>
		{/each}

		<!-- Add New Profile Button -->
		<button
			onclick={() => {
				window.location.href = '/avatar?new=true';
			}}
			class="group flex cursor-pointer flex-col items-center gap-3 border-0 bg-transparent transition-transform duration-200 hover:scale-105 focus:outline-none"
		>
			<div
				class="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-600 bg-slate-900/30 text-slate-500 shadow-lg transition-all duration-300 group-hover:border-slate-300 group-hover:bg-slate-900/50 group-hover:text-slate-300 sm:h-28 sm:w-28"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-10 w-10"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
			</div>
			<span
				class="text-xl text-slate-500 transition-colors duration-200 group-hover:text-slate-300"
			>
				Ny profil
			</span>
		</button>
	</div>
</div>
