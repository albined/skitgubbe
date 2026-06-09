export interface CardTextSetting {
	text: string;
	edge?: 'top' | 'bottom' | 'left' | 'right';
	size?: number; // font size in SVG user units (default: 14)
	color?: string; // custom color fill (optional)
}

export const cardTexts: Record<string, string | CardTextSetting> = {
	// Custom mappings
	'hearts-6': { text: 'ULTRATRUMF', edge: 'top', size: 18 },
	'diamonds-K': { text: 'KUNGTRUMFEN', edge: 'left', size: 18 },
	'diamonds-A': { text: 'SMITARN', edge: 'top', size: 18 },
	'hearts-Q': { text: 'DET FoRBANNADE KORTET', edge: 'left', size: 14},
	'diamonds-Q': { text: 'Det Missade kortet', edge: 'left', size: 14},
	'hearts-10': { text: 'TIO', edge: 'top', size: 18},
	'hearts-J': { text: 'Hjarterklover', edge: 'top', size: 18},
	'spades-K': { text: 'DEN SVARTA KUNGEN', edge: 'left', size: 14},
	'spades-A': { text: 'SPADERTRUMF', edge: 'top', size: 18},
	'spades-J': { text: 'KNIGGET', edge: 'top', size: 18},
	'diamonds-5': { text: 'Kloverfjutter', edge: 'left', size: 18},
	'diamonds-4': { text: 'Strafffyran', edge: 'top', size: 18},
	'clubs-7': { text: 'Det forlorade kortet-II', edge: 'left', size: 14},
	'clubs-J': { text: 'Blabarsknakten', edge: 'left', size: 18},
	'spades-6': { text: 'Stoppklossen', edge: 'top', size: 18},
};

/**
 * Resolves the custom text configuration for a card.
 * Fallback matching order:
 * 1. Specific card ID (e.g. 'hearts-4')
 * 2. Card value fallback (e.g. '4')
 * 3. Card suit fallback (e.g. 'hearts')
 */
export function getCardTextConfig(cardId: string, value: string, suitName: string) {
	const match = cardTexts[cardId] || cardTexts[value] || cardTexts[suitName];
	if (!match) return null;

	if (typeof match === 'string') {
		return {
			text: match,
			edge: 'bottom' as const,
			size: 14
		};
	}

	return {
		text: match.text,
		edge: match.edge || ('bottom' as const),
		size: match.size || 14,
		color: match.color
	};
}
