/**
 * One-off (re-runnable) optimizer for src/lib/avatarFeatures.json (P-8.1).
 *
 * Each feature's `svgContent` is an SVG *fragment*: it is wrapped in an
 * `<svg>` root here, run through SVGO, and unwrapped again before being
 * written back to the JSON file.
 *
 * Constraints that shape the SVGO config:
 * - ids must never be renamed or removed: `url(#...)` references cross
 *   fragment boundaries (e.g. a filter defined in one nose variant is
 *   referenced by others), and `namespaceSvgGradients()` rewrites `_grad_`
 *   ids at runtime by string substitution.
 * - `class` attributes (skin-color, hair-color, ...) drive runtime
 *   recoloring and must survive.
 *
 * Run from packages/web: bun run scripts/optimize-avatar-features.ts
 */
import { optimize } from 'svgo';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const jsonPath = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/avatarFeatures.json');

interface Feature {
	id: string;
	svgContent: string;
	[key: string]: unknown;
}
interface Category {
	id: string;
	features: Feature[];
	[key: string]: unknown;
}

const categories: Category[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));

const collectIds = (s: string) => new Set([...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const collectRefs = (s: string) => new Set([...s.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]));
const collectClasses = (s: string) =>
	new Set([...s.matchAll(/\bclass="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));

function assertSetsEqual(label: string, before: Set<string>, after: Set<string>) {
	const missing = [...before].filter((x) => !after.has(x));
	const added = [...after].filter((x) => !before.has(x));
	if (missing.length || added.length) {
		throw new Error(`${label}: missing=[${missing}] added=[${added}]`);
	}
}

let totalBefore = 0;
let totalAfter = 0;

for (const category of categories) {
	for (const feature of category.features) {
		const original = feature.svgContent;
		const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${original}</svg>`;
		const { data } = optimize(wrapped, {
			multipass: true,
			plugins: [
				{
					name: 'preset-default',
					params: {
						overrides: {
							// ids are load-bearing across fragments and at runtime — never touch them
							cleanupIds: false,
							// nothing here is truly hidden; don't risk dropping styled elements
							removeHiddenElems: false
						}
					}
				}
			]
		});
		const unwrapped = data.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

		assertSetsEqual(`${feature.id} ids`, collectIds(original), collectIds(unwrapped));
		assertSetsEqual(`${feature.id} refs`, collectRefs(original), collectRefs(unwrapped));
		assertSetsEqual(`${feature.id} classes`, collectClasses(original), collectClasses(unwrapped));

		totalBefore += original.length;
		totalAfter += unwrapped.length;
		feature.svgContent = unwrapped;
	}
}

writeFileSync(jsonPath, JSON.stringify(categories, null, '\t') + '\n');
console.log(
	`svgContent: ${totalBefore} -> ${totalAfter} chars (${((1 - totalAfter / totalBefore) * 100).toFixed(1)}% smaller)`
);
