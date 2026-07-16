import { Hono } from 'hono';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getVapidKeys } from '../vapid.js';

const pushApp = new Hono<{ Variables: { profileId: string } }>();

// GET dynamic VAPID public key for frontend subscriptions
pushApp.get('/vapid-public-key', (c) => {
	const keys = getVapidKeys();
	return c.json({ publicKey: keys.publicKey });
});

function isValidEndpoint(endpoint: string): boolean {
	if (endpoint.length > 1024) return false;
	try {
		const url = new URL(endpoint);
		if (url.protocol === 'https:') return true;
		if (url.protocol === 'http:') {
			return (
				url.hostname === 'localhost' ||
				url.hostname === '127.0.0.1' ||
				process.env.NODE_ENV !== 'production'
			);
		}
		return false;
	} catch {
		return false;
	}
}

// POST register a new push subscription
pushApp.post('/subscribe', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const sub = await c.req.json();
		if (
			!sub ||
			typeof sub.endpoint !== 'string' ||
			!isValidEndpoint(sub.endpoint) ||
			!sub.keys ||
			typeof sub.keys.p256dh !== 'string' ||
			typeof sub.keys.auth !== 'string'
		) {
			return c.json({ error: 'Invalid subscription payload' }, 400);
		}

		dbOps.addPushSubscription(profileId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to register subscription' }, 500);
	}
});

// POST unsubscribe a push subscription
pushApp.post('/unsubscribe', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { endpoint } = await c.req.json();
		if (typeof endpoint !== 'string' || !isValidEndpoint(endpoint)) {
			return c.json({ error: 'Endpoint is required and must be a valid URL string' }, 400);
		}
		dbOps.deletePushSubscription(endpoint, profileId);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to delete subscription' }, 500);
	}
});

export { pushApp };
