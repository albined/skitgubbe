import { describe, expect, test } from 'bun:test';
import { getAlienTVSource, isAlienTVTime } from '../src/lib/components/lobby/alienTV';

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

describe('alien TV daily rotation', () => {
	test('cycles through all three broadcasts, starting with the cow interview on September 8', () => {
		expect(getAlienTVSource(new Date(2026, 8, 8, 22))).toBe('/lobby/alien-tv-cow-interview.mp4');
		expect(getAlienTVSource(new Date(2026, 8, 9, 22))).toBe('/lobby/alien-tv-video.mp4');
		expect(getAlienTVSource(new Date(2026, 8, 10, 22))).toBe('/lobby/alien-tv-alien-interview.mp4');
		expect(getAlienTVSource(new Date(2026, 8, 11, 22))).toBe('/lobby/alien-tv-cow-interview.mp4');
	});

	test('also selects a broadcast for dates before the rotation anchor', () => {
		expect(getAlienTVSource(new Date(2026, 8, 7, 22))).toBe('/lobby/alien-tv-alien-interview.mp4');
	});

	test('keeps the same broadcast throughout a local calendar day', () => {
		const source = getAlienTVSource(new Date(2026, 8, 8));
		for (const hour of [0, 2, 5, 12, 22, 23]) {
			expect(getAlienTVSource(new Date(2026, 8, 8, hour, 59))).toBe(source);
		}
	});

	for (const [year, month, day] of [
		[2026, 8, 30],
		[2026, 11, 31],
		[2026, 2, 29],
		[2026, 9, 25]
	]) {
		test(`alternates across midnight at ${year}-${month + 1}-${day}, including month/year and DST boundaries`, () => {
			const before = new Date(year, month, day, 23, 59);
			const after = new Date(year, month, day + 1, 0, 0);
			expect(getAlienTVSource(before)).not.toBe(getAlienTVSource(after));
			expect(getAlienTVSource(new Date(year, month, day + 3))).toBe(getAlienTVSource(before));
		});
	}
});
