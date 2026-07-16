export interface AvatarFeatureTemplate {
	id: string;
	name: string;
	svgContent: string;
	defaultX: number;
	defaultY: number;
	defaultScaleX: number;
	defaultScaleY: number;
	zIndex: number;
}

export interface FeatureCategory {
	id: string;
	name: string;
	features: AvatarFeatureTemplate[];
}

// A feature placement as persisted in profiles.avatar_config JSON. svgContent
// and name are re-resolved from the template on load (older configs may still
// carry them inline).
export interface StoredAvatarFeature {
	id: string;
	category: string;
	templateId: string;
	x: number;
	y: number;
	scaleX: number;
	scaleY: number;
	rotation: number;
	zIndex: number;
	svgContent?: string;
	name?: string;
}

// A feature instance on the avatar canvas, template content resolved.
export interface PlacedFeature extends StoredAvatarFeature {
	svgContent: string;
	name: string;
}

// The parsed shape of profiles.avatar_config. All fields optional: configs
// written by older versions of the editor may miss any of them.
export interface AvatarConfig {
	features?: StoredAvatarFeature[];
	skinColor?: string;
	hairColor?: string;
	eyeColor?: string;
	eyebrowColor?: string;
	lipColor?: string;
	bgColor?: string;
}

export interface LipPreset {
	base: string;
	dark: string;
	name: string;
}

// Reactive array for categories, populated dynamically
export const AVATAR_FEATURES = $state<FeatureCategory[]>([]);

let loadPromise: Promise<void> | null = null;

export function loadAvatarFeatures(): Promise<void> {
	if (AVATAR_FEATURES.length > 0) {
		return Promise.resolve();
	}
	if (!loadPromise) {
		loadPromise = import('./avatarFeatures.json').then((module) => {
			AVATAR_FEATURES.push(...module.default);
		});
	}
	return loadPromise;
}

export const HAIR_PRESETS = [
	{ base: '#ECD2B5', light: '#FDE5CB', shadow: '#C5A785', name: 'Super blond' },
	{ base: '#E6B989', light: '#FCD0A0', shadow: '#C89F71', name: 'Gulaktig blond' },
	{ base: '#B97C4B', light: '#D79759', shadow: '#925E33', name: 'Blondbrun' },
	{ base: '#925B33', light: '#B9794B', shadow: '#6E4320', name: 'Ljusbrun' },
	{ base: '#6F3719', light: '#8D4B27', shadow: '#54240A', name: 'Hazelnut' },
	{ base: '#411F0B', light: '#562E14', shadow: '#2A1202', name: 'Superdark brown' },
	{ base: '#D89368', light: '#F1AA7E', shadow: '#B0734E', name: 'Strawberry blonde' },
	{ base: '#D47C46', light: '#F69960', shadow: '#B16334', name: 'Ginger' }
];

export function getHairShades(hairColor: string): { shadow: string; light: string } {
	const normalized = hairColor.toUpperCase().replace(/^#/, '');
	const preset = HAIR_PRESETS.find((p) => p.base.toUpperCase().replace(/^#/, '') === normalized);
	if (preset) {
		return { shadow: preset.shadow, light: preset.light };
	}
	return { shadow: '#2A1202', light: hairColor };
}

export function namespaceSvgGradients(svgContent: string, namespace: string): string {
	return svgContent.replaceAll('_grad_', `_grad_${namespace}_`);
}

export const LIP_PRESETS: LipPreset[] = [
	{ base: '#e64a19', dark: '#d84315', name: 'Classic Orange-Red' },
	{ base: '#EF5350', dark: '#E54343', name: 'Soft Coral-Red' },
	{ base: '#E53935', dark: '#C62828', name: 'Vibrant Crimson' },
	{ base: '#FF8A80', dark: '#FF5252', name: 'Peach Pink' },
	{ base: '#F48FB1', dark: '#F06292', name: 'Rose Pink' },
	{ base: '#D81B60', dark: '#C2185B', name: 'Magenta' },
	{ base: '#c21209ff', dark: '#9b0e07ff', name: 'Plum Purple' },
	{ base: '#d35c45ff', dark: '#b54732ff', name: 'Warm Nude' }
];

export function getLipShades(lipColor: string): { dark: string; light: string } {
	const normalized = lipColor.toUpperCase().replace(/^#/, '');
	const preset = LIP_PRESETS.find(
		(p) =>
			p.base.toUpperCase().replace(/^#/, '') === normalized ||
			p.dark.toUpperCase().replace(/^#/, '') === normalized
	);
	if (preset) {
		return { dark: preset.dark, light: preset.base };
	}
	return { dark: '#d84315', light: lipColor };
}
