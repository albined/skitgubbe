import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { bumpVersion, formatVersion, parseVersion } from './version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const android = join(root, 'packages/web/android');
const versionFile = join(android, 'version.properties');
const readVersion = () => parseVersion(readFileSync(versionFile, 'utf8'));

function capture(command, args, env = process.env) {
	const result = spawnSync(command, args, { env, encoding: 'utf8' });
	if (result.error || result.status !== 0) return null;
	return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
}

export function toolchain() {
	const candidates = process.env.JAVA_HOME
		? [process.env.JAVA_HOME]
		: [join(homedir(), '.jdks/temurin-21'), '/usr/lib/jvm/java-21-openjdk-amd64'];
	let javaHome = candidates.find((path) => existsSync(join(path, 'bin/java')));
	if (!javaHome && !process.env.JAVA_HOME) {
		const settings = capture('java', ['-XshowSettings:properties', '-version']);
		javaHome = settings?.match(/^\s*java.home = (.+)$/m)?.[1];
	}
	if (!javaHome) throw new Error('Java 21 not found. Set JAVA_HOME to a Linux JDK 21 directory.');
	const javaVersion = capture(join(javaHome, 'bin/java'), ['-version']);
	if (!/version "21[.\"]/.test(javaVersion ?? '') || !existsSync(join(javaHome, 'bin/javac'))) {
		throw new Error('Android builds require a Linux JDK 21. Correct JAVA_HOME for this command.');
	}
	const localFile = join(android, 'local.properties');
	const localSdk = existsSync(localFile)
		? readFileSync(localFile, 'utf8')
				.match(/^sdk\.dir\s*=\s*(.+)$/m)?.[1]
				?.trim()
				.replace(/\\(.)/g, '$1')
		: undefined;
	const envSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
	if (localSdk && envSdk && resolve(localSdk) !== resolve(envSdk)) {
		throw new Error(
			'SDK paths disagree. Align android/local.properties and ANDROID_HOME/ANDROID_SDK_ROOT.'
		);
	}
	const sdk = localSdk || envSdk || join(homedir(), '.android-sdk');
	for (const path of ['platforms/android-36/android.jar', 'build-tools/36.0.0/aapt2']) {
		if (!existsSync(join(sdk, path))) {
			throw new Error(
				`Android SDK component missing: ${join(sdk, path)}. Install platforms;android-36 and build-tools;36.0.0 with the Linux sdkmanager.`
			);
		}
	}
	if (!capture(join(sdk, 'build-tools/36.0.0/aapt2'), ['version'])) {
		throw new Error(
			'SDK build tools cannot run in Linux. Use a Linux Android SDK, not the Windows SDK.'
		);
	}
	return {
		javaHome,
		sdk,
		env: {
			...process.env,
			JAVA_HOME: javaHome,
			ANDROID_HOME: sdk,
			ANDROID_SDK_ROOT: sdk,
			PATH: [join(javaHome, 'bin'), join(sdk, 'platform-tools'), process.env.PATH].join(delimiter)
		}
	};
}

async function run(command, args, env, cwd = root) {
	const child = Bun.spawn([command, ...args], {
		cwd,
		env,
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit'
	});
	const status = await child.exited;
	if (status !== 0) throw new Error(`${command} exited with status ${status}.`);
}

const propertiesPath = (path) => path.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');

function setup(chain) {
	const keyFile = join(android, 'key.properties');
	if (!existsSync(keyFile)) {
		const template = readFileSync(join(android, 'key.properties.example'), 'utf8');
		writeFileSync(
			keyFile,
			template.replace(
				'/home/YOUR_USER/.local/share/skitgubbe-signing/skitgubbe-upload.p12',
				propertiesPath(join(homedir(), '.local/share/skitgubbe-signing/skitgubbe-upload.p12'))
			),
			{ flag: 'wx', mode: 0o600 }
		);
		console.log(`Created ${keyFile}. Fill in keyAlias, storePassword and keyPassword locally.`);
	} else console.log('Keeping existing key.properties.');
	const localFile = join(android, 'local.properties');
	if (!existsSync(localFile)) {
		writeFileSync(localFile, `sdk.dir=${propertiesPath(chain.sdk)}\n`, { flag: 'wx', mode: 0o600 });
	}
	console.log('Next: bun run android:doctor, then bun run android:bundle.');
}

function verifyManifest(version) {
	const manifestDir = join(
		android,
		'app/build/intermediates/merged_manifests/release/processReleaseManifest'
	);
	const metadata = JSON.parse(readFileSync(join(manifestDir, 'output-metadata.json'), 'utf8'));
	if (
		metadata.applicationId !== 'com.edegrangames.skitgubbe' ||
		metadata.elements.length !== 1 ||
		metadata.elements[0].versionCode !== version.versionCode ||
		metadata.elements[0].versionName !== version.versionName
	) {
		throw new Error('Built Android package/version does not match the requested release.');
	}
	const manifest = readFileSync(join(manifestDir, metadata.elements[0].outputFile), 'utf8');
	if (
		/android:debuggable="true"/.test(manifest) ||
		!/android:usesCleartextTraffic="false"/.test(manifest)
	) {
		throw new Error('Release manifest must disable debugging and cleartext traffic.');
	}
}

async function main() {
	const [action, ...args] = process.argv.slice(2);
	if (action === 'version') {
		if (args.length !== 1)
			throw new Error('Usage: bun run android:version build|patch|minor|major');
		const next = bumpVersion(readVersion(), args[0]);
		writeFileSync(versionFile, formatVersion(next));
		console.log(
			`Android version: ${next.versionName} (${next.versionCode}). Commit version.properties with your release changes.`
		);
		return;
	}
	if (
		!['setup', 'doctor', 'bundle', 'debug', 'gradle'].includes(action) ||
		(action !== 'gradle' && args.length)
	) {
		throw new Error(
			'Usage: bun tools/android/build.mjs setup|doctor|bundle|debug|version <bump>|gradle <tasks>'
		);
	}
	const chain = toolchain();
	console.log(`WSL/Linux build: Java ${chain.javaHome}; Android SDK ${chain.sdk}`);
	if (action === 'setup') return setup(chain);
	const version = readVersion();
	const gradle = (...tasks) => run('./gradlew', ['--console=plain', ...tasks], chain.env, android);
	if (action === 'gradle') {
		if (!args.length) throw new Error('Provide Gradle task names.');
		return gradle(...args);
	}
	if (action === 'doctor' || action === 'bundle') await gradle(':app:checkReleaseConfiguration');
	if (action === 'doctor') {
		console.log(
			'Local release configuration is ready. Server credentials and device notification delivery require separate verification.'
		);
		return;
	}
	const buildEnv =
		action === 'bundle'
			? { ...chain.env, NODE_ENV: 'production', PUBLIC_ALLOW_DEV_SETTINGS: 'false' }
			: chain.env;
	await run(process.execPath, ['run', 'mobile:sync'], buildEnv);
	if (action === 'debug') {
		await gradle(':app:assembleDebug');
		console.log(join(android, 'app/build/outputs/apk/debug/app-debug.apk'));
		return;
	}
	await gradle(':app:verifyReleaseBundle');
	verifyManifest(version);
	const output = join(
		root,
		'dist/android',
		`skitgubbe-${version.versionName}-${version.versionCode}.aab`
	);
	mkdirSync(dirname(output), { recursive: true });
	copyFileSync(join(android, 'app/build/outputs/bundle/release/app-release.aab'), output);
	console.log(`\nVerified bundle: ${output}`);
	const windowsPath = capture('wslpath', ['-w', output]);
	if (windowsPath) console.log(`Windows browser file picker: ${windowsPath}`);
	console.log(
		'Upload this .aab in Play Console → Testing → Internal testing. Rebuilding preserves the version.'
	);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(`Android build: ${error.message}`);
		process.exitCode = 1;
	});
}
