import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { dbOps } from '../src/db.js';
import { app } from '../src/index.js';

describe('session cookie platform policy', () => {
	const profileId = `cookie_${crypto.randomUUID()}`;

	beforeAll(() => {
		dbOps.createProfile(profileId, 'Cookie Test', '#123456');
	});

	afterAll(() => {
		dbOps.deleteProfile(profileId);
	});

	test('keeps the existing browser cookie SameSite=Lax', async () => {
		const response = await app.request(`/api/profiles/${profileId}/select`, { method: 'POST' });
		const cookie = response.headers.get('set-cookie') ?? '';
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).not.toContain('SameSite=None');
	});

	test('makes only the Android cookie usable by cross-site WebView WSS', async () => {
		const response = await app.request(`/api/profiles/${profileId}/select`, {
			method: 'POST',
			headers: { 'X-Skitgubbe-Platform': 'android' }
		});
		const cookie = response.headers.get('set-cookie') ?? '';
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain('SameSite=None');
	});
});
