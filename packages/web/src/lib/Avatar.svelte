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

	const CATEGORY_ORDER = [
		'hair_back',
		'head',
		'mouth',
		'beard',
		'eyes',
		'nose',
		'other',
		'eyebrows',
		'glasses',
		'hair_front'
	];

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
				.skin-color {
					fill: var(--skin-color, #ffcdb2);
				}
				.hair-color {
					fill: var(--hair-color, #3e2723);
					stop-color: var(--hair-color, #3e2723);
				}
				.hair-shadow {
					fill: var(--hair-shadow, #24140e);
					stop-color: var(--hair-shadow, #24140e);
				}
				.hair-light {
					fill: var(--hair-light, #583e32);
					stop-color: var(--hair-light, #583e32);
				}
				.eye-color {
					fill: var(--eye-color, #4caf50);
				}
				.eyebrow-color {
					fill: var(--eyebrow-color, #5d4037);
				}
				.lip-color-light {
					fill: var(--lip-color-light, #e64a19);
				}
				.lip-color-dark {
					fill: var(--lip-color-dark, #d84315);
				}
			</style>

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
