export const MAX_VERSION_CODE = 2_100_000_000;

export function parseVersion(text) {
	const values = {};
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim() || line.trim().startsWith('#')) continue;
		const match = line.trim().match(/^(versionName|versionCode)\s*=\s*(\S+)$/);
		if (!match || Object.hasOwn(values, match[1])) {
			throw new Error('version.properties must contain exactly one versionName and versionCode.');
		}
		values[match[1]] = match[2];
	}
	if (
		!/^[1-9]\d*$/.test(values.versionCode ?? '') ||
		Number(values.versionCode) > MAX_VERSION_CODE
	) {
		throw new Error(`versionCode must be an integer from 1 to ${MAX_VERSION_CODE}.`);
	}
	if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(values.versionName ?? '')) {
		throw new Error('versionName must be major.minor.patch (for example 0.1.0).');
	}
	return { versionName: values.versionName, versionCode: Number(values.versionCode) };
}

export function bumpVersion(version, kind) {
	if (!['build', 'patch', 'minor', 'major'].includes(kind)) {
		throw new Error('Usage: bun run android:version build|patch|minor|major');
	}
	let [major, minor, patch] = version.versionName.split('.').map(BigInt);
	if (kind === 'patch') patch++;
	if (kind === 'minor') {
		minor++;
		patch = 0n;
	}
	if (kind === 'major') {
		major++;
		minor = 0n;
		patch = 0n;
	}
	return parseVersion(
		`versionName=${major}.${minor}.${patch}\nversionCode=${version.versionCode + 1}`
	);
}

export function formatVersion(version) {
	return `# Bump intentionally with: bun run android:version build|patch|minor|major\nversionName=${version.versionName}\nversionCode=${version.versionCode}\n`;
}
