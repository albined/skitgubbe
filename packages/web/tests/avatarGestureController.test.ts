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
});
