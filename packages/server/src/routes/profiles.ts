import { Hono } from 'hono';
import type { ApiAccessLog } from 'shared';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { JWT_SECRET } from '../utils/jwt.js';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { formatDeviceString, getIpLocation, isPrivateIp } from '../utils/ipAndDevice.js';
import { isNativeDebugHttpRequest } from '../utils/session.js';

const profilesApp = new Hono<{ Variables: { profileId: string } }>();

// List all profiles
profilesApp.get('/', (c) => {
	const profiles = dbOps.getAllProfiles();
	return c.json(profiles);
});

function generateProfileId(): string {
	for (let attempt = 0; attempt < 5; attempt++) {
		let id = '';
		while (id.length < 8) {
			id += Math.random().toString(36).substring(2);
		}
		const candidate = id.substring(0, 8).toUpperCase();
		if (!dbOps.getProfileById(candidate)) {
			return candidate;
		}
	}
	// Fallback
	let id = '';
	while (id.length < 8) {
		id += Math.random().toString(36).substring(2);
	}
	return id.substring(0, 8).toUpperCase();
}

// Create profile
profilesApp.post('/', async (c) => {
	try {
		const { name, color } = await c.req.json();
		if (!name || !color) {
			return c.json({ error: 'Name and color are required' }, 400);
		}
		const id = generateProfileId();
		const profile = dbOps.createProfile(id, name, color);
		return c.json(profile);
	} catch (e) {
		return c.json({ error: 'Failed to create profile' }, 500);
	}
});

// Select profile (login via JWT)
profilesApp.post('/:id/select', async (c) => {
	const id = c.req.param('id');
	const profile = dbOps.getProfileById(id);
	if (!profile) {
		return c.json({ error: 'Profile not found' }, 404);
	}
	// Sign JWT valid for 30 days
	const token = await sign(
		{
			profileId: profile.id,
			exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
		},
		JWT_SECRET,
		'HS256'
	);
	const androidClient = c.req.header('x-skitgubbe-platform') === 'android';
	const debugHttpClient = isNativeDebugHttpRequest(c);

	setCookie(c, 'skitgubbe_session', token, {
		httpOnly: true,
		secure: (androidClient && !debugHttpClient) || process.env.NODE_ENV === 'production',
		sameSite: androidClient && !debugHttpClient ? 'None' : 'Lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});

	// Log access
	const userAgent = c.req.header('user-agent') || 'Unknown Device';
	const ipAddress =
		c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'Unknown IP';

	getIpLocation(ipAddress)
		.then((location) => {
			dbOps.logProfileAccess(profile.id, userAgent, ipAddress, location);
		})
		.catch((err) => {
			console.error('Failed to log profile access location:', err);
			dbOps.logProfileAccess(profile.id, userAgent, ipAddress, 'Okänd plats');
		});

	return c.json({
		success: true,
		profile,
		...(debugHttpClient ? { debugSessionToken: token } : {})
	});
});

// Logout profile
profilesApp.post('/logout', (c) => {
	deleteCookie(c, 'skitgubbe_session', { path: '/' });
	return c.json({ success: true });
});

// Get current profile info
profilesApp.get('/me', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const profile = dbOps.getProfileById(profileId);
	if (!profile) {
		return c.json({ error: 'Profile not found' }, 404);
	}
	return c.json(profile);
});

// Get profile access logs
profilesApp.get('/me/logs', authMiddleware, (c) => {
	const profileId = c.get('profileId');
	const logs = dbOps.getProfileAccessLogs(profileId);

	const formattedLogs: ApiAccessLog[] = logs.map((log) => {
		const deviceDisplay = formatDeviceString(log.device_info || '');
		let locationDisplay = log.location;
		if (!locationDisplay) {
			if (log.ip_address && isPrivateIp(log.ip_address)) {
				locationDisplay = 'Lokalt nätverk';
			} else {
				locationDisplay = log.ip_address || 'Okänd plats';
			}
		}
		return {
			...log,
			device_display: deviceDisplay,
			location_display: locationDisplay
		};
	});

	return c.json(formattedLogs);
});

// Update profile
profilesApp.put('/me', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { name, color } = await c.req.json();
		if (!name || !color) {
			return c.json({ error: 'Name and color are required' }, 400);
		}
		dbOps.updateProfile(profileId, name, color);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to update profile' }, 500);
	}
});

// Update profile avatar
profilesApp.put('/me/avatar', authMiddleware, async (c) => {
	const profileId = c.get('profileId');
	try {
		const { avatar_config } = await c.req.json();
		if (avatar_config === undefined) {
			return c.json({ error: 'avatar_config is required' }, 400);
		}
		const configStr = JSON.stringify(avatar_config);
		if (configStr.length > 20000) {
			return c.json({ error: 'avatar_config payload too large' }, 400);
		}
		dbOps.updateProfileAvatar(profileId, configStr);
		return c.json({ success: true });
	} catch (e) {
		return c.json({ error: 'Failed to update avatar' }, 500);
	}
});

export { profilesApp };
