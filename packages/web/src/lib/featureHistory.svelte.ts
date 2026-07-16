export interface AvatarState {
	features: any[];
	skinColor: string;
	hairColor: string;
	eyeColor: string;
	eyebrowColor: string;
	lipColor: string;
	bgColor: string;
}

export class FeatureHistory {
	history = $state<AvatarState[]>([]);
	historyIndex = $state(-1);

	get current(): AvatarState | null {
		return this.historyIndex >= 0 ? this.history[this.historyIndex] : null;
	}

	get canUndo(): boolean {
		return this.historyIndex > 0;
	}

	get canRedo(): boolean {
		return this.historyIndex < this.history.length - 1;
	}

	reset(initialState: AvatarState): void {
		this.history = [JSON.parse(JSON.stringify(initialState))];
		this.historyIndex = 0;
	}

	push(state: AvatarState): void {
		const newState = JSON.parse(JSON.stringify(state));

		// Avoid pushing identical duplicate state back-to-back
		if (this.historyIndex >= 0) {
			const curr = this.history[this.historyIndex];
			if (JSON.stringify(curr) === JSON.stringify(newState)) {
				return;
			}
		}

		this.history = [...this.history.slice(0, this.historyIndex + 1), newState];
		this.historyIndex = this.history.length - 1;
	}

	undo(): AvatarState | null {
		if (this.canUndo) {
			this.historyIndex--;
			return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
		}
		return null;
	}

	redo(): AvatarState | null {
		if (this.canRedo) {
			this.historyIndex++;
			return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
		}
		return null;
	}
}
