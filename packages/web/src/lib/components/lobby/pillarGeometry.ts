import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3, type Object3D } from 'three';

// World coordinates on the broad wooden face of the left pillar in serena-room.glb.
// Keep the artwork above the moulding and clear of the hanging notice board.
export const PILLAR = { x: 1.8188095092773438, bottom: 1.1, top: 2.12, left: 2.85, right: 2.04 };
type Vertex = { position: Vector3; lightU: number; lightV: number };

function clip(vertices: Vertex[], axis: 'y' | 'z', bound: number, sign: number): Vertex[] {
	const result: Vertex[] = [];
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i],
			b = vertices[(i + 1) % vertices.length];
		const da = (a.position[axis] - bound) * sign,
			db = (b.position[axis] - bound) * sign;
		if (da >= 0) result.push(a);
		if (da >= 0 !== db >= 0) {
			const t = da / (da - db);
			result.push({
				position: a.position.clone().lerp(b.position, t),
				lightU: a.lightU + (b.lightU - a.lightU) * t,
				lightV: a.lightV + (b.lightV - a.lightV) * t
			});
		}
	}
	return result;
}

// Clip the actual surface triangles, preserving each triangle's lightmap UVs.
// A simple plane would interpolate across lightmap seams and produce false shadows.
export function createPillarGeometry(root: Object3D): BufferGeometry {
	root.updateWorldMatrix(true, true);
	const positions: number[] = [],
		uvs: number[] = [],
		lightUvs: number[] = [];
	root.traverse((object) => {
		if (!(object instanceof Mesh)) return;
		const geometry = object.geometry,
			position = geometry.getAttribute('position'),
			lighting = geometry.getAttribute('uv1');
		if (!position || !lighting) return;
		const count = geometry.index?.count ?? position.count;
		for (let i = 0; i < count; i += 3) {
			let polygon: Vertex[] = [];
			for (let j = 0; j < 3; j++) {
				const index = geometry.index ? geometry.index.getX(i + j) : i + j;
				polygon.push({
					position: new Vector3()
						.fromBufferAttribute(position, index)
						.applyMatrix4(object.matrixWorld),
					lightU: lighting.getX(index),
					lightV: lighting.getY(index)
				});
			}
			if (polygon.some((v) => Math.abs(v.position.x - PILLAR.x) > 0.0005)) continue;
			polygon = clip(polygon, 'y', PILLAR.bottom, 1);
			polygon = clip(polygon, 'y', PILLAR.top, -1);
			polygon = clip(polygon, 'z', PILLAR.right, 1);
			polygon = clip(polygon, 'z', PILLAR.left, -1);
			for (let j = 1; j < polygon.length - 1; j++) {
				for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
					positions.push(v.position.x + 0.001, v.position.y, v.position.z);
					uvs.push(
						(PILLAR.left - v.position.z) / (PILLAR.left - PILLAR.right),
						(v.position.y - PILLAR.bottom) / (PILLAR.top - PILLAR.bottom)
					);
					lightUvs.push(v.lightU, v.lightV);
				}
			}
		}
	});
	if (!positions.length) throw new Error('The tally pillar surface was not found.');
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	geometry.setAttribute('uv1', new Float32BufferAttribute(lightUvs, 2));
	return geometry;
}
