import type { ApiCurrentSkitgubbe } from 'shared';
import {
	BoxGeometry,
	CanvasTexture,
	Color,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	type Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	Quaternion,
	Raycaster,
	RepeatWrapping,
	SRGBColorSpace,
	Texture,
	Vector2,
	Vector3
} from 'three';
import {
	CATEGORY_ORDER,
	getAvatarFeaturesMap,
	getHairShades,
	getLipShades,
	loadAvatarFeatures,
	namespaceSvgGradients,
	type AvatarConfig
} from '$lib/avatarFeatures.svelte';

import {
	calculateNoticeBoardPlacement,
	NOTICE_BOARD_DESIGN,
	BOARD_WIDTH,
	BOARD_CENTER_Y,
	ROPE_BOARD_ANCHOR_Y,
	type NoticeBoardAnchor,
	type NoticeBoardPlacementInput,
	type NoticeBoardPlacementResult
} from './noticeBoardPlacement';

export type { NoticeBoardAnchor, NoticeBoardPlacementInput, NoticeBoardPlacementResult };
export { calculateNoticeBoardPlacement, NOTICE_BOARD_DESIGN };

export interface NoticeBoardLayout {
	depthMeters: number;
	ropeLengthMeters: number;
	scale: number;
	horizontalOffsetPercent: number;
	rotationDegrees: number;
	brightness: number;
	pushStrength: number;
	swingSpeed: number;
	swingDamping: number;
	twistStrength: number;
}

export interface NoticeBoardPush {
	horizontal: number;
	vertical: number;
}

const POSTER_WIDTH = 896;
const POSTER_HEIGHT = 1200;
const POSTER_TEXTURE_SCALE = 2;
const POSTER_ASPECT = POSTER_WIDTH / POSTER_HEIGHT;
const BOARD_FRONT_Z = 0.006;
const BOARD_CENTER_Z = -0.019;
const ROPE_X_POSITIONS = [-0.255, 0.255];
const CEILING_RAY_X_POSITIONS = [-0.255, 0, 0.255];
const ROPE_CEILING_PENETRATION = 0.025;
const ROPE_PLANE_WIDTH = 96 / 2048;
const ROPE_PATTERN_HEIGHT = 600 / 2048;
const WORLD_UP = new Vector3(0, 1, 0);
const MAX_SWING_ANGLE = (85 * Math.PI) / 180;
const MAX_TWIST_ANGLE = (85 * Math.PI) / 180;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/;

const AVATAR_SVG_STYLES = `<style>
.skin-color{fill:var(--skin-color,#ffcdb2)}
.hair-color{fill:var(--hair-color,#3e2723);stop-color:var(--hair-color,#3e2723)}
.hair-shadow{fill:var(--hair-shadow,#24140e);stop-color:var(--hair-shadow,#24140e)}
.hair-light{fill:var(--hair-light,#583e32);stop-color:var(--hair-light,#583e32)}
.eye-color{fill:var(--eye-color,#4caf50)}
.eyebrow-color{fill:var(--eyebrow-color,#5d4037)}
.lip-color-light{fill:var(--lip-color-light,#e64a19)}
.lip-color-dark{fill:var(--lip-color-dark,#d84315)}
</style>`;

let avatarRenderId = 0;

function safeColor(value: unknown, fallback: string): string {
	return typeof value === 'string' && HEX_COLOR_REGEX.test(value) ? value : fallback;
}

function safeNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseAvatarConfig(value: string | null | undefined): AvatarConfig | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as AvatarConfig;
	} catch {
		return null;
	}
}

function loadImage(source: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Could not load ${source}`));
		image.src = source;
	});
}

async function renderAvatarImage(
	currentSkitgubbe: ApiCurrentSkitgubbe
): Promise<HTMLImageElement | null> {
	const config = parseAvatarConfig(currentSkitgubbe.avatar_config);
	if (!config?.features?.length) return null;

	await loadAvatarFeatures();
	const featureMap = getAvatarFeaturesMap();
	const features = config.features
		.map((feature) => ({ feature, template: featureMap.get(feature.templateId) }))
		.filter((entry) => entry.template)
		.sort(
			(a, b) =>
				CATEGORY_ORDER.indexOf(a.feature.category) - CATEGORY_ORDER.indexOf(b.feature.category)
		);
	if (!features.length) return null;

	const skinColor = safeColor(config.skinColor, '#FFCDB2');
	const hairColor = safeColor(config.hairColor, '#3E2723');
	const eyeColor = safeColor(config.eyeColor, '#4CAF50');
	const eyebrowColor = safeColor(config.eyebrowColor, '#5D4037');
	const lipColor = safeColor(config.lipColor, '#e64a19');
	const hairColors = getHairShades(hairColor);
	const lipColors = getLipShades(lipColor);
	const namespace = `notice-board-${++avatarRenderId}`;
	const featureMarkup = features
		.map(({ feature, template }) => {
			const x = safeNumber(feature.x, 0);
			const y = safeNumber(feature.y, 0);
			const rotation = safeNumber(feature.rotation, 0);
			const scaleX = safeNumber(feature.scaleX, 1);
			const scaleY = safeNumber(feature.scaleY, 1);
			return `<g transform="translate(${x} ${y}) translate(100 100) rotate(${rotation}) scale(${scaleX} ${scaleY}) translate(-100 -100)">${namespaceSvgGradients(template!.svgContent, namespace)}</g>`;
		})
		.join('');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="860" viewBox="0 0 200 200" style="--skin-color:${skinColor};--hair-color:${hairColor};--hair-shadow:${hairColors.shadow};--hair-light:${hairColors.light};--eye-color:${eyeColor};--eyebrow-color:${eyebrowColor};--lip-color-light:${lipColor};--lip-color-dark:${lipColors.dark}">${AVATAR_SVG_STYLES}${featureMarkup}</svg>`;
	const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		return await loadImage(source);
	} finally {
		URL.revokeObjectURL(source);
	}
}

function roundedRectangle(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	context.beginPath();
	context.roundRect(x, y, width, height, radius);
}

function drawFittedName(
	context: CanvasRenderingContext2D,
	name: string,
	y: number,
	maximumWidth: number
) {
	let size = 178;
	do {
		context.font = `700 ${size}px "Nanum Brush Script", cursive`;
		size -= 4;
	} while (size > 72 && context.measureText(name).width > maximumWidth);
	context.fillStyle = '#2e2315';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(name, POSTER_WIDTH / 2, y, maximumWidth);
}

async function drawPoster(
	canvas: HTMLCanvasElement,
	paper: HTMLImageElement,
	currentSkitgubbe: ApiCurrentSkitgubbe | null
) {
	const context = canvas.getContext('2d');
	if (!context) throw new Error('The notice board poster canvas is unavailable.');
	// Keep composition in logical coordinates while rasterizing at source resolution.
	context.setTransform(POSTER_TEXTURE_SCALE, 0, 0, POSTER_TEXTURE_SCALE, 0, 0);
	context.imageSmoothingQuality = 'high';
	context.clearRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
	context.drawImage(paper, 0, 0, POSTER_WIDTH, POSTER_HEIGHT);

	const avatarSize = 430;
	const avatarX = (POSTER_WIDTH - avatarSize) / 2;
	const avatarY = 410;
	const avatarRadius = 68;
	const fallbackColor = currentSkitgubbe?.color ?? '#0f172a';
	const config = parseAvatarConfig(currentSkitgubbe?.avatar_config);
	const avatarColor = safeColor(config?.bgColor, safeColor(fallbackColor, '#0f172a'));

	context.save();
	roundedRectangle(context, avatarX, avatarY, avatarSize, avatarSize, avatarRadius);
	context.clip();
	context.fillStyle = currentSkitgubbe ? avatarColor : 'rgba(15, 23, 42, 0.72)';
	context.fillRect(avatarX, avatarY, avatarSize, avatarSize);

	let avatar: HTMLImageElement | null = null;
	if (currentSkitgubbe) {
		try {
			avatar = await renderAvatarImage(currentSkitgubbe);
		} catch (error) {
			console.warn('Could not rasterize the notice board avatar; using initials.', error);
		}
	}
	if (avatar) {
		context.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
	} else {
		context.fillStyle = currentSkitgubbe ? '#ffffff' : '#64748b';
		context.font = `700 ${currentSkitgubbe ? 150 : 210}px Inter, sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText(
			currentSkitgubbe?.name.trim().substring(0, 2).toUpperCase() || '?',
			POSTER_WIDTH / 2,
			avatarY + avatarSize / 2
		);
	}
	context.restore();

	context.strokeStyle = 'rgba(30, 41, 59, 0.55)';
	context.lineWidth = 9;
	roundedRectangle(context, avatarX, avatarY, avatarSize, avatarSize, avatarRadius);
	context.stroke();

	await document.fonts?.load('700 178px "Nanum Brush Script"');
	drawFittedName(context, currentSkitgubbe?.name || 'Vem blir nästa?', 1010, POSTER_WIDTH * 0.86);
}

export class NoticeBoard3D {
	readonly group = new Group();
	private readonly swingPivot = new Group();
	private readonly boardAssembly = new Group();
	private readonly posterCanvas = document.createElement('canvas');
	private readonly posterTexture: CanvasTexture;
	private readonly geometries: Array<BoxGeometry | CylinderGeometry | PlaneGeometry> = [];
	private readonly materials: MeshBasicMaterial[] = [];
	private readonly board: Mesh<PlaneGeometry, MeshBasicMaterial>;
	private readonly boardMaterial: MeshBasicMaterial;
	private readonly ropeMaterial: MeshBasicMaterial;
	private readonly ropes: Group[] = [];
	private readonly ceilingMounts: Array<Mesh<CylinderGeometry, MeshBasicMaterial>> = [];
	private readonly ceilingAnchors = ROPE_X_POSITIONS.map(() => new Vector3());
	private readonly raycaster = new Raycaster();
	private readonly ceilingRaycaster = new Raycaster();
	private readonly pointer = new Vector2();
	private readonly layoutRotation = new Quaternion();
	private readonly ropeBottom = new Vector3();
	private readonly ropeDirection = new Vector3();
	private readonly ropeMidpoint = new Vector3();
	private readonly paperPromise = loadImage('/skitgubbe_transparent.webp');
	private posterKey = '';
	private posterRevision = 0;
	private pitch = 0;
	private pitchVelocity = 0;
	private yaw = 0;
	private yawVelocity = 0;
	private pushStrength = 1;
	private swingSpeed = 1;
	private swingDamping = 1;
	private twistStrength = 1;
	private disposed = false;

	constructor(
		private readonly boardTexture: Texture,
		private readonly ropeTexture: Texture,
		private readonly invalidate: () => void
	) {
		this.group.name = 'LobbyNoticeBoard3D';
		this.group.visible = false;
		this.swingPivot.name = 'NoticeBoardRopePivot';
		// Suspend the wood through its thickness midpoint without shifting its face.
		this.swingPivot.position.z = BOARD_CENTER_Z;
		this.boardAssembly.position.z = -BOARD_CENTER_Z;
		this.boardAssembly.name = 'NoticeBoardAssembly';
		this.group.add(this.swingPivot);
		this.swingPivot.add(this.boardAssembly);
		this.posterCanvas.width = POSTER_WIDTH * POSTER_TEXTURE_SCALE;
		this.posterCanvas.height = POSTER_HEIGHT * POSTER_TEXTURE_SCALE;
		this.posterTexture = new CanvasTexture(this.posterCanvas);
		this.posterTexture.colorSpace = SRGBColorSpace;

		const source = boardTexture.image as HTMLImageElement;
		const boardHeight = (BOARD_WIDTH * source.height) / source.width;
		const boardGeometry = new PlaneGeometry(BOARD_WIDTH, boardHeight);
		this.boardMaterial = new MeshBasicMaterial({
			map: boardTexture,
			transparent: true,
			alphaTest: 0.025,
			depthWrite: true,
			side: DoubleSide,
			toneMapped: false
		});
		// The source contains opaque white matte pixels along the plank gaps and
		// silhouette. Recolor only those neutral highlights, preserving its alpha.
		this.boardMaterial.onBeforeCompile = (shader) => {
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <map_fragment>',
				`#include <map_fragment>
				#ifdef USE_MAP
					float darkest = min(sampledDiffuseColor.r, min(sampledDiffuseColor.g, sampledDiffuseColor.b));
					float lightest = max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b));
					float matte = smoothstep(0.2, 0.5, darkest) * (1.0 - smoothstep(0.08, 0.18, lightest - darkest));
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.018, 0.009) * diffuse, matte);
				#endif`
			);
		};
		this.board = new Mesh(boardGeometry, this.boardMaterial);
		this.board.name = 'NoticeBoardFront';
		this.board.position.set(0, BOARD_CENTER_Y, BOARD_FRONT_Z);
		this.board.renderOrder = 2;
		this.boardAssembly.add(this.board);
		this.geometries.push(boardGeometry);
		this.materials.push(this.boardMaterial);

		const backingGeometry = new BoxGeometry(0.69, 0.5, 0.045);
		const backingMaterial = new MeshBasicMaterial({
			color: new Color(0x35251b),
			toneMapped: false
		});
		const backing = new Mesh(backingGeometry, backingMaterial);
		backing.name = 'NoticeBoardBacking';
		backing.position.set(0, BOARD_CENTER_Y, BOARD_CENTER_Z);
		this.boardAssembly.add(backing);
		this.geometries.push(backingGeometry);
		this.materials.push(backingMaterial);

		const posterGeometry = new PlaneGeometry(0.36, 0.36 / POSTER_ASPECT);
		const posterMaterial = new MeshBasicMaterial({
			map: this.posterTexture,
			transparent: true,
			alphaTest: 0.02,
			depthWrite: true,
			side: DoubleSide,
			toneMapped: false
		});
		const poster = new Mesh(posterGeometry, posterMaterial);
		poster.name = 'NoticeBoardPoster';
		// A paper-thin separation avoids z-fighting without visible floating.
		poster.position.set(0, -0.19, BOARD_FRONT_Z + 0.0003);
		poster.rotation.z = (1.5 * Math.PI) / 180;
		poster.renderOrder = 3;
		this.boardAssembly.add(poster);
		this.geometries.push(posterGeometry);
		this.materials.push(posterMaterial);

		this.ropeTexture.wrapT = RepeatWrapping;
		this.ropeMaterial = new MeshBasicMaterial({
			map: this.ropeTexture,
			transparent: true,
			alphaTest: 0.04,
			depthWrite: true,
			side: DoubleSide,
			toneMapped: false
		});
		const ropeGeometry = new PlaneGeometry(ROPE_PLANE_WIDTH, 1);
		for (const side of ['Left', 'Right']) {
			const rope = new Group();
			rope.name = `NoticeBoard${side}Rope`;
			for (const rotation of [0, Math.PI / 2]) {
				const strand = new Mesh(ropeGeometry, this.ropeMaterial);
				strand.rotation.y = rotation;
				strand.renderOrder = 1;
				rope.add(strand);
			}
			this.group.add(rope);
			this.ropes.push(rope);
		}
		this.geometries.push(ropeGeometry);
		this.materials.push(this.ropeMaterial);

		const ceilingMountGeometry = new CylinderGeometry(0.017, 0.017, 0.008, 12);
		const ceilingMountMaterial = new MeshBasicMaterial({
			color: new Color(0x604a36),
			toneMapped: false
		});
		for (const side of ['Left', 'Right']) {
			const mount = new Mesh(ceilingMountGeometry, ceilingMountMaterial);
			mount.name = `NoticeBoard${side}CeilingMount`;
			this.group.add(mount);
			this.ceilingMounts.push(mount);
		}
		this.geometries.push(ceilingMountGeometry);
		this.materials.push(ceilingMountMaterial);
	}

	setTextureAnisotropy(anisotropy: number) {
		this.boardTexture.anisotropy = anisotropy;
		this.boardTexture.colorSpace = SRGBColorSpace;
		this.boardTexture.needsUpdate = true;
		this.ropeTexture.anisotropy = anisotropy;
		this.ropeTexture.colorSpace = SRGBColorSpace;
		this.ropeTexture.needsUpdate = true;
		this.posterTexture.anisotropy = anisotropy;
		this.posterTexture.needsUpdate = true;
	}

	updateLayout(
		basePosition: Vector3,
		baseQuaternion: Quaternion,
		layout: NoticeBoardLayout,
		room: Object3D,
		anchor?: NoticeBoardAnchor | null,
		camera?: PerspectiveCamera | null
	) {
		const depth = layout.depthMeters;
		const viewportWidth =
			anchor?.viewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 1440);
		const viewportHeight =
			anchor?.viewportHeight || (typeof window !== 'undefined' ? window.innerHeight : 900);
		const aspect = camera?.aspect ?? viewportWidth / Math.max(1, viewportHeight);
		const cameraFov = camera?.fov ?? NOTICE_BOARD_DESIGN.cameraFovDegrees;

		// Calculate initial placement with estimated ceiling pivot
		const initialPlacement = calculateNoticeBoardPlacement({
			viewportWidth,
			viewportHeight,
			aspect,
			fov: cameraFov,
			depth,
			layoutScale: layout.scale,
			horizontalOffsetPercent: layout.horizontalOffsetPercent,
			ropeLengthSetting: layout.ropeLengthMeters,
			buttonWidth: anchor?.buttonWidth,
			buttonTop: anchor?.buttonTop,
			anchorWidth: anchor?.width,
			ceilingPivot: 0.5
		});

		this.group.scale.setScalar(initialPlacement.worldScale);

		const localPosition = new Vector3(initialPlacement.localX, initialPlacement.localY, -depth);
		this.group.position.copy(localPosition.applyQuaternion(baseQuaternion)).add(basePosition);
		this.group.quaternion
			.copy(baseQuaternion)
			.multiply(
				this.layoutRotation.setFromAxisAngle(WORLD_UP, (layout.rotationDegrees * Math.PI) / 180)
			);

		// With group positioned horizontally and scaled, raycast to find ceiling
		const pivotHeight = this.findCeilingPivot(room);
		this.swingPivot.position.y = pivotHeight;

		// Recalculate dynamic rope length with accurate ceiling pivot
		const placement = calculateNoticeBoardPlacement({
			viewportWidth,
			viewportHeight,
			aspect,
			fov: cameraFov,
			depth,
			layoutScale: layout.scale,
			horizontalOffsetPercent: layout.horizontalOffsetPercent,
			ropeLengthSetting: layout.ropeLengthMeters,
			buttonWidth: anchor?.buttonWidth,
			buttonTop: anchor?.buttonTop,
			anchorWidth: anchor?.width,
			ceilingPivot: pivotHeight
		});

		this.boardAssembly.position.y =
			ROPE_BOARD_ANCHOR_Y * -1 - placement.effectiveRopeLength / placement.worldScale;

		for (let index = 0; index < ROPE_X_POSITIONS.length; index += 1) {
			this.ceilingAnchors[index].set(
				ROPE_X_POSITIONS[index],
				pivotHeight + ROPE_CEILING_PENETRATION,
				BOARD_CENTER_Z
			);
			this.ceilingMounts[index].position.set(
				ROPE_X_POSITIONS[index],
				pivotHeight - 0.004,
				BOARD_CENTER_Z
			);
		}
		this.ropeTexture.repeat.y = Math.max(
			1,
			placement.effectiveRopeLength / placement.worldScale / ROPE_PATTERN_HEIGHT
		);
		this.boardMaterial.color.setScalar(layout.brightness);
		this.ropeMaterial.color.setScalar(layout.brightness);
		this.pushStrength = layout.pushStrength;
		this.swingSpeed = layout.swingSpeed;
		this.swingDamping = layout.swingDamping;
		this.twistStrength = layout.twistStrength;
		this.updateRopes();
	}

	private findCeilingPivot(room: Object3D): number {
		room.updateWorldMatrix(true, true);
		this.group.updateWorldMatrix(true, true);
		const ceilingHeights: number[] = [];

		for (const x of CEILING_RAY_X_POSITIONS) {
			const origin = new Vector3(x, 0, BOARD_CENTER_Z).applyMatrix4(this.group.matrixWorld);
			this.ceilingRaycaster.set(origin, WORLD_UP);
			this.ceilingRaycaster.near = 0.02;
			this.ceilingRaycaster.far = 8;
			const hit = this.ceilingRaycaster.intersectObject(room, true)[0];
			if (!hit) continue;
			const localHit = this.group.worldToLocal(hit.point.clone());
			if (Number.isFinite(localHit.y) && localHit.y > 0.05) {
				ceilingHeights.push(localHit.y);
			}
		}

		// Taking the highest of the nearby rays avoids attaching a rope to a lamp
		// or another hanging prop instead of the ceiling itself.
		return ceilingHeights.length ? Math.max(...ceilingHeights) : 0.5;
	}

	private updateRopes() {
		this.group.updateWorldMatrix(true, true);
		for (let index = 0; index < this.ropes.length; index += 1) {
			const rope = this.ropes[index];
			const ceilingAnchor = this.ceilingAnchors[index];
			this.ropeBottom
				.set(ROPE_X_POSITIONS[index], ROPE_BOARD_ANCHOR_Y, BOARD_CENTER_Z)
				.applyMatrix4(this.boardAssembly.matrixWorld);
			this.group.worldToLocal(this.ropeBottom);

			this.ropeDirection.subVectors(ceilingAnchor, this.ropeBottom);
			const length = this.ropeDirection.length();
			rope.visible = length > 0.001;
			if (!rope.visible) continue;

			rope.position.copy(
				this.ropeMidpoint.copy(ceilingAnchor).add(this.ropeBottom).multiplyScalar(0.5)
			);
			rope.scale.set(1, length, 1);
			rope.quaternion.setFromUnitVectors(WORLD_UP, this.ropeDirection.multiplyScalar(1 / length));
		}
	}

	push({ horizontal, vertical }: NoticeBoardPush) {
		const hitX = Math.min(1, Math.max(-1, horizontal));
		const leverage = Math.min(1, Math.max(0, vertical));
		this.pitchVelocity += (1.8 + leverage * 2.9) * this.pushStrength;
		// Pushing the right edge away from the viewer produces positive Y rotation.
		this.yawVelocity += hitX * (0.9 + leverage * 0.84) * this.pushStrength * this.twistStrength;
		this.pitchVelocity = Math.max(-8, Math.min(8, this.pitchVelocity));
		this.yawVelocity = Math.max(-6, Math.min(6, this.yawVelocity));
		this.invalidate();
	}

	hitTest(
		clientX: number,
		clientY: number,
		viewportWidth: number,
		viewportHeight: number,
		camera: PerspectiveCamera
	): NoticeBoardPush | null {
		this.pointer.set(
			(clientX / Math.max(1, viewportWidth)) * 2 - 1,
			1 - (clientY / Math.max(1, viewportHeight)) * 2
		);
		this.group.updateWorldMatrix(true, true);
		this.raycaster.setFromCamera(this.pointer, camera);
		const intersection = this.raycaster.intersectObject(this.board, false)[0];
		if (!intersection?.uv) return null;
		return {
			horizontal: intersection.uv.x * 2 - 1,
			vertical: 1 - intersection.uv.y
		};
	}

	updatePhysics(elapsedSeconds: number): boolean {
		const elapsed = Math.min(0.05, Math.max(0, elapsedSeconds));
		const speedSquared = this.swingSpeed * this.swingSpeed;
		const pitchAcceleration =
			-14 * speedSquared * Math.sin(this.pitch) -
			1.9 * this.swingDamping * this.swingSpeed * this.pitchVelocity;
		const yawAcceleration =
			-18 * speedSquared * this.yaw - 2.8 * this.swingDamping * this.swingSpeed * this.yawVelocity;
		this.pitchVelocity += pitchAcceleration * elapsed;
		this.yawVelocity += yawAcceleration * elapsed;
		this.pitch += this.pitchVelocity * elapsed;
		this.yaw += this.yawVelocity * elapsed;
		// Stop outward velocity at the limits so the board rebounds immediately
		// instead of sticking there while the spring cancels the remaining push.
		if (Math.abs(this.pitch) > MAX_SWING_ANGLE) {
			this.pitch = Math.sign(this.pitch) * MAX_SWING_ANGLE;
			if (this.pitch * this.pitchVelocity > 0) this.pitchVelocity = 0;
		}
		if (Math.abs(this.yaw) > MAX_TWIST_ANGLE) {
			this.yaw = Math.sign(this.yaw) * MAX_TWIST_ANGLE;
			if (this.yaw * this.yawVelocity > 0) this.yawVelocity = 0;
		}

		const stillMoving =
			Math.abs(this.pitch) > 0.0003 ||
			Math.abs(this.pitchVelocity) > 0.0003 ||
			Math.abs(this.yaw) > 0.0003 ||
			Math.abs(this.yawVelocity) > 0.0003;
		if (!stillMoving) {
			this.pitch = 0;
			this.pitchVelocity = 0;
			this.yaw = 0;
			this.yawVelocity = 0;
		}
		this.swingPivot.rotation.set(this.pitch, this.yaw, 0);
		this.updateRopes();
		return stillMoving;
	}

	async updatePoster(currentSkitgubbe: ApiCurrentSkitgubbe | null): Promise<boolean> {
		const key = currentSkitgubbe
			? `${currentSkitgubbe.id}:${currentSkitgubbe.name}:${currentSkitgubbe.color}:${currentSkitgubbe.avatar_config ?? ''}`
			: 'empty';
		if (key === this.posterKey) return true;
		const revision = ++this.posterRevision;
		const paper = await this.paperPromise;
		await drawPoster(this.posterCanvas, paper, currentSkitgubbe);
		if (this.disposed || revision !== this.posterRevision) return false;
		this.posterKey = key;
		this.posterTexture.needsUpdate = true;
		this.invalidate();
		return true;
	}

	dispose() {
		this.disposed = true;
		this.posterRevision += 1;
		for (const geometry of this.geometries) geometry.dispose();
		for (const material of this.materials) material.dispose();
		this.posterTexture.dispose();
		this.ropeTexture.dispose();
		this.boardTexture.dispose();
		this.group.removeFromParent();
	}
}
