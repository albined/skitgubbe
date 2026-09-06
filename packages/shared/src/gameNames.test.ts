import { expect, test } from 'bun:test';
import { GAME_NAME_ADJECTIVES, GAME_NAME_NOUNS, generateGameName } from './gameNames';

test('all 576 curated names fit the game name input without truncation', () => {
	const names = GAME_NAME_ADJECTIVES.flatMap((adjective) =>
		GAME_NAME_NOUNS.map((noun) => `${adjective} ${noun}`)
	);
	expect(new Set(names).size).toBe(576);
	for (const name of names) expect(name.length).toBeLessThanOrEqual(20);
});

test('skips active names regardless of case and finishes even when every name is taken', () => {
	expect(generateGameName([], () => 0)).toBe('Förvirrade knektar');
	expect(generateGameName([' FÖRVIRRADE KNEKTAR '], () => 0)).toBe('Förvirrade potatisar');
	const all = GAME_NAME_ADJECTIVES.flatMap((adjective) =>
		GAME_NAME_NOUNS.map((noun) => `${adjective} ${noun}`)
	);
	expect(generateGameName(all, () => 0)).toBe('Förvirrade knektar');
	expect(generateGameName([], () => 0.999999)).toBe('Fnissiga klåpare');
});
