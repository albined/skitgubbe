import { describe, expect, test } from 'bun:test';
import { app } from '../src/index';

describe('GET /api/app-info', () => {
	test('returns the stable public compatibility contract', async () => {
		const response = await app.request('/api/app-info');
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('application/json');
		const body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({
			product: 'skitgubbe',
			api_version: 1
		});
		expect(typeof body.server_version).toBe('string');
		expect((body.server_version as string).length).toBeGreaterThan(0);
	});

	test('does not require a session cookie', async () => {
		const response = await app.request('/api/app-info');
		expect(response.status).toBe(200);
	});
});
