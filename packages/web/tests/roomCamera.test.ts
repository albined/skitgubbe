import { expect, test } from 'bun:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { verticalFovForAspect } from '../src/lib/components/lobby/roomCamera';

test('room points keep their horizontal framing across portrait, desktop and ultrawide', () => {
	for (const fov of [30, 45.75, 75]) {
		const reference = new PerspectiveCamera(fov, 1.6, 0.1, 100);
		for (const aspect of [412 / 915, 1, 1.6, 16 / 9, 32 / 9]) {
			const camera = new PerspectiveCamera(
				verticalFovForAspect(fov, 1.6, aspect),
				aspect,
				0.1,
				100
			);
			for (const point of [new Vector3(-1, 1, -4), new Vector3(2, -0.5, -8)]) {
				const expected = point.clone().project(reference);
				const actual = point.clone().project(camera);
				expect(actual.x).toBeCloseTo(expected.x, 10);
				// Equal horizontal/vertical scale in pixels: no stretching.
				expect(actual.y / aspect).toBeCloseTo(expected.y / 1.6, 10);
			}
		}
		expect(verticalFovForAspect(fov, 1.6, 1.6)).toBeCloseTo(fov, 10);
	}
});
