import { describe, expect, test } from 'bun:test';
import {
	getRoomLightingMode,
	getRoomLightingMultiplier
} from '../src/lib/components/lobby/roomLighting';
import { isAlienTVTime } from '../src/lib/components/lobby/alienTV';

describe('room lighting schedule', () => {
	for (const [hour, minute, mode] of [
		[1, 59, 'night'],
		[2, 0, 'late-night'],
		[3, 59, 'late-night'],
		[4, 0, 'night'],
		[5, 59, 'night'],
		[6, 0, 'day'],
		[21, 59, 'day'],
		[22, 0, 'night']
	] as const) {
		test(`${hour}:${minute} uses ${mode} lighting`, () => {
			const date = new Date(2026, 8, 8, hour, minute);
			expect(getRoomLightingMode(date)).toBe(mode);
			if (mode === 'late-night') expect(isAlienTVTime(date)).toBe(true);
		});
	}
});

test('late-night flicker stays dim, with brief irregular dips and long quiet stretches', () => {
	let quietSamples = 0;
	const bursts: number[] = [];
	let lastDip = -Infinity;
	for (let timestamp = 0; timestamp < 120000; timestamp += 10) {
		const intensity = getRoomLightingMultiplier('late-night', timestamp);
		expect(intensity).toBeGreaterThanOrEqual(0.025);
		expect(intensity).toBeLessThanOrEqual(0.1);
		if (intensity === 0.1) quietSamples++;
		else {
			if (timestamp - lastDip > 1000) bursts.push(timestamp);
			lastDip = timestamp;
		}
	}
	expect(quietSamples / 12000).toBeGreaterThan(0.85);
	expect(bursts.length).toBeGreaterThan(3);
	const gaps = bursts.slice(1).map((start, i) => start - bursts[i]);
	expect(new Set(gaps).size).toBeGreaterThan(1);
});

test('leaving the late-night window restores steady lighting immediately', () => {
	for (let timestamp = 0; timestamp < 30000; timestamp += 100) {
		expect(getRoomLightingMultiplier('night', timestamp)).toBe(0.4);
		expect(getRoomLightingMultiplier('day', timestamp)).toBe(1);
	}
});
