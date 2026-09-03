import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { app } from '../src/index.js';
import { dbOps } from '../src/db.js';
import { processNativePushResponses } from '../src/nativePush.js';

describe('native push registrations', () => {
	const firstProfile = `native_a_${crypto.randomUUID()}`;
	const secondProfile = `native_b_${crypto.randomUUID()}`;
	const installationId = crypto.randomUUID();
	const token = `fcm:${'a'.repeat(64)}`;
	let firstCookie = '';
	let secondCookie = '';

	beforeAll(async () => {
		dbOps.createProfile(firstProfile, 'Native A', '#111111');
		dbOps.createProfile(secondProfile, 'Native B', '#222222');
		firstCookie =
			(await app.request(`/api/profiles/${firstProfile}/select`, { method: 'POST' })).headers.get(
				'set-cookie'
			) ?? '';
		secondCookie =
			(await app.request(`/api/profiles/${secondProfile}/select`, { method: 'POST' })).headers.get(
				'set-cookie'
			) ?? '';
	});

	afterAll(() => {
		dbOps.deleteNativePushRegistration(installationId);
		dbOps.deleteProfile(firstProfile);
		dbOps.deleteProfile(secondProfile);
	});

	test('requires authentication and validates payloads', async () => {
		const unauthenticated = await app.request('/api/push/native/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ installationId, token })
		});
		expect(unauthenticated.status).toBe(401);

		const invalid = await app.request('/api/push/native/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: firstCookie },
			body: JSON.stringify({ installationId: '../bad', token: 'short' })
		});
		expect(invalid.status).toBe(400);
	});

	test('upserts one installation and moves it between profiles', async () => {
		for (const cookie of [firstCookie, secondCookie]) {
			const response = await app.request('/api/push/native/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ installationId, token })
			});
			expect(response.status).toBe(200);
		}

		expect(dbOps.getNativePushRegistrations(firstProfile)).toHaveLength(0);
		const registrations = dbOps.getNativePushRegistrations(secondProfile);
		expect(registrations).toHaveLength(1);
		expect(registrations[0].token).toBe(token);
	});

	test('cannot unregister an installation belonging to another profile', async () => {
		await app.request('/api/push/native/unregister', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: firstCookie },
			body: JSON.stringify({ installationId })
		});
		expect(dbOps.getNativePushRegistrations(secondProfile)).toHaveLength(1);

		const response = await app.request('/api/push/native/unregister', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: secondCookie },
			body: JSON.stringify({ installationId })
		});
		expect(response.status).toBe(200);
		expect(dbOps.getNativePushRegistrations(secondProfile)).toHaveLength(0);
	});

	test('prunes tokens that FCM reports as permanently dead', () => {
		const deadInstallation = crypto.randomUUID();
		const deadToken = `dead:${'z'.repeat(64)}`;
		dbOps.upsertNativePushRegistration(secondProfile, deadInstallation, deadToken);

		processNativePushResponses(
			[deadToken],
			[
				{
					success: false,
					error: { code: 'messaging/registration-token-not-registered' }
				}
			]
		);

		expect(dbOps.getNativePushRegistrations(secondProfile)).toHaveLength(0);
	});
});
