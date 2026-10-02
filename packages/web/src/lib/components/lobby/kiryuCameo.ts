import {
	DirectionalLight,
	Group,
	HemisphereLight,
	Mesh,
	SkinnedMesh,
	type Skeleton,
	Texture
} from 'three';
import { createKiryuAnimation } from './kiryuAnimation';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Long rests between small, smoothly eased glances. No pose jumps at loop boundaries.
export function kiryuIdlePose(seconds: number) {
	const phase = seconds % 53;
	const ease = (start: number, duration: number) =>
		phase > start && phase < start + duration
			? Math.sin(((phase - start) / duration) * Math.PI) ** 2
			: 0;
	const glance = ease(7, 10) - ease(34, 12) * 0.65;
	const breath = Math.sin((seconds * Math.PI * 2) / 5.8);
	return {
		breath: breath * 0.012,
		rise: breath * 0.002,
		settle: ease(20, 12) * 0.025,
		glance: glance * 0.16,
		nod: Math.abs(glance) * 0.03 + breath * 0.005
	};
}

export async function createKiryuCameo() {
	const gltf = await new GLTFLoader().loadAsync('/lobby/kiryu-sofa.glb');
	const group = new Group();
	group.name = 'Evening sofa guest';
	const character = gltf.scene;
	// Blender +Z becomes glTF +Y. The back sofa faces along the room's +X axis.
	character.position.set(-1.64, 0.04, 0.6);
	character.rotation.y = Math.PI / 2;
	group.add(character);
	const ambient = new HemisphereLight(0xffecd7, 0x534034, 1.6);
	const lamp = new DirectionalLight(0xffdab0, 2.1);
	lamp.position.set(0, 3, 1);
	lamp.target.position.set(-1.64, 0.8, 0.6);
	group.add(ambient, lamp, lamp.target);

	character.traverse((object) => {
		if (object instanceof Mesh) object.frustumCulled = false;
	});
	const animate = createKiryuAnimation(character);
	const previewPose = new URLSearchParams(window.location.search).get('pose');
	const previewTimes = new Map([
		['stretch', 14],
		['scratch', 31],
		['neck', 66],
		['lounge', 55]
	]);
	let elapsed = previewTimes.get(previewPose ?? '') ?? 0;
	group.visible = false;

	return {
		group,
		update(delta: number, visible: boolean, lightMultiplier: number) {
			group.visible = visible;
			if (!visible) return false;
			elapsed += Math.min(delta, 0.05);
			animate(elapsed, kiryuIdlePose(elapsed));
			ambient.intensity = 1.6 * lightMultiplier;
			lamp.intensity = 2.1 * lightMultiplier;
			return true;
		},
		dispose() {
			const textures = new Set<Texture>();
			const skeletons = new Set<Skeleton>();
			character.traverse((object) => {
				if (!(object instanceof Mesh)) return;
				if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
				object.geometry.dispose();
				for (const material of Array.isArray(object.material)
					? object.material
					: [object.material]) {
					for (const value of Object.values(material)) {
						if (value instanceof Texture) textures.add(value);
					}
					material.dispose();
				}
			});
			textures.forEach((texture) => texture.dispose());
			skeletons.forEach((skeleton) => skeleton.dispose());
			lamp.dispose();
			group.removeFromParent();
		}
	};
}
