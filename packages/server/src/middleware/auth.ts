import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { JWT_SECRET } from '../utils/jwt.js';
import { getRequestSessionToken } from '../utils/session.js';

export async function authMiddleware(c: Context, next: Next) {
	const token = getRequestSessionToken(c);
	if (!token) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
	try {
		const payload = await verify(token, JWT_SECRET, 'HS256');
		c.set('profileId', payload.profileId as string);
		await next();
	} catch (e) {
		return c.json({ error: 'Unauthorized' }, 401);
	}
}
