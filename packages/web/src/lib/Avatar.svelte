<script lang="ts" module>
	let avatarCounter = 0;

	const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/;

	function isValidHex(color: unknown): color is string {
		return typeof color === 'string' && HEX_COLOR_REGEX.test(color);
	}
</script>

<script lang="ts">
	import {
		AVATAR_FEATURES,
		getAvatarFeaturesMap,
		getHairShades,
		getLipShades,
		namespaceSvgGradients,
		loadAvatarFeatures,
		CATEGORY_ORDER,
		type AvatarConfig,
		type PlacedFeature
	} from './avatarFeatures.svelte';

	loadAvatarFeatures();

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


	// Derived state to parse and prepare avatar config
	const parsedConfig = $derived.by((): AvatarConfig | null => {
		if (!avatarConfig) return null;
		if (typeof avatarConfig === 'object') return avatarConfig as AvatarConfig;
		try {
			return JSON.parse(avatarConfig) as AvatarConfig;
		} catch (e) {
			return null;
		}
	});

	const sortedFeatures = $derived.by((): PlacedFeature[] => {
		if (!parsedConfig || !parsedConfig.features) return [];

		const features = parsedConfig.features
			.map((f): PlacedFeature => {
				const template = getAvatarFeaturesMap().get(f.templateId);
				return {
					...f,
					svgContent: template ? template.svgContent : '',
					name: template ? template.name : ''
				};
			})
			.filter((f) => f.svgContent);

		return [...features].sort((a, b) => {
			return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
		});
	});

	const skinColor = $derived(
		isValidHex(parsedConfig?.skinColor) ? parsedConfig.skinColor : '#FFCDB2'
	);
	const hairColor = $derived(
		isValidHex(parsedConfig?.hairColor) ? parsedConfig.hairColor : '#3E2723'
	);
	const eyeColor = $derived(isValidHex(parsedConfig?.eyeColor) ? parsedConfig.eyeColor : '#4CAF50');
	const eyebrowColor = $derived(
		isValidHex(parsedConfig?.eyebrowColor) ? parsedConfig.eyebrowColor : '#5D4037'
	);
	const lipColor = $derived(isValidHex(parsedConfig?.lipColor) ? parsedConfig.lipColor : '#e64a19');
	const bgColor = $derived(
		isValidHex(parsedConfig?.bgColor)
			? parsedConfig.bgColor
			: isValidHex(fallbackColor)
				? fallbackColor
				: '#3b82f6'
	);

	const hairColors = $derived(getHairShades(hairColor));
	const lipColors = $derived(getLipShades(lipColor));

	const initials = $derived.by(() => {
		if (!fallbackName) return '';
		return fallbackName.trim().substring(0, 2).toUpperCase();
	});

	const avatarId = `avatar-${++avatarCounter}`;
</script>

<div
	class="relative flex items-center justify-center overflow-hidden {className}"
	style="background-color: {bgColor};"
>
	{#if parsedConfig && sortedFeatures.length > 0}
		<svg
			viewBox="0 0 200 200"
			class="pointer-events-none h-full w-full select-none"
			xmlns="http://www.w3.org/2000/svg"
			style="--skin-color: {skinColor}; --hair-color: {hairColor}; --hair-shadow: {hairColors.shadow}; --hair-light: {hairColors.light}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor}; --lip-color-light: {lipColor}; --lip-color-dark: {lipColors.dark};"
		>
			{#each sortedFeatures as f (f.id)}
				<g
					transform="translate({f.x} {f.y}) translate(100 100) rotate({f.rotation}) scale({f.scaleX} {f.scaleY}) translate(-100 -100)"
				>
					<!-- must only render trusted AVATAR_FEATURES content — never user-supplied strings -->
					{@html namespaceSvgGradients(f.svgContent, avatarId)}
				</g>
			{/each}
		</svg>
	{:else}
		<span class="text-[1.5em] font-bold text-white select-none">{initials}</span>
	{/if}
</div>
