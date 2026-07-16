/**
 * One-off (re-runnable) optimizer for static/cards/*.svg — the court card
 * illustrations rendered via <image href="/cards/..."> in CardFace.svelte.
 *
 * Unlike optimize-avatar-features.ts these are standalone SVG documents with
 * no runtime id/class dependencies, so a plain preset-default pass is safe.
 * Precision 2 on the 168x243 viewBox keeps max rounding error well below a
 * device pixel at rendered sizes.
 *
 * Run from packages/web: bun run scripts/optimize-cards.ts
 */
import { optimize } from 'svgo';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), '../static/cards');

let totalBefore = 0;
let totalAfter = 0;

for (const file of readdirSync(cardsDir)
	.filter((f) => f.endsWith('.svg'))
	.sort()) {
	const path = join(cardsDir, file);
	const original = readFileSync(path, 'utf-8');
	const { data } = optimize(original, {
		multipass: true,
		plugins: [
			{
				name: 'preset-default',
				params: {
					overrides: {
						convertPathData: { floatPrecision: 2 },
						cleanupNumericValues: { floatPrecision: 2 },
						convertTransform: { floatPrecision: 2, transformPrecision: 2 }
					}
				}
			}
		]
	});
	totalBefore += original.length;
	totalAfter += data.length;
	writeFileSync(path, data);
	console.log(`${file}: ${original.length} -> ${data.length}`);
}

console.log(
	`total: ${totalBefore} -> ${totalAfter} chars (${((1 - totalAfter / totalBefore) * 100).toFixed(1)}% smaller)`
);
