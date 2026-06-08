<script lang="ts">
	import { AVATAR_FEATURES } from './avatarFeatures';

	interface Props {
		avatarConfig?: string | object | null;
		fallbackColor?: string;
		fallbackName?: string;
		class?: string;
	}

	let {
		avatarConfig = null,
		fallbackColor = '#3b82f6',
		fallbackName = '',
		class: className = ''
	}: Props = $props();

	const CATEGORY_ORDER = ['hair_back', 'head', 'mouth', 'eyes', 'nose', 'eyebrows', 'hair_front'];

	// Derived state to parse and prepare avatar config
	const parsedConfig = $derived.by(() => {
		if (!avatarConfig) return null;
		if (typeof avatarConfig === 'object') return avatarConfig as any;
		try {
			return JSON.parse(avatarConfig);
		} catch (e) {
			return null;
		}
	});

	const sortedFeatures = $derived.by(() => {
		if (!parsedConfig || !parsedConfig.features) return [];
		
		const features = parsedConfig.features.map((f: any) => {
			const template = AVATAR_FEATURES.flatMap(cat => cat.features).find(t => t.id === f.templateId);
			return {
				...f,
				svgContent: template ? template.svgContent : '',
				name: template ? template.name : ''
			};
		}).filter((f: any) => f.svgContent);

		return [...features].sort((a, b) => {
			return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
		});
	});

	const skinColor = $derived(parsedConfig?.skinColor || '#FFCDB2');
	const hairColor = $derived(parsedConfig?.hairColor || '#3E2723');
	const eyeColor = $derived(parsedConfig?.eyeColor || '#4CAF50');
	const eyebrowColor = $derived(parsedConfig?.eyebrowColor || '#5D4037');
	const bgColor = $derived(parsedConfig?.bgColor || fallbackColor);

	const initials = $derived.by(() => {
		if (!fallbackName) return '';
		return fallbackName.trim().substring(0, 2).toUpperCase();
	});
</script>

<div class="relative overflow-hidden flex items-center justify-center {className}" style="background-color: {bgColor};">
	{#if parsedConfig && sortedFeatures.length > 0}
		<svg
			viewBox="0 0 200 200"
			class="w-full h-full select-none pointer-events-none"
			xmlns="http://www.w3.org/2000/svg"
			style="--skin-color: {skinColor}; --hair-color: {hairColor}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor};"
		>
			<defs>
				<filter id="blur-shadow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="4" />
				</filter>
				<filter id="lip-glow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="soft-nose" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="4" />
				</filter>
				<filter id="eye-shadow" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-1" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-2" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-3" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-6" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-8" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-9" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>
				<filter id="brow-soft-10" x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation="3" />
				</filter>

				<clipPath id="eye-clip-1">
					<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" />
				</clipPath>
				<clipPath id="eye-clip-3">
					<path d="M 20 110 L 180 100 C 140 150, 60 150, 20 110 Z" />
				</clipPath>
				<clipPath id="eye-clip-4">
					<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 120, 70 120, 20 100 Z" />
				</clipPath>
				<clipPath id="eye-clip-6">
					<path d="M 20 80 C 80 50, 140 90, 180 140 C 120 150, 60 120, 20 80 Z" />
				</clipPath>
				<clipPath id="eyeClip7">
					<path d="M 20 100 C 40 20 150 30 180 120 C 140 180 60 160 20 100 Z" />
				</clipPath>
				<clipPath id="eyeClip6">
					<path d="M 20 80 C 80 40 160 100 180 120 C 140 160 60 140 20 80 Z" />
				</clipPath>
				<clipPath id="eyeClip10">
					<path d="M 20 100 C 60 60 140 70 180 110 C 140 140 60 140 20 100 Z" />
				</clipPath>
			</defs>

			<style>
				.skin-color { fill: var(--skin-color, #ffcdb2); }
				.hair-color { fill: var(--hair-color, #3e2723); }
				.eye-color { fill: var(--eye-color, #4caf50); }
				.eyebrow-color { fill: var(--eyebrow-color, #5d4037); }
			</style>

			{#each sortedFeatures as f (f.id)}
				<g transform="translate({f.x} {f.y}) translate(100 100) rotate({f.rotation}) scale({f.scaleX} {f.scaleY}) translate(-100 -100)">
					{@html f.svgContent}
				</g>
			{/each}
		</svg>
	{:else}
		<span class="text-white font-bold select-none text-[1.5em]">{initials}</span>
	{/if}
</div>
