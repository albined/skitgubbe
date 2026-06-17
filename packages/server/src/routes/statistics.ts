import { Hono } from 'hono';
import { dbOps } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const statisticsApp = new Hono<{ Variables: { profileId: string } }>();

// Get the current global skitgubbe
statisticsApp.get('/api/skitgubbe/current', authMiddleware, (c) => {
	const current = dbOps.getCurrentGlobalSkitgubbe();
	return c.json(current);
});

// Get the skitgubbe coronation history log
statisticsApp.get('/api/skitgubbe/history', authMiddleware, (c) => {
	const history = dbOps.getSkitgubbeHistory();
	return c.json(history);
});

// Get all players statistics
statisticsApp.get('/api/statistics', authMiddleware, (c) => {
	const stats = dbOps.getAllPlayerStats();
	return c.json(stats);
});

// Get detailed stats breakdown for a player
statisticsApp.get('/api/statistics/:profileId', authMiddleware, (c) => {
	const profileId = c.req.param('profileId')!;
	const stats = dbOps.getPlayerStatsBreakdown(profileId);
	return c.json(stats);
});

export { statisticsApp };
