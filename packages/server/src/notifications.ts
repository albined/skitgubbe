import webpush from 'web-push';
import { dbOps } from './db.js';

async function sendPushNotification(playerId: string, payload: any): Promise<void> {
	try {
		const subscriptions = dbOps.getPushSubscriptions(playerId);
		if (subscriptions.length === 0) return;

		const payloadStr = JSON.stringify(payload);

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
					payloadStr
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
		console.error('Failed to execute sendPushNotification:', err);
	}
}

export async function sendTurnNotification(
	roomId: string,
	playerId: string,
	presetGameName?: string
): Promise<void> {
	try {
		const gameName = presetGameName || dbOps.getGame(roomId)?.name || roomId.toUpperCase();
		await sendPushNotification(playerId, {
			title: 'Skitgubbe',
			body: `Det är din tur i "${gameName}"!`,
			url: `/room/${roomId}`
		});
	} catch (err) {
		console.error('Failed to execute sendTurnNotification:', err);
	}
}

export async function sendInviteNotification(
	roomId: string,
	hostProfileId: string,
	inviteeId: string,
	presetGameName?: string
): Promise<void> {
	try {
		const gameName = presetGameName || dbOps.getGame(roomId)?.name || roomId.toUpperCase();
		const hostProfile = dbOps.getProfileById(hostProfileId);
		const hostName = hostProfile?.name || 'Någon';

		await sendPushNotification(inviteeId, {
			title: 'Skitgubbe',
			body: `${hostName} har bjudit in dig till "${gameName}"!`,
			url: `/`
		});
	} catch (err) {
		console.error('Failed to execute sendInviteNotification:', err);
	}
}
