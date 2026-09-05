import { expect, test } from 'bun:test';
import {
	calculateNoticeBoardPlacement,
	BOARD_WIDTH,
	BOARD_CENTER_Y,
	ROPE_BOARD_ANCHOR_Y
} from '../src/lib/components/lobby/noticeBoardPlacement';

test('notice board width scales dynamically to 0.64x button width (20% smaller) on desktop', () => {
	const viewportWidth = 1440;
	const viewportHeight = 900;
	const aspect = viewportWidth / viewportHeight;
	const fov = 50;
	const depth = 2.0;
	const buttonWidth = 450;
	const ceilingPivot = 0.8;

	const placement = calculateNoticeBoardPlacement({
		viewportWidth,
		viewportHeight,
		aspect,
		fov,
		depth,
		layoutScale: 1.0,
		horizontalOffsetPercent: 0,
		ropeLengthSetting: 1.0,
		buttonWidth,
		ceilingPivot
	});

	// Target pixel width should be roughly 0.64x of button width (20% smaller than 0.8x)
	expect(placement.targetPixelWidth).toBeCloseTo(450 * 0.64, 5);

	// The projected on-screen pixel width from 3D worldScale should match targetPixelWidth
	const halfFovTangent = Math.tan((fov * Math.PI) / 360);
	const frustumWidth = 2 * depth * halfFovTangent * aspect;
	const projectedPixelWidth = ((placement.worldScale * BOARD_WIDTH) / frustumWidth) * viewportWidth;
	expect(projectedPixelWidth).toBeCloseTo(placement.targetPixelWidth, 5);
});

test('rope length places the center of the board at screen center (ndcY = 0) on desktop', () => {
	const viewportWidth = 1920;
	const viewportHeight = 1080;
	const aspect = viewportWidth / viewportHeight;
	const fov = 50;
	const depth = 2.0;
	const ceilingPivot = 1.2;

	const placement = calculateNoticeBoardPlacement({
		viewportWidth,
		viewportHeight,
		aspect,
		fov,
		depth,
		layoutScale: 1.0,
		horizontalOffsetPercent: 0,
		ropeLengthSetting: 1.0,
		buttonWidth: 420,
		ceilingPivot
	});

	// On desktop, targetNdcY is 0 (exact vertical screen center)
	expect(placement.targetNdcY).toBe(0);

	// Board center in camera local space must be at targetCameraY = targetNdcY * depth * tan(fov / 2) = 0
	const boardCenterCameraY =
		(ceilingPivot + BOARD_CENTER_Y - ROPE_BOARD_ANCHOR_Y) * placement.worldScale -
		placement.effectiveRopeLength;

	expect(boardCenterCameraY).toBeCloseTo(0, 5);
});

test('notice board is lowered with ample rope length in portrait mode and 20% smaller', () => {
	const viewportWidth = 390;
	const viewportHeight = 844;
	const aspect = viewportWidth / viewportHeight;
	const fov = 85; // Wide FOV on mobile
	const depth = 2.0;
	const buttonWidth = 350;
	const buttonTop = 450;
	const ceilingPivot = 1.5;

	const placement = calculateNoticeBoardPlacement({
		viewportWidth,
		viewportHeight,
		aspect,
		fov,
		depth,
		layoutScale: 1.0,
		horizontalOffsetPercent: 0,
		ropeLengthSetting: 1.0,
		buttonWidth,
		buttonTop,
		ceilingPivot
	});

	// On mobile portrait, board must be centered horizontally (ndcX = 0)
	expect(placement.targetNdcX).toBe(0);

	// Board width should be 0.64x button width (224px)
	expect(placement.targetPixelWidth).toBeCloseTo(224, 5);

	// Target vertical position should be lowered down near center (targetNdcY = 0.08, NOT way up at 0.5)
	expect(placement.targetNdcY).toBeLessThan(0.15);

	// Ensure rope is at least 35% of board height, never hugging the ceiling
	expect(placement.effectiveRopeLength).toBeGreaterThan(0.35 * placement.worldScale);
});
