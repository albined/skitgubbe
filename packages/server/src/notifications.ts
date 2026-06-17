import webpush from 'web-push';
import { dbOps } from './db.js';

export async function sendTurnNotification(roomId: string, playerId: string, presetGameName?: string): Promise<void> {
	try {
		const subscriptions = dbOps.getPushSubscriptions(playerId);
		if (subscriptions.length === 0) return;

		const gameName = presetGameName || dbOps.getGame(roomId)?.name || roomId.toUpperCase();
		const payload = JSON.stringify({
			title: 'Skitgubbe',
			body: `Det är din tur i "${gameName}"!`,
			url: `/room/${roomId}`
		});

		for (const sub of subscriptions) {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth
						}
					},
					payload
				);
			} catch (err: any) {
				// Clean up expired or gone subscriptions
				if (err.statusCode === 410 || err.statusCode === 404) {
					dbOps.deletePushSubscription(sub.endpoint);
				} else {
					console.error('Failed to send push notification to endpoint:', sub.endpoint, err);
				}
			}
		}
	} catch (err) {
		console.error('Failed to execute sendTurnNotification:', err);
	}
}
