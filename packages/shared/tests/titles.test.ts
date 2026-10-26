import { describe, test, expect } from 'bun:test';
import { gameTitle, roomTitle, type PlayerTitles } from '../src/titles.js';

const player = (id: string, flags: Record<string, boolean> = {}) => ({
	id,
	isSkitgubbe: false,
	...flags
});

describe('roomTitle', () => {
	const titles: PlayerTitles = {
		skitgubbeId: 'sg',
		luck: { sg: 'trumfman', lucky: 'sweetgubbe' }
	};

	test('a game in progress shows the global titles, skitgubbe hiding a luck title', () => {
		const state = { status: 'playing', players: [player('sg'), player('lucky'), player('plain')] };
		expect(roomTitle(state, 'sg', titles)).toBe('skitgubbe');
		expect(roomTitle(state, 'lucky', titles)).toBe('sweetgubbe');
		expect(roomTitle(state, 'plain', titles)).toBeNull();
		expect(roomTitle(state, 'sg', null)).toBeNull();
	});

	test('a finished game keeps showing its own outcome, whatever the global titles say', () => {
		const state = {
			status: 'ended',
			players: [
				player('sg', { isTrumfman: true }),
				player('lucky'),
				player('loser', { isSkitgubbe: true, isSweetgubbe: true })
			]
		};
		expect(roomTitle(state, 'loser', titles)).toBe('skitgubbe');
		expect(roomTitle(state, 'sg', titles)).toBe('trumfman');
		expect(roomTitle(state, 'lucky', titles)).toBeNull();
	});
});

describe('gameTitle', () => {
	test('ranks skitgubbe above the luck titles', () => {
		expect(gameTitle(player('a', { isSkitgubbe: true, isTrumfman: true }))).toBe('skitgubbe');
		expect(gameTitle(player('a', { isTrumfman: true }))).toBe('trumfman');
		expect(gameTitle(player('a', { isSweetgubbe: true }))).toBe('sweetgubbe');
		expect(gameTitle(player('a'))).toBeNull();
		expect(gameTitle(undefined)).toBeNull();
	});
});
