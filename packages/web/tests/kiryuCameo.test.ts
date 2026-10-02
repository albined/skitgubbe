import { describe, expect, test } from 'bun:test';
import { kiryuIdlePose } from '../src/lib/components/lobby/kiryuCameo';
import { createKiryuSchedule, isKiryuEvening } from '../src/lib/components/lobby/kiryuSchedule';
import { kiryuGestures } from '../src/lib/components/lobby/kiryuAnimation';

describe('evening sofa cameo', () => {
	test.each([
		[18, 59, false],
		[19, 0, true],
		[22, 59, true],
		[23, 0, false],
		[0, 0, false],
		[2, 0, false]
	])('uses local evening hours at %s:%s', (hour, minute, visible) => {
		expect(isKiryuEvening(new Date(2026, 9, 2, hour as number, minute as number))).toBe(visible);
	});
	test('draws once per local day, persists both outcomes, and respects closing time', () => {
		const data = new Map<string, string>();
		const storage = () => ({
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => {
				data.set(key, value);
			}
		});
		let draws = 0;
		const schedule = createKiryuSchedule(storage, () => (++draws === 1 ? 0.49 : 0.5));
		expect(schedule(new Date(2026, 9, 2, 18))).toBe(false);
		expect(draws).toBe(0);
		expect(schedule(new Date(2026, 9, 2, 19))).toBe(true);
		expect(schedule(new Date(2026, 9, 2, 22, 59))).toBe(true);
		expect(schedule(new Date(2026, 9, 2, 23))).toBe(false);
		expect(draws).toBe(1);
		const reload = () =>
			createKiryuSchedule(storage, () => {
				throw new Error('Must reuse daily decision');
			});
		expect(reload()(new Date(2026, 9, 2, 20))).toBe(true);
		expect(schedule(new Date(2026, 9, 3, 19))).toBe(false);
		expect(reload()(new Date(2026, 9, 3, 20))).toBe(false);
		expect(draws).toBe(2);
	});
	test('does not reroll each frame when storage is blocked', () => {
		let draws = 0;
		const schedule = createKiryuSchedule(
			() => {
				throw new Error('Blocked');
			},
			() => {
				draws++;
				return 0.2;
			}
		);
		for (let i = 0; i < 60; i++) expect(schedule(new Date(2026, 9, 2, 20))).toBe(true);
		expect(draws).toBe(1);
	});
	test('rests between glances and stays continuous across the loop boundary', () => {
		expect(kiryuIdlePose(5).glance).toBe(0);
		expect(kiryuIdlePose(12).glance).toBeCloseTo(0.16);
		expect(kiryuIdlePose(40).glance).toBeCloseTo(-0.104);
		expect(kiryuIdlePose(50).glance).toBe(0);
		for (const boundary of [7, 17, 20, 32, 34, 46, 53]) {
			const before = kiryuIdlePose(boundary - 0.001);
			const after = kiryuIdlePose(boundary + 0.001);
			expect(Math.abs(before.glance - after.glance)).toBeLessThan(0.00001);
			expect(Math.abs(before.breath - after.breath)).toBeLessThan(0.00003);
			expect(Math.abs(before.settle - after.settle)).toBeLessThan(0.00001);
		}
	});
});

describe('expressive seated gestures', () => {
	test('includes stretches, scratches, neck rolls, and a sustained second pose', () => {
		expect(kiryuGestures(14).stretch).toBe(1);
		expect(kiryuGestures(32).scratch).toBe(1);
		expect(kiryuGestures(66).neck).toBe(1);
		for (const time of [51, 60, 75, 84]) expect(kiryuGestures(time).lounge).toBe(1);
		for (const time of [0, 25, 40, 95, 115]) {
			const pose = kiryuGestures(time);
			expect(pose.stretch + pose.scratch + pose.neck + pose.lounge).toBe(0);
		}
	});
	test('eases through every transition without conflicting arm gestures', () => {
		for (let frame = 0; frame <= 120 * 60; frame++) {
			const pose = kiryuGestures(frame / 60);
			const next = kiryuGestures((frame + 1) / 60);
			for (const key of ['stretch', 'scratch', 'neck', 'lounge'] as const) {
				expect(pose[key]).toBeGreaterThanOrEqual(0);
				expect(pose[key]).toBeLessThanOrEqual(1);
				expect(Math.abs(next[key] - pose[key])).toBeLessThan(0.013);
			}
			expect(
				pose.stretch * pose.scratch + pose.stretch * pose.lounge + pose.scratch * pose.lounge
			).toBe(0);
		}
	});
});
