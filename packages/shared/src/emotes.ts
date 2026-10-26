export const EMOTES = ['😝', '😭', '😎', '😡', '😱', '😵', '🤢', '💀', '👍', '👎'] as const;

// The same ten faces, drawn for a role: poops for whoever wears the skitgubbe
// hat, leprechauns for this game's Trumfman.
const FACES = [
	'tongue',
	'crying',
	'sunglasses',
	'angry',
	'screaming',
	'dizzy',
	'nauseated',
	'skull',
	'thumbs-up',
	'thumbs-down'
];

export type EmoteSet = 'poop' | 'leprechaun';

// Ids stay within the server's 20-character emote limit.
export const POOP_EMOTES = FACES.map((face) => `poop:${face}`);
export const LEPRECHAUN_EMOTES = FACES.map((face) => `lep:${face}`);

export function emoteSet(emote: string): EmoteSet | null {
	if (POOP_EMOTES.includes(emote)) return 'poop';
	if (LEPRECHAUN_EMOTES.includes(emote)) return 'leprechaun';
	return null;
}
