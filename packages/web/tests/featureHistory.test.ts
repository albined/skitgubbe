import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { compileModule } from 'svelte/compiler';

const STATE_FILE_PATH = path.join(__dirname, '../src/lib/featureHistory.svelte.ts');
const COMPILED_FILE_PATH = path.join(__dirname, 'featureHistory.test-compiled.js');

let FeatureHistory: any;

beforeAll(async () => {
	const source = fs.readFileSync(STATE_FILE_PATH, 'utf8');
	const transpiler = new Bun.Transpiler({ loader: 'ts' });
	const pureJs = transpiler.transformSync(source);

	const compiled = compileModule(pureJs, {
		filename: 'featureHistory.svelte.ts',
		dev: true
	});

	fs.writeFileSync(COMPILED_FILE_PATH, compiled.js.code, 'utf8');
	const mod = await import('./featureHistory.test-compiled.js' as any);
	FeatureHistory = mod.FeatureHistory;
});

afterAll(() => {
	if (fs.existsSync(COMPILED_FILE_PATH)) {
		fs.unlinkSync(COMPILED_FILE_PATH);
	}
});

const dummyState1 = {
	features: [{ id: '1' }],
	skinColor: '#111',
	hairColor: '#222',
	eyeColor: '#333',
	eyebrowColor: '#444',
	lipColor: '#555',
	bgColor: '#666'
};

const dummyState2 = {
	features: [{ id: '1' }, { id: '2' }],
	skinColor: '#aaa',
	hairColor: '#bbb',
	eyeColor: '#ccc',
	eyebrowColor: '#ddd',
	lipColor: '#eee',
	bgColor: '#fff'
};

describe('FeatureHistory State Manager', () => {
	test('initialization and reset', () => {
		const history = new FeatureHistory();
		expect(history.current).toBeNull();
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);

		history.reset(dummyState1);
		expect(history.current).toEqual(dummyState1);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});

	test('pushing new states', () => {
		const history = new FeatureHistory();
		history.reset(dummyState1);
		history.push(dummyState2);

		expect(history.current).toEqual(dummyState2);
		expect(history.canUndo).toBe(true);
		expect(history.canRedo).toBe(false);

		// Test deduplication: pushing same state back-to-back should do nothing
		history.push(dummyState2);
		expect(history.history.length).toBe(2);
	});

	test('undo and redo functionality', () => {
		const history = new FeatureHistory();
		history.reset(dummyState1);
		history.push(dummyState2);

		const undone = history.undo();
		expect(undone).toEqual(dummyState1);
		expect(history.current).toEqual(dummyState1);
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(true);

		const redone = history.redo();
		expect(redone).toEqual(dummyState2);
		expect(history.current).toEqual(dummyState2);
		expect(history.canUndo).toBe(true);
		expect(history.canRedo).toBe(false);
	});

	test('overwriting future history when pushing after undo', () => {
		const history = new FeatureHistory();
		history.reset(dummyState1);
		history.push(dummyState2);

		history.undo();

		const dummyState3 = {
			...dummyState1,
			bgColor: '#abc'
		};

		history.push(dummyState3);
		expect(history.history.length).toBe(2);
		expect(history.current).toEqual(dummyState3);
		expect(history.canRedo).toBe(false);
	});
});
