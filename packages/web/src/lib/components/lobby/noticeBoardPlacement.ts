export interface NoticeBoardAnchor {
	left: number;
	top: number;
	width: number;
	height: number;
	viewportWidth: number;
	viewportHeight: number;
	buttonWidth?: number;
	buttonTop?: number;
}

export interface NoticeBoardPlacementInput {
	viewportWidth: number;
	viewportHeight: number;
	aspect: number;
	fov: number;
	depth: number;
	layoutScale: number;
	horizontalOffsetPercent: number;
	ropeLengthSetting: number;
	buttonWidth?: number;
	buttonTop?: number;
	anchorWidth?: number;
	ceilingPivot: number;
}

export interface NoticeBoardPlacementResult {
	worldScale: number;
	targetNdcX: number;
	targetNdcY: number;
	localX: number;
	localY: number;
	effectiveRopeLength: number;
	targetPixelWidth: number;
}

// Canonical screen composition used to place the board once in room space.
export const NOTICE_BOARD_DESIGN = {
	viewAspect: 1440 / 900,
	centerNdcX: -0.3666666667,
	centerNdcY: 0.1493333333,
	heightFraction: 496 / 900,
	cameraFovDegrees: 45.747
} as const;

export const BOARD_WIDTH = 1499 / 2048;
export const BOARD_CENTER_Y = -0.18;
export const ROPE_BOARD_ANCHOR_Y = BOARD_CENTER_Y + 1027 / 2048 / 2 - 0.015;

export function calculateNoticeBoardPlacement(
	input: NoticeBoardPlacementInput
): NoticeBoardPlacementResult {
	const {
		viewportWidth,
		viewportHeight,
		aspect,
		fov,
		depth,
		layoutScale,
		horizontalOffsetPercent,
		ropeLengthSetting,
		buttonWidth,
		buttonTop,
		anchorWidth,
		ceilingPivot
	} = input;

	const safeVpWidth = Math.max(1, viewportWidth);
	const safeVpHeight = Math.max(1, viewportHeight);
	const halfFovTangent = Math.tan((fov * Math.PI) / 360);
	const frustumWidth = 2 * depth * halfFovTangent * aspect;
	const isPortrait = aspect < 1.0;

	// 1. Dynamic Size: Board appears 20% smaller (0.64x the button width instead of 0.8x)
	let targetPixelWidth: number;
	let worldScale: number;

	if (buttonWidth && buttonWidth > 0) {
		targetPixelWidth = buttonWidth * 0.64;
		const targetWorldWidth = (targetPixelWidth / safeVpWidth) * frustumWidth;
		worldScale = (targetWorldWidth / BOARD_WIDTH) * layoutScale;
	} else if (anchorWidth && anchorWidth > 0) {
		targetPixelWidth = anchorWidth * 0.8;
		const targetWorldWidth = (targetPixelWidth / safeVpWidth) * frustumWidth;
		worldScale = (targetWorldWidth / BOARD_WIDTH) * layoutScale;
	} else {
		worldScale =
			2 * depth * halfFovTangent * NOTICE_BOARD_DESIGN.heightFraction * layoutScale * 0.8;
		targetPixelWidth = ((BOARD_WIDTH * worldScale) / frustumWidth) * safeVpWidth;
	}

	// 2. Horizontal position:
	// Centered on mobile portrait (ndcX = 0), left column on desktop/landscape
	const targetNdcX =
		(isPortrait ? 0 : NOTICE_BOARD_DESIGN.centerNdcX) + horizontalOffsetPercent / 50;
	const localX = targetNdcX * depth * halfFovTangent * aspect;

	// 3. Vertical position:
	// Desktop/landscape: center of screen (targetNdcY = 0, i.e. 50% viewport height)
	// Mobile portrait: lowered down from the ceiling into the upper-middle area with generous rope length
	let targetNdcY: number;
	if (isPortrait) {
		targetNdcY = 0.08;
	} else {
		targetNdcY = 0; // True screen center vertically on desktop
	}

	const localY = 0; // Group placed at camera baseline height

	// 4. Dynamic Rope Length:
	// targetCameraY is local camera Y height for targetNdcY at depth
	const targetCameraY = targetNdcY * depth * halfFovTangent;

	// Exact rope length so that board center sits at targetCameraY:
	// boardCenterY = (ceilingPivot + BOARD_CENTER_Y - ROPE_BOARD_ANCHOR_Y) * worldScale - ropeLength = targetCameraY
	const dynamicRopeLength =
		(ceilingPivot + BOARD_CENTER_Y - ROPE_BOARD_ANCHOR_Y) * worldScale - targetCameraY;

	// Allow manual tuner rope length to offset the dynamic value (default 1.0 = 0 offset)
	const ropeOffset = ropeLengthSetting - 1.0;
	const minRopeLength = isPortrait ? 0.35 * worldScale : 0.08;
	const effectiveRopeLength = Math.max(minRopeLength, dynamicRopeLength + ropeOffset);

	return {
		worldScale,
		targetNdcX,
		targetNdcY,
		localX,
		localY,
		effectiveRopeLength,
		targetPixelWidth
	};
}
