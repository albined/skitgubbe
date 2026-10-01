import { expect, test } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from 'three';
import { createPillarGeometry, PILLAR } from '../src/lib/components/lobby/pillarGeometry';
import { splitTally } from '../src/lib/components/lobby/pillarTally';

test('tallies preserve exact totals with a bounded number of strokes', () => {
	for (const total of [0, 1, 4, 5, 24, 25, 26, 78, 100, 999, 1000000]) {
		const { bundles, remainder } = splitTally(total);
		expect(bundles * 25 + remainder).toBe(total);
		expect(remainder).toBeLessThan(25);
	}
	expect(splitTally(NaN)).toEqual({ bundles: 0, remainder: 0 });
	expect(splitTally(-1)).toEqual({ bundles: 0, remainder: 0 });
});

test('pillar artwork clips to the wood and preserves separate lightmap islands', () => {
	const source = new BufferGeometry();
	const x = PILLAR.x;
	source.setAttribute(
		'position',
		new Float32BufferAttribute([x, 0, 4, x, 0, 0, x, 4, 4, x, 0, 0, x, 4, 0, x, 4, 4], 3)
	);
	source.setAttribute('uv1', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1], 2));
	const root = new Group();
	root.add(new Mesh(source, new MeshBasicMaterial()));
	const geometry = createPillarGeometry(root);
	const positions = geometry.getAttribute('position'),
		uv = geometry.getAttribute('uv'),
		light = geometry.getAttribute('uv1');
	expect(positions.count).toBeGreaterThan(0);
	for (let i = 0; i < positions.count; i++) {
		expect(positions.getX(i)).toBeCloseTo(x + 0.001, 5);
		expect(uv.getX(i)).toBeGreaterThanOrEqual(-0.00001);
		expect(uv.getX(i)).toBeLessThanOrEqual(1.00001);
		expect(uv.getY(i)).toBeGreaterThanOrEqual(-0.00001);
		expect(uv.getY(i)).toBeLessThanOrEqual(1.00001);
	}
	for (let i = 0; i < positions.count; i += 3) {
		expect(light.getX(i)).toBe(light.getX(i + 1));
		expect(light.getX(i)).toBe(light.getX(i + 2));
	}
});
