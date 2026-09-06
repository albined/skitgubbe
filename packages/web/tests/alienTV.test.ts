import { describe, expect, test } from 'bun:test';
import { isAlienTVTime } from '../src/lib/components/lobby/alienTV';

describe('alien TV local-time schedule', () => {
	for (const [hour, minute, visible] of [
		[0, 0, true],
		[5, 59, true],
		[6, 0, false],
		[12, 0, false],
		[21, 59, false],
		[22, 0, true],
		[23, 59, true]
	] as const) {
		test(`${hour}:${minute} is ${visible ? 'on' : 'off'}`, () => {
			expect(isAlienTVTime(new Date(2026, 8, 7, hour, minute))).toBe(visible);
		});
	}
});
