import { isAlienTVTime } from './alienTV';

export type RoomLightingMode = 'day' | 'night' | 'late-night';

export function getRoomLightingMode(date = new Date()): RoomLightingMode {
	const hour = date.getHours();
	if (hour >= 2 && hour < 4) return 'late-night';
	return isAlienTVTime(date) ? 'night' : 'day';
}

// Stable variation per burst, so the pattern does not depend on frame rate.
function noise(seed: number): number {
	const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
	return value - Math.floor(value);
}

function smoothstep(value: number): number {
	return value * value * (3 - 2 * value);
}

export function getRoomLightingMultiplier(mode: RoomLightingMode, timestamp: number): number {
	if (mode === 'day') return 1;
	if (mode === 'night') return 0.4;

	const baseline = 0.1;
	const cycle = Math.floor(timestamp / 15000);
	const seed = cycle * 17;
	// Long quiet stretches, then one to three uneven voltage dips. Each dip
	// falls quickly and relights more slowly, never flashing above the baseline.
	let start = cycle * 15000 + 2000 + noise(seed) * 6500;
	const count = 1 + Math.floor(noise(seed + 1) * 3);
	for (let i = 0; i < count; i++) {
		const duration = 140 + noise(seed + 2 + i * 3) * 200;
		const depth = 0.25 + noise(seed + 3 + i * 3) * 0.5;
		const progress = (timestamp - start) / duration;
		if (progress >= 0 && progress < 1) {
			const dip =
				progress < 0.15 ? smoothstep(progress / 0.15) : 1 - smoothstep((progress - 0.15) / 0.85);
			return baseline * (1 - depth * dip);
		}
		start += duration + 90 + noise(seed + 4 + i * 3) * 180;
	}
	return baseline;
}
