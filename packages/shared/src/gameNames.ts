// Plural adjectives + plural nouns: every pairing works in Swedish.
// Keep the vocabulary vegetarian-friendly and every name within 20 characters.
export const GAME_NAME_ADJECTIVES = [
	'Förvirrade',
	'Lömska',
	'Sömniga',
	'Kaxiga',
	'Vilda',
	'Kungliga',
	'Nervösa',
	'Hemliga',
	'Glada',
	'Kluriga',
	'Busiga',
	'Yra',
	'Magiska',
	'Modiga',
	'Sura',
	'Snabba',
	'Luriga',
	'Tokiga',
	'Nyfikna',
	'Stolta',
	'Glittriga',
	'Pratsamma',
	'Dansande',
	'Fnissiga'
] as const;

export const GAME_NAME_NOUNS = [
	'knektar',
	'potatisar',
	'kungar',
	'gurkor',
	'tofflor',
	'ess',
	'trumfar',
	'damer',
	'morötter',
	'tomater',
	'ärtor',
	'bönor',
	'paprikor',
	'rädisor',
	'svampar',
	'pumpor',
	'bananer',
	'citroner',
	'strumpor',
	'stövlar',
	'moln',
	'troll',
	'robotar',
	'klåpare'
] as const;

export function generateGameName(
	existingNames: Iterable<string> = [],
	random = Math.random
): string {
	const used = new Set([...existingNames].map((name) => name.trim().toLocaleLowerCase('sv')));
	const count = GAME_NAME_ADJECTIVES.length * GAME_NAME_NOUNS.length;
	const start = Math.floor(random() * count);
	let first = '';
	for (let offset = 0; offset < count; offset++) {
		const index = (start + offset) % count;
		const name = `${GAME_NAME_ADJECTIVES[Math.floor(index / GAME_NAME_NOUNS.length)]} ${GAME_NAME_NOUNS[index % GAME_NAME_NOUNS.length]}`;
		if (offset === 0) first = name;
		if (!used.has(name.toLocaleLowerCase('sv'))) return name;
	}
	// Display names are not identifiers. Reuse one if all combinations are taken.
	return first;
}
