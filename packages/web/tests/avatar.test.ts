import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { compile } from 'svelte/compiler';

const AVATAR_FILE_PATH = path.join(__dirname, '../src/lib/Avatar.svelte');

describe('Avatar.svelte Component Compilation and Logic', () => {
	test('compiles successfully and contains QW-21 logic', () => {
		const source = fs.readFileSync(AVATAR_FILE_PATH, 'utf8');

		// Compile the Svelte component
		const result = compile(source, {
			filename: 'Avatar.svelte',
			dev: true,
			generate: 'client'
		});

		// Verify no errors or warnings (ignoring the context="module" deprecation warning)
		const errors = result.warnings.filter((w) => w.code !== 'script_context_deprecated');
		expect(errors.length).toBe(0);

		const compiledCode = result.js.code;

		// 1. Verify HEX_COLOR_REGEX is present
		expect(compiledCode).toContain('HEX_COLOR_REGEX');
		expect(compiledCode).toContain('^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$');

		// 2. Verify isValidHex is present
		expect(compiledCode).toContain('isValidHex');

		// 3. Verify monotonic avatarCounter is present and used
		expect(compiledCode).toContain('avatarCounter');
		expect(compiledCode).toContain('avatar-');

		// 4. Verify fallback values are used for color validation
		expect(compiledCode).toContain('#FFCDB2');
		expect(compiledCode).toContain('#3E2723');
		expect(compiledCode).toContain('#4CAF50');
		expect(compiledCode).toContain('#5D4037');
		expect(compiledCode).toContain('#e64a19');
		expect(compiledCode).toContain('#3b82f6');

		// 5. Verify security comments are present in the source code
		expect(source).toContain('must only render trusted AVATAR_FEATURES content');
	});
});
