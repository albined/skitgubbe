import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { DRAG, SOUND_IDS, dragLevel, sfx } from '../src/lib/audio/sfx';

const SFX_DIR = path.join(__dirname, '../static/sfx');

describe('sound effects', () => {
	test('every sound the game plays was promoted, and nothing else was', () => {
		const manifest = JSON.parse(fs.readFileSync(path.join(SFX_DIR, 'manifest.json'), 'utf8'));
		expect(Object.keys(manifest.sounds).sort()).toEqual([...SOUND_IDS].sort());
		for (const id of SOUND_IDS) {
			const file = path.join(SFX_DIR, manifest.sounds[id].file);
			expect(fs.existsSync(file)).toBe(true);
			expect(fs.readFileSync(file).subarray(0, 4).toString()).toBe('RIFF');
		}
		expect(manifest.sounds.card_drag.loop).toBe(true);
	});

	test('the drag loop is silent when still and full at a brisk drag', () => {
		expect(dragLevel(0)).toBe(0);
		expect(dragLevel(-1)).toBe(0);
		expect(dragLevel(DRAG.fullSpeed)).toBe(1);
		expect(dragLevel(DRAG.fullSpeed * 5)).toBe(1);
		const levels = [0.1, 0.3, 0.6, 0.9].map(dragLevel);
		expect(levels).toEqual([...levels].sort((a, b) => a - b));
	});

	test('without audio (server rendering, tests) playing is a silent no-op', () => {
		expect(sfx.play('card_play')).toBeNull();
		expect(sfx.startDragLoop()).toBeNull();
	});
});
