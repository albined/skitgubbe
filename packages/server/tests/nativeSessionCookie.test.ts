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

	test('uses a development token and non-Secure cookie for Android debug HTTP', async () => {
		const response = await app.request(`/api/profiles/${profileId}/select`, {
			method: 'POST',
			headers: {
				'X-Skitgubbe-Platform': 'android',
				'X-Skitgubbe-Debug-Http': '1'
			}
		});
		const cookie = response.headers.get('set-cookie') ?? '';
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).not.toContain('Secure');

		const body = await response.json();
		expect(typeof body.debugSessionToken).toBe('string');

		const rejectedWithoutDebugHeader = await app.request('/api/profiles/me', {
			headers: { Authorization: `Bearer ${body.debugSessionToken}` }
		});
		expect(rejectedWithoutDebugHeader.status).toBe(401);

		const authenticated = await app.request('/api/profiles/me', {
			headers: {
				'X-Skitgubbe-Platform': 'android',
				'X-Skitgubbe-Debug-Http': '1',
				Authorization: `Bearer ${body.debugSessionToken}`
			}
		});
		expect(authenticated.status).toBe(200);
		expect((await authenticated.json()).id).toBe(profileId);
	});
});
