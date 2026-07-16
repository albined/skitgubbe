import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { compileModule } from 'svelte/compiler';

const STATE_FILE_PATH = path.join(__dirname, '../src/lib/avatarGestureController.svelte.ts');
const COMPILED_FILE_PATH = path.join(__dirname, 'avatarGestureController.test-compiled.js');

let AvatarGestureController: any;

beforeAll(async () => {
	// Mock document environment
	globalThis.document = {
		getElementById: (id: string) => {
			if (id === 'avatar-canvas') {
				return {
					contains: () => false,
					getBoundingClientRect: () => ({ left: 10, top: 10, right: 210, bottom: 210 }),
					createSVGPoint: () => ({
						x: 0,
						y: 0,
						matrixTransform: () => ({ x: 50, y: 50 })
					}),
					getScreenCTM: () => ({
						inverse: () => ({})
					})
				};
			}
			return null;
		}
	} as any;

	const source = fs.readFileSync(STATE_FILE_PATH, 'utf8');
	const transpiler = new Bun.Transpiler({ loader: 'ts' });
	const pureJs = transpiler.transformSync(source);

	const compiled = compileModule(pureJs, {
		filename: 'avatarGestureController.svelte.ts',
		dev: true
	});

	fs.writeFileSync(COMPILED_FILE_PATH, compiled.js.code, 'utf8');
	const mod = await import('./avatarGestureController.test-compiled.js' as any);
	AvatarGestureController = mod.AvatarGestureController;
});

afterAll(() => {
	if (fs.existsSync(COMPILED_FILE_PATH)) {
		fs.unlinkSync(COMPILED_FILE_PATH);
	}
});

describe('AvatarGestureController', () => {
	test('initialization', () => {
		let historyPushed = false;
		const controller = new AvatarGestureController(() => {
			historyPushed = true;
		});

		expect(controller.placedFeatures).toEqual([]);
		expect(controller.selectedFeatureId).toBeNull();
		expect(controller.selectedFeature).toBeNull();

		// Trigger history callback
		controller.pushHistoryState();
		expect(historyPushed).toBe(true);
	});

	test('prepareAddFeature limit check and duplicate replace', () => {
		const controller = new AvatarGestureController(() => {});
		const dummyTemplate = {
			id: 'head_base',
			name: 'Classic Rounded',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 0.7,
			defaultScaleY: 0.7,
			zIndex: 10
		};

		controller.prepareAddFeature('head', dummyTemplate, 0, 0);
		expect(controller.placedFeatures.length).toBe(1);
		expect(controller.placedFeatures[0].templateId).toBe('head_base');
		expect(controller.selectedFeatureId).not.toBeNull();

		// Replace because limit for 'head' is 1
		const dummyTemplate2 = {
			...dummyTemplate,
			id: 'head_angular',
			name: 'Angular Jaw'
		};
		controller.prepareAddFeature('head', dummyTemplate2, 10, 10);
		expect(controller.placedFeatures.length).toBe(1);
		expect(controller.placedFeatures[0].templateId).toBe('head_angular');
	});

	test('mirror/scale/rotate feature actions', () => {
		const controller = new AvatarGestureController(() => {});
		const dummyTemplate = {
			id: 'head_base',
			name: 'Classic Rounded',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 0.7,
			defaultScaleY: 0.7,
			zIndex: 10
		};

		controller.prepareAddFeature('head', dummyTemplate, 0, 0);
		const id = controller.selectedFeatureId;

		controller.mirrorFeature();
		expect(controller.placedFeatures[0].scaleX).toBe(-0.7);

		controller.changeScale(2);
		expect(controller.placedFeatures[0].scaleX).toBe(-1.4);

		controller.rotateFeature(45);
		expect(controller.placedFeatures[0].rotation).toBe(45);

		controller.removeSelectedFeature();
		expect(controller.placedFeatures.length).toBe(0);
		expect(controller.selectedFeatureId).toBeNull();
	});

	test('pointer checks', () => {
		const controller = new AvatarGestureController(() => {});
		expect(controller.isPointerOverCanvas(50, 50)).toBe(true);
		expect(controller.isPointerOverCanvas(5, 5)).toBe(false);
	});

	test('library drag drop centers artwork under the pointer', () => {
		const controller = new AvatarGestureController(() => {});
		const template = {
			id: 'eye_1',
			name: 'Eye',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 1,
			defaultScaleY: 1,
			zIndex: 5
		};
		const fakeTarget = { setPointerCapture: () => {} };
		controller.handleLibraryPointerDown('eyes', template, {
			pointerId: 1,
			clientX: 300,
			clientY: 300,
			stopPropagation: () => {},
			currentTarget: fakeTarget
		} as any);

		// Move onto the canvas; the mocked SVG maps any client point to SVG (50,50)
		controller.handleLibraryPointerMove({
			pointerId: 1,
			clientX: 100,
			clientY: 100,
			stopPropagation: () => {}
		} as any);

		expect(controller.placedFeatures.length).toBe(1);
		// x/y are offsets from the centered default, so SVG point (50,50) must
		// become (-50,-50) — placing the artwork center (100,100) under the pointer
		expect(controller.placedFeatures[0].x).toBe(-50);
		expect(controller.placedFeatures[0].y).toBe(-50);
	});

	test('second finger during drag starts pinch instead of deselecting', () => {
		const controller = new AvatarGestureController(() => {});
		const template = {
			id: 'head_base',
			name: 'Classic Rounded',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 0.7,
			defaultScaleY: 0.7,
			zIndex: 10
		};
		controller.prepareAddFeature('head', template, 0, 0);
		const id = controller.selectedFeatureId;

		controller.startDrag(id, {
			pointerId: 1,
			clientX: 50,
			clientY: 50,
			stopPropagation: () => {},
			preventDefault: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);
		expect(controller.isDragging).toBe(true);

		// Second finger lands outside the canvas on empty page background
		controller.handleGlobalPointerDown({
			pointerId: 2,
			clientX: 400,
			clientY: 400,
			target: { closest: () => null }
		} as any);

		expect(controller.isPinching).toBe(true);
		expect(controller.selectedFeatureId).toBe(id);
	});

	test('drag places a fresh piece at the drop point instead of swapping the selected one', () => {
		const controller = new AvatarGestureController(() => {});
		const mouth1 = {
			id: 'mouth_1',
			name: 'Smile',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 1,
			defaultScaleY: 1,
			zIndex: 6
		};
		const mouth2 = { ...mouth1, id: 'mouth_2', name: 'Grin' };

		// Existing mouth placed away from center, still selected after its drop
		controller.prepareAddFeature('mouth', mouth1, 30, 40);
		expect(controller.selectedFeatureId).not.toBeNull();

		// Drag mouth2 from the library onto the canvas
		controller.handleLibraryPointerDown('mouth', mouth2, {
			pointerId: 1,
			clientX: 300,
			clientY: 300,
			stopPropagation: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);
		controller.handleLibraryPointerMove({
			pointerId: 1,
			clientX: 100,
			clientY: 100,
			stopPropagation: () => {}
		} as any);

		// Limit 1 for mouth: old mouth replaced, but the new one sits at the
		// drop point (mocked SVG coords (50,50) → offset (-50,-50)), not at the
		// old mouth's position
		expect(controller.placedFeatures.length).toBe(1);
		expect(controller.placedFeatures[0].templateId).toBe('mouth_2');
		expect(controller.placedFeatures[0].x).toBe(-50);
		expect(controller.placedFeatures[0].y).toBe(-50);
		// Continued dragging must be anchored at the drop point too
		expect(controller.initialFeatureX).toBe(-50);
		expect(controller.initialFeatureY).toBe(-50);
	});

	test('second finger on a library item pinches instead of starting a new drag', () => {
		const controller = new AvatarGestureController(() => {});
		const head = {
			id: 'head_base',
			name: 'Classic Rounded',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 0.7,
			defaultScaleY: 0.7,
			zIndex: 10
		};
		controller.prepareAddFeature('head', head, 0, 0);
		const id = controller.selectedFeatureId;

		controller.startDrag(id, {
			pointerId: 1,
			clientX: 50,
			clientY: 50,
			stopPropagation: () => {},
			preventDefault: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);

		controller.handleLibraryPointerDown('eyes', { ...head, id: 'eye_1' }, {
			pointerId: 2,
			clientX: 400,
			clientY: 300,
			stopPropagation: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);

		expect(controller.pendingLibraryDrag).toBeNull();
		expect(controller.isPinching).toBe(true);
		expect(controller.selectedFeatureId).toBe(id);
	});

	test('pinch fingers released outside the canvas do not trash the piece', () => {
		const controller = new AvatarGestureController(() => {});
		const head = {
			id: 'head_base',
			name: 'Classic Rounded',
			svgContent: '<path />',
			defaultX: 0,
			defaultY: 0,
			defaultScaleX: 0.7,
			defaultScaleY: 0.7,
			zIndex: 10
		};
		controller.prepareAddFeature('head', head, 0, 0);
		const id = controller.selectedFeatureId;

		controller.startDrag(id, {
			pointerId: 1,
			clientX: 50,
			clientY: 50,
			stopPropagation: () => {},
			preventDefault: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);
		controller.handleGlobalPointerDown({
			pointerId: 2,
			clientX: 400,
			clientY: 400,
			target: { closest: () => null }
		} as any);
		expect(controller.isPinching).toBe(true);

		// Both fingers lift outside the canvas (rect is 10..210 in the mock)
		controller.handlePointerUp({ pointerId: 1, clientX: 400, clientY: 400, target: {} } as any);
		controller.handlePointerUp({ pointerId: 2, clientX: 400, clientY: 400, target: {} } as any);

		expect(controller.placedFeatures.length).toBe(1);
		expect(controller.isDragging).toBe(false);

		// A plain drag released outside still trashes the piece
		controller.startDrag(id, {
			pointerId: 3,
			clientX: 50,
			clientY: 50,
			stopPropagation: () => {},
			preventDefault: () => {},
			currentTarget: { setPointerCapture: () => {} }
		} as any);
		controller.handlePointerUp({ pointerId: 3, clientX: 400, clientY: 400, target: {} } as any);
		expect(controller.placedFeatures.length).toBe(0);
	});
});
