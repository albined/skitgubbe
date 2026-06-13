<script lang="ts">
	let confetti: any = null;

	// Default premium color palette for standard bursts
	const DEFAULT_COLORS = [
		'#f59e0b', // Amber
		'#10b981', // Emerald
		'#3b82f6', // Blue
		'#ef4444', // Red
		'#8b5cf6', // Violet
		'#ec4899', // Pink
		'#06b6d4', // Cyan
		'#f97316' // Orange
	];

	/**
	 * Fires a dual-cannon confetti celebration from the bottom-left and bottom-right corners.
	 * If a primaryColorHex is provided (e.g. from the escaping player's profile),
	 * the confetti colors will bias towards that player's theme color mixed with gold/white accents.
	 */
	export async function fire(primaryColorHex?: string) {
		if (!confetti) {
			const module = await import('canvas-confetti');
			confetti = module.default;
		}

		const colors = primaryColorHex
			? [primaryColorHex, '#ffffff', '#ffd700', '#f59e0b', '#8b5cf6']
			: DEFAULT_COLORS;

		// Left cannon shooting inwards and upwards
		confetti({
			particleCount: 100,
			angle: 60,
			spread: 60,
			origin: { x: 0, y: 0.9 },
			colors
		});

		// Right cannon shooting inwards and upwards
		confetti({
			particleCount: 100,
			angle: 120,
			spread: 60,
			origin: { x: 1, y: 0.9 },
			colors
		});
	}
</script>
