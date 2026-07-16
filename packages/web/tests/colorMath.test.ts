import { describe, test, expect } from 'bun:test';
import { hexToHSL, hslToHex, snapHue, snapLightness, snapSaturation } from '../src/lib/colorMath';

describe('Color Math Helpers', () => {
	test('hexToHSL conversion', () => {
		// Test white
		const white = hexToHSL('#ffffff');
		expect(white.l).toBe(100);

		// Test black
		const black = hexToHSL('#000000');
		expect(black.l).toBe(0);

		// Test red
		const red = hexToHSL('#ff0000');
		expect(red.h).toBe(0);
		expect(red.s).toBe(100);

		// Test green
		const green = hexToHSL('#00ff00');
		expect(green.h).toBe(120);

		// Test shorthand hex
		const shorthand = hexToHSL('#fff');
		expect(shorthand.l).toBe(100);
	});

	test('hslToHex conversion', () => {
		// Test white
		expect(hslToHex(0, 0, 100)).toBe('#FFFFFF');

		// Test black
		expect(hslToHex(0, 0, 0)).toBe('#000000');

		// Test red
		expect(hslToHex(0, 100, 50)).toBe('#FF0000');
	});

	test('Round trip conversion', () => {
		const originalHex = '#3E2723'; // Dark brown
		const hsl = hexToHSL(originalHex);
		const roundTripHex = hslToHex(hsl.h, hsl.s, hsl.l);
		// Note: Rounding in HSL conversion can cause small shifts (e.g. #3E2723 -> #3E2722)
		// but should be extremely close.
		const r = parseInt(originalHex.substring(1, 3), 16);
		const g = parseInt(originalHex.substring(3, 5), 16);
		const b = parseInt(originalHex.substring(5, 7), 16);

		const rtR = parseInt(roundTripHex.substring(1, 3), 16);
		const rtG = parseInt(roundTripHex.substring(3, 5), 16);
		const rtB = parseInt(roundTripHex.substring(5, 7), 16);

		expect(Math.abs(r - rtR)).toBeLessThanOrEqual(2);
		expect(Math.abs(g - rtG)).toBeLessThanOrEqual(2);
		expect(Math.abs(b - rtB)).toBeLessThanOrEqual(2);
	});

	test('Snapping functions', () => {
		expect(snapHue(12)).toBe(10);
		expect(snapHue(50)).toBe(45);
		expect(snapHue(150)).toBe(120);

		expect(snapLightness(90)).toBe(92);
		expect(snapLightness(50)).toBe(55);

		expect(snapSaturation(90)).toBe(85);
		expect(snapSaturation(10)).toBe(12);
	});
});
