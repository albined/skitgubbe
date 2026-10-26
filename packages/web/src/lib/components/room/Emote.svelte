<script lang="ts">
	import { emoteSet } from 'shared';

	let { emote }: { emote: string } = $props();

	const set = $derived(emoteSet(emote));
</script>

<!-- Sized in em so it matches whatever text size the emoji would have had. -->
{#if set}
	<img
		src="/emotes/{set}/{emote.slice(emote.indexOf(':') + 1)}.svg"
		alt={set === 'poop' ? '💩' : '🍀'}
		draggable="false"
		class="inline-block h-[1.15em] w-[1.15em] max-w-none align-middle"
	/>
{:else}
	{emote}
{/if}
