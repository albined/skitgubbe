import type { PlacedFeature, StoredAvatarFeature } from './avatarFeatures.svelte';

export interface AvatarState {
	features: PlacedFeature[];
	skinColor: string;
	hairColor: string;
	eyeColor: string;
	eyebrowColor: string;
	lipColor: string;
	bgColor: string;
}

export interface SerializedAvatarState {
	features: StoredAvatarFeature[];
	skinColor: string;
	hairColor: string;
	eyeColor: string;
	eyebrowColor: string;
	lipColor: string;
	bgColor: string;
}

function serialize(state: AvatarState): SerializedAvatarState {
	return {
		features: state.features.map(({ svgContent, name, ...rest }) => rest),
		skinColor: state.skinColor,
		hairColor: state.hairColor,
		eyeColor: state.eyeColor,
		eyebrowColor: state.eyebrowColor,
		lipColor: state.lipColor,
		bgColor: state.bgColor
	};
}

function deserialize(
	state: SerializedAvatarState,
	resolver?: (templateId: string) => { svgContent: string; name: string } | undefined
): AvatarState {
	return {
		features: state.features.map((f): PlacedFeature => {
			const resolved = resolver ? resolver(f.templateId) : undefined;
			if (resolved) {
				return {
					...f,
					svgContent: resolved.svgContent,
					name: resolved.name
				};
			}
			const restored: any = { ...f };
			if ('svgContent' in f || 'name' in f) {
				restored.svgContent = (f as any).svgContent || '';
				restored.name = (f as any).name || '';
			} else if (f.templateId) {
				restored.svgContent = '';
				restored.name = '';
			}
			return restored;
		}),
		skinColor: state.skinColor,
		hairColor: state.hairColor,
		eyeColor: state.eyeColor,
		eyebrowColor: state.eyebrowColor,
		lipColor: state.lipColor,
		bgColor: state.bgColor
	};
}

export class FeatureHistory {
	history = $state<SerializedAvatarState[]>([]);
	historyIndex = $state(-1);
	featuresResolver?: (templateId: string) => { svgContent: string; name: string } | undefined;

	constructor(featuresResolver?: (templateId: string) => { svgContent: string; name: string } | undefined) {
		this.featuresResolver = featuresResolver;
	}

	get current(): AvatarState | null {
		return this.historyIndex >= 0 ? deserialize(this.history[this.historyIndex], this.featuresResolver) : null;
	}

	get canUndo(): boolean {
		return this.historyIndex > 0;
	}

	get canRedo(): boolean {
		return this.historyIndex < this.history.length - 1;
	}

	reset(initialState: AvatarState): void {
		this.history = [serialize(initialState)];
		this.historyIndex = 0;
	}

	push(state: AvatarState): void {
		const newState = serialize(state);

		// Avoid pushing identical duplicate state back-to-back
		if (this.historyIndex >= 0) {
			const curr = this.history[this.historyIndex];
			if (JSON.stringify(curr) === JSON.stringify(newState)) {
				return;
			}
		}

		this.history = [...this.history.slice(0, this.historyIndex + 1), newState];
		if (this.history.length > 100) {
			this.history = this.history.slice(this.history.length - 100);
		}
		this.historyIndex = this.history.length - 1;
	}

	undo(): AvatarState | null {
		if (this.canUndo) {
			this.historyIndex--;
			return deserialize(this.history[this.historyIndex], this.featuresResolver);
		}
		return null;
	}

	redo(): AvatarState | null {
		if (this.canRedo) {
			this.historyIndex++;
			return deserialize(this.history[this.historyIndex], this.featuresResolver);
		}
		return null;
	}
}
