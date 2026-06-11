import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

export interface VapidKeys {
	publicKey: string;
	privateKey: string;
}

let keys: VapidKeys | null = null;

export function getVapidKeys(): VapidKeys {
	if (keys) return keys;

	// 1. Resolve from environment variables
	const envPub = process.env.VAPID_PUBLIC_KEY;
	const envPriv = process.env.VAPID_PRIVATE_KEY;
	if (envPub && envPriv) {
		const envKeys = { publicKey: envPub, privateKey: envPriv };
		keys = envKeys;
		return envKeys;
	}

	// 2. Resolve from a persistent file alongside database (to preserve in Docker volumes)
	const isTest = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
	const dbPath = process.env.DATABASE_PATH || (isTest ? ':memory:' : 'skitgubbe.db');
	
	let keysDir = '.';
	if (dbPath !== ':memory:') {
		keysDir = path.dirname(dbPath);
	}
	const keysPath = path.join(keysDir, 'vapid_keys.json');

	try {
		if (fs.existsSync(keysPath)) {
			const content = fs.readFileSync(keysPath, 'utf8');
			const parsed = JSON.parse(content);
			if (parsed && parsed.publicKey && parsed.privateKey) {
				const parsedKeys = parsed as VapidKeys;
				keys = parsedKeys;
				return parsedKeys;
			}
		}
	} catch (e) {
		console.warn('Warning: Failed to read VAPID keys from file:', e);
	}

	// 3. Fallback: generate and persist new VAPID keys
	console.warn(`VAPID keys not configured in environment. Generating persistent keys at: ${keysPath}`);
	const generated = webpush.generateVAPIDKeys();
	
	try {
		// Ensure the directory exists
		fs.mkdirSync(keysDir, { recursive: true });
		fs.writeFileSync(keysPath, JSON.stringify(generated, null, 2), 'utf8');
	} catch (e) {
		console.error('Error: Failed to save generated VAPID keys to file:', e);
	}

	keys = generated;
	return generated;
}

export function initWebPush() {
	const currentKeys = getVapidKeys();
	webpush.setVapidDetails(
		'mailto:admin@skitgubbe.app',
		currentKeys.publicKey,
		currentKeys.privateKey
	);
}
