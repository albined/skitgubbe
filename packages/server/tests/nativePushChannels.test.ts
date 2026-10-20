import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';

const channels: Array<string | undefined> = [];
mock.module('firebase-admin/app', () => ({
	applicationDefault: () => ({}),
	getApps: () => [{}],
	initializeApp: () => ({})
}));
mock.module('firebase-admin/messaging', () => ({
	getMessaging: () => ({
		sendEachForMulticast: async (message: {
			tokens: string[];
			android?: { notification?: { channelId?: string } };
		}) => {
			channels.push(message.android?.notification?.channelId);
			return { responses: message.tokens.map(() => ({ success: true })) };
		}
	})
}));
mock.module('web-push', () => ({
	default: {
		sendNotification: async () => {},
		setVapidDetails: () => {},
		generateVAPIDKeys: () => ({ publicKey: 'test', privateKey: 'test' })
	}
}));

import { dbOps } from '../src/db.js';
import {
	sendGameEndedNotification,
	sendInviteNotification,
	sendNudgeNotification,
	sendTurnNotification
} from '../src/notifications.js';

describe('native push channels', () => {
	const profileId = `channels_${crypto.randomUUID()}`;
	const installationId = crypto.randomUUID();
	const previousProjectId = process.env.FIREBASE_PROJECT_ID;

	beforeAll(() => {
		process.env.FIREBASE_PROJECT_ID = 'test-project';
		dbOps.createProfile(profileId, 'Kanal', '#123456');
		dbOps.upsertNativePushRegistration(profileId, installationId, `fcm:${'c'.repeat(64)}`);
	});

	afterAll(() => {
		if (previousProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
		else process.env.FIREBASE_PROJECT_ID = previousProjectId;
		dbOps.deleteNativePushRegistration(installationId);
		dbOps.deleteProfile(profileId);
	});

	test('tags each kind of notification with its Android channel', async () => {
		await sendInviteNotification('channels-room', profileId, profileId);
		await sendTurnNotification('channels-room', profileId);
		await sendNudgeNotification('channels-room', profileId, 'Albin');
		await sendGameEndedNotification('channels-room', [profileId], null);

		expect(channels).toEqual(['invites', 'turns', 'turns', 'game-ended']);
	});
});
