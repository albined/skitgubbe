import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function getJwtSecret(): string {
	if (process.env.JWT_SECRET) {
		return process.env.JWT_SECRET;
	}

	// Try loading from database directory (persistent keys in Docker volume)
	const isTest = process.env.NODE_ENV === 'test' || process.env.BUN_ENV === 'test';
	const dbPath = process.env.DATABASE_PATH || (isTest ? ':memory:' : 'skitgubbe.db');

	// Do not persist secret to disk during tests or memory-only mode
	if (isTest || dbPath === ':memory:') {
		return crypto.randomBytes(32).toString('hex');
	}

	const keysDir = path.dirname(dbPath);
	const secretPath = path.join(keysDir, 'jwt_secret.txt');

	try {
		if (fs.existsSync(secretPath)) {
			const content = fs.readFileSync(secretPath, 'utf8').trim();
			if (content) return content;
		}
	} catch (e) {
		console.warn('Warning: Failed to read persistent JWT secret from file:', e);
	}

	// Fallback: generate and persist new secret
	console.warn(`JWT_SECRET not set in environment. Generating persistent secret at: ${secretPath}`);
	const generated = crypto.randomBytes(32).toString('hex');
	try {
		fs.mkdirSync(keysDir, { recursive: true });
		fs.writeFileSync(secretPath, generated, 'utf8');
	} catch (e) {
		console.error('Error: Failed to save generated JWT secret to file:', e);
	}

	return generated;
}

export const JWT_SECRET = getJwtSecret();
