import { describe, expect, test } from 'bun:test';
import { bumpVersion, formatVersion, MAX_VERSION_CODE, parseVersion } from './version.mjs';

describe('Android release versioning', () => {
	const initial = { versionName: '1.2.3', versionCode: 7 };
	test.each([
		['build', '1.2.3'],
		['patch', '1.2.4'],
		['minor', '1.3.0'],
		['major', '2.0.0']
	])('%s increments the upload code and selects the intended display version', (kind, name) => {
		expect(bumpVersion(initial, kind)).toEqual({ versionName: name, versionCode: 8 });
		expect(initial).toEqual({ versionName: '1.2.3', versionCode: 7 });
	});
	test('reading/rebuilding never bumps the version', () => {
		expect(parseVersion(formatVersion(initial))).toEqual(initial);
	});
	test('rejects duplicate or malformed properties instead of silently changing their meaning', () => {
		expect(() => parseVersion('versionName=1.0.0=extra\nversionCode=1')).toThrow();
		expect(() => parseVersion('versionName=1.0.0\nversionCode=1\nversionCode=2')).toThrow();
	});
	test.each(['0', '-1', '1.5', '01', '2147483647', 'NaN', ''])(
		'rejects invalid upload code %s',
		(code) => {
			expect(() => parseVersion(`versionName=0.1.0\nversionCode=${code}`)).toThrow();
		}
	);
	test.each(['', '1', '1.0', '01.0.0', '1.0.0-beta'])(
		'rejects invalid display version %s',
		(name) => {
			expect(() => parseVersion(`versionName=${name}\nversionCode=1`)).toThrow();
		}
	);
	test('rejects exhaustion of the Play version code range and unknown commands', () => {
		expect(() => bumpVersion({ ...initial, versionCode: MAX_VERSION_CODE }, 'build')).toThrow();
		expect(() => bumpVersion(initial, 'release')).toThrow();
	});
});
