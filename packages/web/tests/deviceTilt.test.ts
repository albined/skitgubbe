import { describe, expect, test } from 'bun:test';
import { DeviceTilt } from '../src/lib/components/lobby/deviceTilt';

describe('device tilt', () => {
	test('stays continuous across the gamma representation boundary', () => {
		const tilt = new DeviceTilt();
		tilt.update(0, 45, 89, 0);
		const result = tilt.update(180, 135, -89, 0)!;
		expect(result.horizontal).toBeCloseTo(2, 6);
		expect(result.vertical).toBeCloseTo(0, 6);
	});

	test('ignores heading wrap and maps landscape tilt to screen axes', () => {
		const tilt = new DeviceTilt();
		tilt.update(359, 0, 0, 90);
		const result = tilt.update(1, 10, 0, 90)!;
		expect(result.horizontal).toBeCloseTo(10, 6);
		expect(Math.abs(result.vertical)).toBeLessThan(0.2);
	});

	test('recalibrates on rotation and resume and rejects invalid readings', () => {
		const tilt = new DeviceTilt();
		tilt.update(10, 45, 20, 0);
		expect(tilt.update(20, 60, 30, 90)!.horizontal).toBeCloseTo(0);
		tilt.reset();
		expect(tilt.update(40, 80, 40, 90)!.vertical).toBeCloseTo(0);
		expect(tilt.update(0, null, 0, 0)).toBeNull();
		expect(tilt.update(0, NaN, 0, 0)).toBeNull();
	});
});
