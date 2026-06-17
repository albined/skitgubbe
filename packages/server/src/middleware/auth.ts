import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { JWT_SECRET } from '../utils/jwt.js';

export async function authMiddleware(c: Context, next: Next) {
	const token = getCookie(c, 'skitgubbe_session');
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
