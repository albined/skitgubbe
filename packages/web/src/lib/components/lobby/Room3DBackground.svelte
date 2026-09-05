<script lang="ts">
	import { dev } from '$app/environment';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { ApiCurrentSkitgubbe } from 'shared';
	import { isNativeDebugBuild } from '$lib/platform/runtime';
	import {
		ACESFilmicToneMapping,
		Color,
		Euler,
		Mesh,
		MeshBasicMaterial,
		PerspectiveCamera,
		Quaternion,
		Scene,
		SRGBColorSpace,
		Texture,
		TextureLoader,
		Vector3,
		WebGLRenderer,
		type Material,
		type Object3D
	} from 'three';
	import { DeviceTilt } from './deviceTilt';
	import { verticalFovForAspect } from './roomCamera';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import {
		NOTICE_BOARD_DESIGN,
		NoticeBoard3D,
		type NoticeBoardAnchor,
		type NoticeBoardLayout
	} from './noticeBoard3D';

	interface Props {
		currentSkitgubbe: ApiCurrentSkitgubbe | null;
		noticeBoardAnchor: NoticeBoardAnchor | null;
		onNoticeBoardReadyChange?: (ready: boolean) => void;
	}

	let { currentSkitgubbe, noticeBoardAnchor, onNoticeBoardReadyChange }: Props = $props();

	interface RoomTuning {
		cameraHorizontalCentimeters: number;
		noticeBoardRopeLengthMeters: number;
		translationCentimeters: number;
		rotationDegrees: number;
		cameraFovDegrees: number;
		exposure: number;
		lightingIntensity: number;
		noticeBoardDepthMeters: number;
		noticeBoardScale: number;
		noticeBoardHorizontalPercent: number;
		noticeBoardRotationDegrees: number;
		noticeBoardBrightness: number;
		noticeBoardPushStrength: number;
		noticeBoardSwingSpeed: number;
		noticeBoardSwingDamping: number;
		noticeBoardTwistStrength: number;
	}

	const MODEL_URL = '/lobby/serena-room.glb';
	const LIGHTMAP_URL = '/lobby/serena-room-lightmap.webp';
	const NOTICE_BOARD_URL = '/notice_board_wood.webp';
	const NOTICE_BOARD_ROPE_URL = '/notice_board_strand.webp';
	const MAX_DEVICE_PIXEL_RATIO = 2;
	const MAX_RENDER_DIMENSION = 2560;
	const MAX_TILT_DEGREES = 18;
	const MOTION_SMOOTHING = 8;
	const TUNING_STORAGE_KEY = 'skitgubbe_room_3d_tuning_v4';
	const DEFAULT_TUNING: RoomTuning = {
		cameraHorizontalCentimeters: 0,
		noticeBoardRopeLengthMeters: 1.0,
		translationCentimeters: 10,
		rotationDegrees: 1.5,
		cameraFovDegrees: 50,
		exposure: 1.3,
		lightingIntensity: 3.5,
		noticeBoardDepthMeters: 2.0,
		noticeBoardScale: 1.0,
		noticeBoardHorizontalPercent: -2,
		noticeBoardRotationDegrees: 9,
		noticeBoardBrightness: 0.85,
		noticeBoardPushStrength: 0.8,
		noticeBoardSwingSpeed: 1.05,
		noticeBoardSwingDamping: 0.95,
		noticeBoardTwistStrength: 2.1
	};

	let canvas: HTMLCanvasElement;
	let ready = $state(false);
	let status = $state('Static fallback');
	let showTuner = $state(false);
	let tuning = $state<RoomTuning>({ ...DEFAULT_TUNING });
	let refreshTuning = () => {};
	let refreshNoticeBoard = (
		_anchor: NoticeBoardAnchor | null,
		_currentSkitgubbe: ApiCurrentSkitgubbe | null
	) => {};

	$effect(() => {
		refreshNoticeBoard(noticeBoardAnchor, currentSkitgubbe);
	});

	function clamp(value: number, minimum = -1, maximum = 1): number {
		return Math.min(maximum, Math.max(minimum, value));
	}

	function setting(value: unknown, fallback: number, minimum: number, maximum: number): number {
		return typeof value === 'number' && Number.isFinite(value)
			? clamp(value, minimum, maximum)
			: fallback;
	}

	function loadTuning(): RoomTuning {
		try {
			const saved = JSON.parse(
				localStorage.getItem(TUNING_STORAGE_KEY) ?? '{}'
			) as Partial<RoomTuning>;
			return {
				cameraHorizontalCentimeters: setting(
					saved.cameraHorizontalCentimeters,
					DEFAULT_TUNING.cameraHorizontalCentimeters,
					-100,
					100
				),
				noticeBoardRopeLengthMeters: setting(
					saved.noticeBoardRopeLengthMeters,
					DEFAULT_TUNING.noticeBoardRopeLengthMeters,
					0.1,
					3
				),
				translationCentimeters: setting(
					saved.translationCentimeters,
					DEFAULT_TUNING.translationCentimeters,
					0,
					15
				),
				rotationDegrees: setting(saved.rotationDegrees, DEFAULT_TUNING.rotationDegrees, 0, 2),
				cameraFovDegrees: setting(saved.cameraFovDegrees, DEFAULT_TUNING.cameraFovDegrees, 30, 75),
				exposure: setting(saved.exposure, DEFAULT_TUNING.exposure, 0.5, 3),
				lightingIntensity: setting(
					saved.lightingIntensity,
					DEFAULT_TUNING.lightingIntensity,
					0.5,
					6
				),
				noticeBoardDepthMeters: setting(
					saved.noticeBoardDepthMeters,
					DEFAULT_TUNING.noticeBoardDepthMeters,
					1.5,
					10
				),
				noticeBoardScale: setting(saved.noticeBoardScale, DEFAULT_TUNING.noticeBoardScale, 0.6, 3),
				noticeBoardHorizontalPercent: setting(
					saved.noticeBoardHorizontalPercent,
					DEFAULT_TUNING.noticeBoardHorizontalPercent,
					-35,
					35
				),
				noticeBoardRotationDegrees: setting(
					saved.noticeBoardRotationDegrees,
					DEFAULT_TUNING.noticeBoardRotationDegrees,
					-30,
					30
				),
				noticeBoardBrightness: setting(
					saved.noticeBoardBrightness,
					DEFAULT_TUNING.noticeBoardBrightness,
					0.5,
					1.2
				),
				noticeBoardPushStrength: setting(
					saved.noticeBoardPushStrength,
					DEFAULT_TUNING.noticeBoardPushStrength,
					0,
					2.5
				),
				noticeBoardSwingSpeed: setting(
					saved.noticeBoardSwingSpeed,
					DEFAULT_TUNING.noticeBoardSwingSpeed,
					0.35,
					2
				),
				noticeBoardSwingDamping: setting(
					saved.noticeBoardSwingDamping,
					DEFAULT_TUNING.noticeBoardSwingDamping,
					0.1,
					3
				),
				noticeBoardTwistStrength: setting(
					saved.noticeBoardTwistStrength,
					DEFAULT_TUNING.noticeBoardTwistStrength,
					0,
					2.5
				)
			};
		} catch {
			return { ...DEFAULT_TUNING };
		}
	}

	function updateTuning(key: keyof RoomTuning, value: number) {
		tuning[key] = value;
		try {
			localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(tuning));
		} catch {
			// Live tuning remains available when persistent storage is blocked.
		}
		refreshTuning();
	}

	function resetTuning() {
		tuning = { ...DEFAULT_TUNING };
		try {
			localStorage.removeItem(TUNING_STORAGE_KEY);
		} catch {
			// Ignore storage failures; the active values have still been reset.
		}
		refreshTuning();
	}

	function disposeObject(root: Object3D) {
		const geometries = new Set<Mesh['geometry']>();
		const materials = new Set<Material>();
		const textures = new Set<Texture>();
		root.traverse((object) => {
			if (!(object instanceof Mesh)) return;
			geometries.add(object.geometry);
			const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
			for (const material of objectMaterials) materials.add(material);
		});
		for (const material of materials) {
			for (const value of Object.values(material)) {
				if (value instanceof Texture) textures.add(value);
			}
			material.dispose();
		}
		for (const texture of textures) texture.dispose();
		for (const geometry of geometries) geometry.dispose();
	}

	onMount(() => {
		showTuner =
			dev ||
			isNativeDebugBuild() ||
			new URLSearchParams(window.location.search).get('parallaxDebug') === '1';
		if (showTuner) tuning = loadTuning();

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		if (reducedMotion.matches) {
			status = 'Reduced motion: static background';
			return;
		}

		let disposed = false;
		let inputListening = false;
		let animationFrame = 0;
		let lastFrameTime = 0;
		let targetX = 0;
		let targetY = 0;
		let currentX = 0;
		let currentY = 0;
		let renderer: WebGLRenderer | null = null;
		let roomRoot: Object3D | null = null;
		let lightMap: Texture | null = null;
		let lightMappedMaterials: MeshBasicMaterial[] = [];
		let noticeBoard: NoticeBoard3D | null = null;
		let noticeBoardReady = false;
		let noticeBoardRevision = 0;
		let camera: PerspectiveCamera | null = null;
		let basePosition: Vector3 | null = null;
		let baseQuaternion: Quaternion | null = null;
		let renderScene: Scene | null = null;
		let gpuReady = false;
		const deviceTilt = new DeviceTilt();
		const cleanupCallbacks: Array<() => void> = [];
		const localOffset = new Vector3();
		const rotationDelta = new Quaternion();
		const rotationEuler = new Euler(0, 0, 0, 'YXZ');

		const pointerInput = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
		let inputMode: 'pointer' | 'orientation' | 'none' = pointerInput ? 'pointer' : 'none';
		if (!pointerInput && 'DeviceOrientationEvent' in window) {
			inputMode = 'orientation';
			const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
				requestPermission?: () => Promise<'granted' | 'denied'>;
			};
			if (typeof orientationEvent.requestPermission === 'function') {
				const requestOnGesture = () => {
					window.removeEventListener('pointerdown', requestOnGesture);
					orientationEvent
						.requestPermission?.()
						.then((result) => {
							if (result === 'granted') {
								resetMotionBaseline();
							}
						})
						.catch(() => {});
				};
				orientationEvent
					.requestPermission()
					.then((result) => {
						if (result === 'granted') {
							resetMotionBaseline();
						}
					})
					.catch(() => {
						// iOS Safari and other browsers that require user activation
						window.addEventListener('pointerdown', requestOnGesture, { once: true, passive: true });
					});
				cleanupCallbacks.push(() => window.removeEventListener('pointerdown', requestOnGesture));
			}
		}

		function setNoticeBoardReady(value: boolean) {
			if (noticeBoardReady === value) return;
			noticeBoardReady = value;
			onNoticeBoardReadyChange?.(value);
		}

		function getNoticeBoardLayout(): NoticeBoardLayout {
			return {
				depthMeters: tuning.noticeBoardDepthMeters,
				ropeLengthMeters: tuning.noticeBoardRopeLengthMeters,
				scale: tuning.noticeBoardScale,
				horizontalOffsetPercent: tuning.noticeBoardHorizontalPercent,
				rotationDegrees: tuning.noticeBoardRotationDegrees,
				brightness: tuning.noticeBoardBrightness,
				pushStrength: tuning.noticeBoardPushStrength,
				swingSpeed: tuning.noticeBoardSwingSpeed,
				swingDamping: tuning.noticeBoardSwingDamping,
				twistStrength: tuning.noticeBoardTwistStrength
			};
		}

		function updateNoticeBoardLayout() {
			if (!noticeBoard || !basePosition || !baseQuaternion || !roomRoot) return;
			noticeBoard.updateLayout(
				basePosition,
				baseQuaternion,
				getNoticeBoardLayout(),
				roomRoot,
				noticeBoardAnchor,
				camera
			);
		}

		async function syncNoticeBoard(
			anchor: NoticeBoardAnchor | null,
			skitgubbe: ApiCurrentSkitgubbe | null
		) {
			const revision = ++noticeBoardRevision;
			if (!noticeBoard || !camera || !basePosition || !baseQuaternion || !anchor) {
				if (noticeBoard) noticeBoard.group.visible = false;
				setNoticeBoardReady(false);
				return;
			}

			updateNoticeBoardLayout();
			try {
				const posterReady = await noticeBoard.updatePoster(skitgubbe);
				if (disposed || revision !== noticeBoardRevision || !posterReady) return;
				noticeBoard.group.visible = true;
				setNoticeBoardReady(true);
				requestRender();
			} catch (error) {
				if (revision !== noticeBoardRevision) return;
				console.warn('The 3D notice board is unavailable; using the HTML fallback.', error);
				noticeBoard.group.visible = false;
				setNoticeBoardReady(false);
			}
		}

		function requestRender() {
			if (
				disposed ||
				!gpuReady ||
				animationFrame !== 0 ||
				document.visibilityState === 'hidden' ||
				reducedMotion.matches
			) {
				return;
			}
			animationFrame = requestAnimationFrame(render);
		}

		function updateCameraProjection() {
			if (!camera) return;
			// The tuner keeps its reference-view values and saved settings. Only
			// the top/bottom view changes with aspect; horizontal coverage stays fixed.
			camera.fov = verticalFovForAspect(
				tuning.cameraFovDegrees,
				NOTICE_BOARD_DESIGN.viewAspect,
				camera.aspect
			);
			camera.updateProjectionMatrix();
		}

		function applyTuning() {
			updateCameraProjection();
			if (renderer) renderer.toneMappingExposure = tuning.exposure;
			for (const material of lightMappedMaterials) {
				material.lightMapIntensity = tuning.lightingIntensity;
			}
			updateNoticeBoardLayout();
		}

		const updateSceneTuning = () => {
			applyTuning();
			requestRender();
		};
		refreshTuning = updateSceneTuning;
		const updateNoticeBoard = (
			anchor: NoticeBoardAnchor | null,
			skitgubbe: ApiCurrentSkitgubbe | null
		) => {
			void syncNoticeBoard(anchor, skitgubbe);
		};
		refreshNoticeBoard = updateNoticeBoard;

		function render(timestamp: number) {
			animationFrame = 0;
			if (
				!renderer ||
				!renderScene ||
				!camera ||
				!basePosition ||
				!baseQuaternion ||
				disposed ||
				document.visibilityState === 'hidden'
			) {
				return;
			}

			const elapsed = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 1 / 60;
			lastFrameTime = timestamp;
			const blend = 1 - Math.exp(-MOTION_SMOOTHING * elapsed);
			currentX += (targetX - currentX) * blend;
			currentY += (targetY - currentY) * blend;

			const translationMeters = tuning.translationCentimeters / 100;
			localOffset
				.set(
					tuning.cameraHorizontalCentimeters / 100 + currentX * translationMeters,
					currentY * translationMeters,
					0
				)
				.applyQuaternion(baseQuaternion);
			camera.position.copy(basePosition).add(localOffset);

			const rotationRadians = (tuning.rotationDegrees * Math.PI) / 180;
			rotationEuler.set(-currentY * rotationRadians, -currentX * rotationRadians, 0);
			rotationDelta.setFromEuler(rotationEuler);
			camera.quaternion.copy(baseQuaternion).multiply(rotationDelta);

			const boardAnimating = noticeBoard?.updatePhysics(elapsed) ?? false;
			renderer.render(renderScene, camera);
			if (!ready) ready = true;

			if (
				boardAnimating ||
				Math.abs(targetX - currentX) > 0.0005 ||
				Math.abs(targetY - currentY) > 0.0005
			) {
				requestRender();
			} else {
				lastFrameTime = 0;
			}
		}

		function resizeCanvas() {
			if (!renderer || !camera) return;
			const bounds = canvas.getBoundingClientRect();
			const pixelRatio = Math.min(
				window.devicePixelRatio || 1,
				MAX_DEVICE_PIXEL_RATIO,
				MAX_RENDER_DIMENSION / Math.max(bounds.width, bounds.height)
			);
			renderer.setPixelRatio(Math.max(0.5, pixelRatio));
			renderer.setSize(Math.max(1, bounds.width), Math.max(1, bounds.height), false);
			camera.aspect = Math.max(1, bounds.width) / Math.max(1, bounds.height);
			updateCameraProjection();
			updateNoticeBoardLayout();
			requestRender();
		}

		function handlePointerMove(event: PointerEvent) {
			targetX = clamp((event.clientX / window.innerWidth) * 2 - 1);
			targetY = clamp(1 - (event.clientY / window.innerHeight) * 2);
			requestRender();
		}

		function handleNoticeBoardPointerDown(event: PointerEvent) {
			if (!noticeBoardReady || !noticeBoard || !camera) return;
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			const target = event.target;
			if (
				target instanceof Element &&
				target.closest('button, a, input, select, textarea, summary, [role="button"]')
			) {
				return;
			}

			const push = noticeBoard.hitTest(
				event.clientX,
				event.clientY,
				window.innerWidth,
				window.innerHeight,
				camera
			);
			if (push) noticeBoard.push(push);
		}

		function resetMotionBaseline() {
			deviceTilt.reset();
			targetX = 0;
			targetY = 0;
			requestRender();
		}

		function handleDeviceOrientation(event: DeviceOrientationEvent) {
			const tilt = deviceTilt.update(
				event.alpha,
				event.beta,
				event.gamma,
				screen.orientation?.angle ?? 0
			);
			if (!tilt) return;
			targetX = clamp(tilt.horizontal / MAX_TILT_DEGREES);
			targetY = clamp(-tilt.vertical / MAX_TILT_DEGREES);
			requestRender();
		}

		function startInput() {
			if (inputListening) return;
			if (inputMode === 'pointer') {
				window.addEventListener('pointermove', handlePointerMove, { passive: true });
			} else if (inputMode === 'orientation') {
				window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
			}
			inputListening = true;
		}

		function stopInput() {
			if (!inputListening) return;
			if (inputMode === 'pointer') {
				window.removeEventListener('pointermove', handlePointerMove);
			} else if (inputMode === 'orientation') {
				window.removeEventListener('deviceorientation', handleDeviceOrientation);
			}
			inputListening = false;
		}

		function handleVisibilityChange() {
			if (document.visibilityState === 'hidden') {
				stopInput();
				if (animationFrame) cancelAnimationFrame(animationFrame);
				animationFrame = 0;
				lastFrameTime = 0;
			} else {
				startInput();
				resetMotionBaseline();
			}
		}

		function handleContextLost(event: Event) {
			event.preventDefault();
			gpuReady = false;
			setNoticeBoardReady(false);
			ready = false;
			status = 'WebGL context lost: static background';
			if (animationFrame) cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}

		async function initialize() {
			try {
				status = 'Loading 3D room…';
				renderer = new WebGLRenderer({
					canvas,
					alpha: false,
					antialias: true,
					depth: true,
					stencil: false,
					powerPreference: 'low-power'
				});
				renderer.outputColorSpace = SRGBColorSpace;
				renderer.toneMapping = ACESFilmicToneMapping;
				renderer.setClearColor(new Color(0x21150f), 1);
				renderer.shadowMap.enabled = false;

				const [gltf, loadedLightMap, loadedNoticeBoardTextures] = await Promise.all([
					new GLTFLoader().loadAsync(MODEL_URL),
					new TextureLoader().loadAsync(LIGHTMAP_URL),
					Promise.all([
						new TextureLoader().loadAsync(NOTICE_BOARD_URL),
						new TextureLoader().loadAsync(NOTICE_BOARD_ROPE_URL)
					]).catch((error) => {
						console.warn('Could not load the 3D notice board texture.', error);
						return null;
					})
				]);
				const [loadedNoticeBoardTexture, loadedRopeTexture] = loadedNoticeBoardTextures ?? [
					null,
					null
				];
				lightMap = loadedLightMap;
				if (disposed) {
					disposeObject(gltf.scene);
					lightMap.dispose();
					loadedNoticeBoardTexture?.dispose();
					loadedRopeTexture?.dispose();
					return;
				}
				lightMap.flipY = false;
				lightMap.colorSpace = SRGBColorSpace;
				lightMap.channel = 1;
				const textureAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
				lightMap.anisotropy = textureAnisotropy;
				lightMap.needsUpdate = true;

				const modelCamera = gltf.cameras.find(
					(candidate): candidate is PerspectiveCamera => candidate instanceof PerspectiveCamera
				);
				if (!modelCamera) throw new Error('The room GLB does not contain its Blender camera.');

				renderScene = new Scene();
				roomRoot = gltf.scene;
				const convertedMaterials = new Map<Material, MeshBasicMaterial>();
				roomRoot.traverse((object) => {
					if (!(object instanceof Mesh)) return;
					object.frustumCulled = false;
					if (!object.geometry.getAttribute('uv1')) {
						throw new Error('The room GLB does not contain its baked-lighting UVs.');
					}

					const sourceMaterials = Array.isArray(object.material)
						? object.material
						: [object.material];
					const replacements = sourceMaterials.map((source) => {
						const existing = convertedMaterials.get(source);
						if (existing) return existing;

						const sourceWithMap = source as Material & {
							map?: Texture | null;
							color?: Color;
							alphaMap?: Texture | null;
						};
						if (sourceWithMap.map) {
							sourceWithMap.map.anisotropy = textureAnisotropy;
							sourceWithMap.map.needsUpdate = true;
						}
						const replacement = new MeshBasicMaterial({
							name: source.name,
							color: sourceWithMap.color?.clone() ?? new Color(0xffffff),
							map: sourceWithMap.map ?? null,
							alphaMap: sourceWithMap.alphaMap ?? null,
							lightMap,
							lightMapIntensity: tuning.lightingIntensity,
							transparent: source.transparent,
							opacity: source.opacity,
							alphaTest: source.alphaTest,
							side: source.side,
							depthTest: source.depthTest,
							depthWrite: source.depthWrite
						});
						convertedMaterials.set(source, replacement);
						lightMappedMaterials.push(replacement);
						return replacement;
					});
					object.material = Array.isArray(object.material) ? replacements : replacements[0];
				});
				for (const source of convertedMaterials.keys()) source.dispose();
				renderScene.add(roomRoot);
				camera = modelCamera;
				basePosition = camera.position.clone();
				baseQuaternion = camera.quaternion.clone();
				if (loadedNoticeBoardTexture && loadedRopeTexture) {
					noticeBoard = new NoticeBoard3D(
						loadedNoticeBoardTexture,
						loadedRopeTexture,
						requestRender
					);
					noticeBoard.setTextureAnisotropy(textureAnisotropy);
					renderScene.add(noticeBoard.group);
				}

				applyTuning();

				document.addEventListener('visibilitychange', handleVisibilityChange);
				window.addEventListener('pointerdown', handleNoticeBoardPointerDown, { passive: true });
				window.addEventListener('orientationchange', resetMotionBaseline);
				window.addEventListener('skitgubbe:native-resume', resetMotionBaseline);
				canvas.addEventListener('webglcontextlost', handleContextLost);
				cleanupCallbacks.push(
					stopInput,
					() => document.removeEventListener('visibilitychange', handleVisibilityChange),
					() => window.removeEventListener('pointerdown', handleNoticeBoardPointerDown),
					() => window.removeEventListener('orientationchange', resetMotionBaseline),
					() => window.removeEventListener('skitgubbe:native-resume', resetMotionBaseline),
					() => canvas.removeEventListener('webglcontextlost', handleContextLost)
				);

				const resizeObserver = new ResizeObserver(resizeCanvas);
				resizeObserver.observe(canvas);
				cleanupCallbacks.push(() => resizeObserver.disconnect());
				gpuReady = true;
				status = '3D room active';
				startInput();
				resizeCanvas();
				void syncNoticeBoard(noticeBoardAnchor, currentSkitgubbe);
			} catch (error) {
				console.warn('3D lobby background is unavailable; using the static image.', error);
				setNoticeBoardReady(false);
				noticeBoardRevision += 1;
				noticeBoard?.dispose();
				noticeBoard = null;
				if (roomRoot) disposeObject(roomRoot);
				if (lightMap) lightMap.dispose();
				if (renderer) {
					renderer.dispose();
					renderer.forceContextLoss();
				}
				roomRoot = null;
				lightMap = null;
				lightMappedMaterials = [];
				renderer = null;
				status = '3D unavailable: static background';
				ready = false;
			}
		}

		void initialize();

		return () => {
			disposed = true;
			noticeBoardRevision += 1;
			setNoticeBoardReady(false);
			if (refreshTuning === updateSceneTuning) refreshTuning = () => {};
			if (refreshNoticeBoard === updateNoticeBoard) {
				refreshNoticeBoard = () => {};
			}
			if (animationFrame) cancelAnimationFrame(animationFrame);
			for (const cleanup of cleanupCallbacks) cleanup();
			noticeBoard?.dispose();
			if (roomRoot) disposeObject(roomRoot);
			else if (lightMap) lightMap.dispose();
			if (renderer) {
				renderer.dispose();
				renderer.forceContextLoss();
			}
		};
	});
</script>

<div class="room-background" in:fade={{ duration: 300 }} aria-hidden="true">
	<picture class="static-background">
		<source srcset="/bg-large.avif" type="image/avif" media="(min-width: 1921px)" />
		<source srcset="/bg-large.webp" type="image/webp" media="(min-width: 1921px)" />
		<source srcset="/bg-desktop.avif" type="image/avif" />
		<source srcset="/bg-desktop.webp" type="image/webp" />
		<img src="/bg-desktop.webp" alt="" />
	</picture>
	<canvas bind:this={canvas} class:ready></canvas>
</div>

{#if showTuner}
	<details class="room-tuner" open>
		<summary>3D room tuning</summary>
		<div class="tuner-controls">
			<p class="tuner-status">{status}</p>
			<label>
				<span>Camera left/right</span>
				<output>{tuning.cameraHorizontalCentimeters.toFixed(2)} cm</output>
				<input
					type="range"
					min="-100"
					max="100"
					step="1"
					value={tuning.cameraHorizontalCentimeters}
					oninput={(event) =>
						updateTuning('cameraHorizontalCentimeters', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Camera travel</span>
				<output>{tuning.translationCentimeters.toFixed(1)} cm</output>
				<input
					type="range"
					min="0"
					max="15"
					step="0.5"
					value={tuning.translationCentimeters}
					oninput={(event) =>
						updateTuning('translationCentimeters', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Camera rotation</span>
				<output>{tuning.rotationDegrees.toFixed(2)}&deg;</output>
				<input
					type="range"
					min="0"
					max="2"
					step="0.05"
					value={tuning.rotationDegrees}
					oninput={(event) => updateTuning('rotationDegrees', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Camera FOV</span>
				<output>{tuning.cameraFovDegrees.toFixed(1)}&deg;</output>
				<input
					type="range"
					min="30"
					max="75"
					step="0.5"
					value={tuning.cameraFovDegrees}
					oninput={(event) => updateTuning('cameraFovDegrees', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Exposure</span>
				<output>{tuning.exposure.toFixed(2)}</output>
				<input
					type="range"
					min="0.5"
					max="3"
					step="0.05"
					value={tuning.exposure}
					oninput={(event) => updateTuning('exposure', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Baked lighting</span>
				<output>{tuning.lightingIntensity.toFixed(2)}</output>
				<input
					type="range"
					min="0.5"
					max="6"
					step="0.05"
					value={tuning.lightingIntensity}
					oninput={(event) => updateTuning('lightingIntensity', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board rope length</span>
				<output>{tuning.noticeBoardRopeLengthMeters.toFixed(2)} m</output>
				<input
					type="range"
					min="0.1"
					max="3"
					step="0.05"
					value={tuning.noticeBoardRopeLengthMeters}
					oninput={(event) =>
						updateTuning('noticeBoardRopeLengthMeters', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board depth</span>
				<output>{tuning.noticeBoardDepthMeters.toFixed(1)} m</output>
				<input
					type="range"
					min="1.5"
					max="10"
					step="0.25"
					value={tuning.noticeBoardDepthMeters}
					oninput={(event) =>
						updateTuning('noticeBoardDepthMeters', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board left/right</span>
				<output>{tuning.noticeBoardHorizontalPercent.toFixed(0)}%</output>
				<input
					type="range"
					min="-35"
					max="35"
					step="1"
					value={tuning.noticeBoardHorizontalPercent}
					oninput={(event) =>
						updateTuning('noticeBoardHorizontalPercent', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board size</span>
				<output>{tuning.noticeBoardScale.toFixed(2)}&times;</output>
				<input
					type="range"
					min="0.6"
					max="3"
					step="0.05"
					value={tuning.noticeBoardScale}
					oninput={(event) => updateTuning('noticeBoardScale', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board rotation</span>
				<output>{tuning.noticeBoardRotationDegrees.toFixed(1)}&deg;</output>
				<input
					type="range"
					min="-30"
					max="30"
					step="0.5"
					value={tuning.noticeBoardRotationDegrees}
					oninput={(event) =>
						updateTuning('noticeBoardRotationDegrees', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Notice board brightness</span>
				<output>{tuning.noticeBoardBrightness.toFixed(2)}</output>
				<input
					type="range"
					min="0.5"
					max="1.2"
					step="0.05"
					value={tuning.noticeBoardBrightness}
					oninput={(event) =>
						updateTuning('noticeBoardBrightness', Number(event.currentTarget.value))}
				/>
			</label>

			<p class="tuner-section">Notice board physics</p>

			<label>
				<span>Push strength</span>
				<output>{tuning.noticeBoardPushStrength.toFixed(2)}&times;</output>
				<input
					type="range"
					min="0"
					max="2.5"
					step="0.05"
					value={tuning.noticeBoardPushStrength}
					oninput={(event) =>
						updateTuning('noticeBoardPushStrength', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Swing speed</span>
				<output>{tuning.noticeBoardSwingSpeed.toFixed(2)}&times;</output>
				<input
					type="range"
					min="0.35"
					max="2"
					step="0.05"
					value={tuning.noticeBoardSwingSpeed}
					oninput={(event) =>
						updateTuning('noticeBoardSwingSpeed', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Swing damping</span>
				<output>{tuning.noticeBoardSwingDamping.toFixed(2)}&times;</output>
				<input
					type="range"
					min="0.1"
					max="3"
					step="0.05"
					value={tuning.noticeBoardSwingDamping}
					oninput={(event) =>
						updateTuning('noticeBoardSwingDamping', Number(event.currentTarget.value))}
				/>
			</label>

			<label>
				<span>Twist strength</span>
				<output>{tuning.noticeBoardTwistStrength.toFixed(2)}&times;</output>
				<input
					type="range"
					min="0"
					max="2.5"
					step="0.05"
					value={tuning.noticeBoardTwistStrength}
					oninput={(event) =>
						updateTuning('noticeBoardTwistStrength', Number(event.currentTarget.value))}
				/>
			</label>

			<div class="tuner-footer">
				<p>Saved on this device.</p>
				<button type="button" onclick={resetTuning}>Reset</button>
			</div>
		</div>
	</details>
{/if}

<style>
	.room-background,
	.static-background {
		position: fixed;
		inset: 0;
		display: block;
		pointer-events: none;
		user-select: none;
	}

	.room-background {
		z-index: 0;
		overflow: hidden;
		background: #21150f;
	}

	.static-background img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 220ms ease-out;
	}

	canvas.ready {
		opacity: 1;
	}

	.room-tuner {
		position: fixed;
		z-index: 9500;
		bottom: max(0.75rem, var(--safe-area-inset-bottom));
		left: max(0.75rem, var(--safe-area-inset-left));
		width: min(18rem, calc(100vw - 1.5rem));
		max-height: calc(var(--app-height) - 1.5rem);
		overflow: auto;
		border: 1px solid rgb(251 191 36 / 0.35);
		border-radius: 0.75rem;
		background: rgb(20 13 9 / 0.9);
		box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.4);
		color: rgb(255 251 235);
		font-family: Inter, sans-serif;
		font-size: 0.75rem;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.room-tuner summary {
		padding: 0.75rem;
		cursor: pointer;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		user-select: none;
	}

	.tuner-controls {
		display: grid;
		gap: 0.75rem;
		padding: 0 0.75rem 0.75rem;
	}

	.tuner-status {
		margin: 0;
		color: rgb(252 211 77 / 0.8);
	}

	.tuner-section {
		margin: 0.25rem 0 -0.15rem;
		border-top: 1px solid rgb(255 255 255 / 0.12);
		padding-top: 0.75rem;
		color: rgb(252 211 77 / 0.8);
		font-weight: 700;
		letter-spacing: 0.03em;
	}

	.tuner-controls label {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 0.75rem;
		align-items: center;
	}

	.tuner-controls output {
		color: rgb(252 211 77);
		font-variant-numeric: tabular-nums;
	}

	.tuner-controls input[type='range'] {
		grid-column: 1 / -1;
		width: 100%;
		accent-color: rgb(217 119 6);
	}

	.tuner-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		color: rgb(255 255 255 / 0.55);
	}

	.tuner-footer p {
		margin: 0;
	}

	.tuner-footer button {
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: rgb(255 255 255 / 0.08);
		color: inherit;
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		canvas {
			display: none;
		}
	}
</style>
