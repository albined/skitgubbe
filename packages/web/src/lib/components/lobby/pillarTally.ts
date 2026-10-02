import type { ApiPillarTallyPlayer } from 'shared';

export const TALLY_BUNDLE_SIZE = 25;
export type TallyPlayer = ApiPillarTallyPlayer;

export function splitTally(value: number): { bundles: number; remainder: number } {
	const total = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	return { bundles: Math.floor(total / TALLY_BUNDLE_SIZE), remainder: total % TALLY_BUNDLE_SIZE };
}
