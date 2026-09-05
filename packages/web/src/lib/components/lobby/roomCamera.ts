/** Preserve the reference view's horizontal coverage, revealing/cropping vertically. */
export function verticalFovForAspect(
	referenceVerticalFov: number,
	referenceAspect: number,
	viewportAspect: number
): number {
	const horizontalHalfExtent = Math.tan((referenceVerticalFov * Math.PI) / 360) * referenceAspect;
	return (Math.atan(horizontalHalfExtent / viewportAspect) * 360) / Math.PI;
}
