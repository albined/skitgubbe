import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { JWT_SECRET } from '../utils/jwt.js';
import { getRequestSessionToken } from '../utils/session.js';
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

function isValidInstallationId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length >= 16 &&
		value.length <= 128 &&
		/^[A-Za-z0-9._:-]+$/.test(value)
	);
}

function isValidFcmToken(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length >= 20 &&
		value.length <= 4096 &&
		!/[\s\u0000-\u001f]/.test(value)
	);
}

function isValidInstallationSecret(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length >= 16 &&
		value.length <= 128 &&
		/^[A-Za-z0-9._:-]+$/.test(value)
	);
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

// Register or move this Android installation to the currently selected profile.
pushApp.post('/native/register', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const body = await c.req.json();
		if (!isValidInstallationId(body?.installationId) || !isValidFcmToken(body?.token)) {
			return c.json({ error: 'Invalid native push registration payload' }, 400);
		}
		const secret = isValidInstallationSecret(body?.secret) ? body.secret : undefined;
		dbOps.upsertNativePushRegistration(profileId, body.installationId, body.token, secret);
		return c.json({ success: true });
	} catch {
		return c.json({ error: 'Failed to register native notifications' }, 500);
	}
});

// A caller may detach via installation secret or from its authenticated profile session.
pushApp.post('/native/unregister', async (c) => {
	try {
		const body = await c.req.json();
		if (!isValidInstallationId(body?.installationId)) {
			return c.json({ error: 'Invalid installation ID' }, 400);
		}
		if (isValidInstallationSecret(body?.secret)) {
			const deleted = dbOps.deleteNativePushRegistrationWithSecret(
				body.installationId,
				body.secret
			);
			if (deleted) {
				return c.json({ success: true });
			}
		}
		const token = getRequestSessionToken(c);
		if (token) {
			try {
				const payload = await verify(token, JWT_SECRET, 'HS256');
				const profileId = payload.profileId as string;
				dbOps.deleteNativePushRegistration(body.installationId, profileId);
				return c.json({ success: true });
			} catch {
				// Invalid session token, fall through to 401
			}
		}
		return c.json({ error: 'Unauthorized' }, 401);
	} catch {
		return c.json({ error: 'Failed to unregister native notifications' }, 500);
	}
});

export { pushApp };
