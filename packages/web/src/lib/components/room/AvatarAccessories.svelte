<script lang="ts">
	import type { RoomTitle } from 'shared';
	import { LEPRECHAUN_HAT_SVG_CONTENT, HALO_SVG_CONTENT } from '$lib/avatarAccessories';

	// One title at most: skitgubbe hides any luck title the player also holds.
	let { title }: { title: RoomTitle } = $props();
</script>

<!-- Separate from the avatar's clipped artwork and saved appearance. -->
<div class="accessories">
	{#if title === 'skitgubbe'}
		<svg class="accessory poop" viewBox="0 0 64 48" role="img" aria-label="Skitgubbe">
			<title>Skitgubbe</title>
			<g stroke="#42291e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<path
					d="M15 43C4 43 3 32 14 28C10 22 16 16 24 17C22 12 30 10 29 5C40 7 45 16 39 21C48 19 55 25 49 31C61 34 58 43 49 43Z"
					fill="#a36b43"
				/>
				<path d="M24 17Q28 21 39 21M14 28Q25 33 43 29" fill="none" stroke="#75482e" />
				<path d="M17 36Q12 35 15 33M29 12Q34 13 35 16" fill="none" stroke="#d6a16e" />
			</g>
			<ellipse cx="25" cy="35" rx="2" ry="2.5" fill="#38251d" />
			<ellipse cx="39" cy="35" rx="2" ry="2.5" fill="#38251d" />
			<path
				d="M29 39Q32 41 35 39"
				fill="none"
				stroke="#38251d"
				stroke-width="2"
				stroke-linecap="round"
			/>
		</svg>
	{:else if title === 'trumfman'}
		<svg class="accessory leprechaun-hat" viewBox="0 0 64 48" role="img" aria-label="Trumfman">
			<title>Trumfman</title>
			{@html LEPRECHAUN_HAT_SVG_CONTENT}
		</svg>
	{:else if title === 'sweetgubbe'}
		<svg class="accessory halo" viewBox="0 0 64 48" role="img" aria-label="Sweetgubbe">
			<title>Sweetgubbe</title>
			{@html HALO_SVG_CONTENT}
		</svg>
	{/if}
</div>

<style>
	.accessories {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}

	.accessory {
		position: absolute;
		width: 80%;
		height: 60%;
		left: 10%;
		top: -43%;
		overflow: visible;
		filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.35));
	}

	.poop {
		transform: rotate(-9deg);
	}

	.leprechaun-hat {
		transform: rotate(7deg);
	}

	.halo {
		transform: rotate(-8deg);
	}
</style>
