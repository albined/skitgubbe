import { expect, test } from 'bun:test';
import features from '../src/lib/avatarFeatures.json';
import { namespaceSvgGradients } from '../src/lib/svgNamespace';

test('every template can be repeated without sharing local clip paths, filters or gradients', () => {
	for (const category of features) {
		for (const feature of category.features) {
			const source = feature.svgContent;
			const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
			for (const prefix of ['profile_1_eye_1', 'profile_1_eye_2', 'profile_2_eye_1']) {
				const result = namespaceSvgGradients(source, prefix);
				for (const id of ids) {
					expect(result).toContain(`id="${prefix}_${id}"`);
					expect(result).not.toContain(`url(#${id})`);
				}
			}
		}
	}
});

test('preserves shared references and escapes untrusted placement IDs', () => {
	const result = namespaceSvgGradients(
		'<g id="local" filter="url(#eye-shadow)"><use href="#local"/></g>',
		'x" onload="bad'
	);
	expect(result).toContain('filter="url(#eye-shadow)"');
	expect(result).toContain('href="#x%22%20onload%3D%22bad_local"');
	expect(result).not.toContain(' onload="');
});
