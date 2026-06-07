<script lang="ts">
	let { colorTheme = 'blue', class: className = '', style = '' } = $props<{
		colorTheme?: 'blue' | 'red';
		class?: string;
		style?: string;
	}>();
</script>

<div
	class="{colorTheme === 'red' ? 'card-back-red' : 'card-back'} {className}"
	{style}
></div>
