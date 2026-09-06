// Integration tests use an isolated Gradle project and a disposable key, never local credentials.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolchain } from './build.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = mkdtempSync(join(tmpdir(), 'skitgubbe-release-test-'));
const chain = toolchain();
const env = { ...chain.env, SKITGUBBE_TEST_KEY_PASSWORD: crypto.randomUUID() };

async function command(executable, args) {
	const child = Bun.spawn([executable, ...args], {
		cwd: fixture,
		env,
		stdout: 'pipe',
		stderr: 'pipe'
	});
	const [stdout, stderr, status] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited
	]);
	return { status, output: stdout + stderr };
}

async function checked(executable, args) {
	const result = await command(executable, args);
	assert.equal(result.status, 0, result.output);
}

async function gradle(label, task, expectedError) {
	const result = await command(join(root, 'packages/web/android/gradlew'), [
		'--offline',
		'--console=plain',
		'-p',
		fixture,
		task
	]);
	if (expectedError) {
		assert.notEqual(result.status, 0, `${label}: unexpectedly succeeded`);
		assert.ok(result.output.includes(expectedError), `${label}: ${result.output}`);
	} else assert.equal(result.status, 0, `${label}: ${result.output}`);
	assert.ok(
		!result.output.includes(env.SKITGUBBE_TEST_KEY_PASSWORD),
		'Credential leaked into Gradle output'
	);
	console.log(`PASS: ${label}`);
}

const servicesFile = join(fixture, 'app/google-services.json');
const services = {
	project_info: { project_id: 'skitgubbe-cab56', project_number: '123' },
	client: [
		{
			client_info: {
				android_client_info: { package_name: 'com.edegrangames.skitgubbe' },
				mobilesdk_app_id: 'test-app'
			},
			api_key: [{ current_key: 'test-key' }]
		}
	]
};
const keyProperties = (alias = 'upload') =>
	[
		'storeFile=upload.p12',
		'storeType=PKCS12',
		`keyAlias=${alias}`,
		`storePassword=${env.SKITGUBBE_TEST_KEY_PASSWORD}`,
		`keyPassword=${env.SKITGUBBE_TEST_KEY_PASSWORD}`,
		''
	].join('\n');
const versionFile = join(fixture, 'version.properties');
const keyFile = join(fixture, 'key.properties');
const bundle = join(fixture, 'build/outputs/bundle/release/app-release.aab');

try {
	mkdirSync(join(fixture, 'app'));
	writeFileSync(join(fixture, 'settings.gradle'), "rootProject.name = 'release-guard-test'\n");
	writeFileSync(
		join(fixture, 'build.gradle'),
		`apply from: ${JSON.stringify(join(root, 'packages/web/android/release-config.gradle'))}\ntasks.register('bundleRelease') { dependsOn('checkReleaseConfiguration') }\n`
	);
	writeFileSync(versionFile, 'versionName=0.1.0\nversionCode=1\n');
	writeFileSync(servicesFile, JSON.stringify(services));
	await gradle(
		'missing signing file fails clearly',
		'checkReleaseConfiguration',
		'Missing: storeFile'
	);
	writeFileSync(keyFile, 'storeFile=upload.p12\n', { mode: 0o600 });
	await gradle(
		'partial signing config fails clearly',
		'checkReleaseConfiguration',
		'Missing: storePassword'
	);
	await checked(join(chain.javaHome, 'bin/keytool'), [
		'-genkeypair',
		'-keystore',
		'upload.p12',
		'-storetype',
		'PKCS12',
		'-alias',
		'upload',
		'-keyalg',
		'RSA',
		'-keysize',
		'2048',
		'-validity',
		'2',
		'-dname',
		'CN=Disposable Build Test',
		'-storepass:env',
		'SKITGUBBE_TEST_KEY_PASSWORD',
		'-keypass:env',
		'SKITGUBBE_TEST_KEY_PASSWORD'
	]);
	writeFileSync(keyFile, keyProperties('wrong-alias'));
	await gradle(
		'wrong key alias fails without disclosing credentials',
		'checkReleaseConfiguration',
		'Cannot unlock upload key'
	);
	writeFileSync(keyFile, keyProperties());
	services.project_info.project_id = 'different-project';
	writeFileSync(servicesFile, JSON.stringify(services));
	await gradle(
		'wrong Firebase project is rejected',
		'checkReleaseConfiguration',
		'Firebase config must contain'
	);
	services.project_info.project_id = 'skitgubbe-cab56';
	services.client[0].client_info.android_client_info.package_name = 'com.example.wrong';
	writeFileSync(servicesFile, JSON.stringify(services));
	await gradle(
		'wrong Android package is rejected',
		'checkReleaseConfiguration',
		'Firebase config must contain'
	);
	rmSync(servicesFile);
	await gradle(
		'missing Firebase config is rejected',
		'checkReleaseConfiguration',
		'Release requires'
	);
	services.client[0].client_info.android_client_info.package_name = 'com.edegrangames.skitgubbe';
	writeFileSync(servicesFile, JSON.stringify(services));
	writeFileSync(versionFile, 'versionName=0.1.0\nversionCode=2100000001\n');
	await gradle(
		'Gradle enforces Play version-code limit',
		'checkReleaseConfiguration',
		'versionCode must be an integer'
	);
	writeFileSync(versionFile, 'versionName=0.1.0\nversionCode=1\n');
	await gradle('complete local configuration succeeds', 'checkReleaseConfiguration');
	mkdirSync(dirname(bundle), { recursive: true });
	writeFileSync(join(fixture, 'payload.txt'), 'Disposable signature verification payload');
	await checked(join(chain.javaHome, 'bin/jar'), ['--create', '--file', bundle, 'payload.txt']);
	await gradle(
		'unsigned bundle is rejected',
		'verifyReleaseBundle',
		'not signed by the configured upload certificate'
	);
	await checked(join(chain.javaHome, 'bin/jarsigner'), [
		'-keystore',
		'upload.p12',
		'-storepass:env',
		'SKITGUBBE_TEST_KEY_PASSWORD',
		bundle,
		'upload'
	]);
	await gradle('signed bundle verifies against the upload certificate', 'verifyReleaseBundle');
} finally {
	rmSync(fixture, { recursive: true, force: true });
}
