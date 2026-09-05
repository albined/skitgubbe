import {
	applicationDefault,
	getApps,
	initializeApp,
	type App as FirebaseApp
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { dbOps } from './db.js';

export interface NativePushPayload {
	title: string;
	body: string;
	url: string;
}

let firebaseApp: FirebaseApp | null | undefined;
let warnedMissingConfiguration = false;

function getFirebaseApp(): FirebaseApp | null {
	if (firebaseApp !== undefined) return firebaseApp;
	if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_PROJECT_ID) {
		firebaseApp = null;
		return null;
	}

	try {
		firebaseApp =
			getApps()[0] ??
			initializeApp({
				credential: applicationDefault(),
				...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {})
			});
		return firebaseApp;
	} catch (error) {
		console.error('Failed to initialize Firebase Admin:', error);
		firebaseApp = null;
		return null;
	}
}

function isDeadTokenError(code: string | undefined): boolean {
	return (
		code === 'messaging/registration-token-not-registered' ||
		code === 'messaging/invalid-registration-token'
	);
}

interface NativePushSendResult {
	success: boolean;
	error?: { code?: string } | null;
}

export function processNativePushResponses(
	tokens: readonly string[],
	responses: readonly NativePushSendResult[]
): void {
	responses.forEach((result, index) => {
		const token = tokens[index];
		if (!token) return;
		if (isDeadTokenError(result.error?.code)) {
			dbOps.deleteNativePushRegistrationByToken(token);
		} else if (!result.success) {
			console.error('Failed to send native push notification:', result.error);
		}
	});
}

export async function sendNativePushNotification(
	profileId: string,
	payload: NativePushPayload
): Promise<void> {
	const registrations = dbOps.getNativePushRegistrations(profileId);
	if (registrations.length === 0) return;
	const app = getFirebaseApp();
	if (!app) {
		if (!warnedMissingConfiguration) {
			warnedMissingConfiguration = true;
			console.warn(
				'Native push registrations exist, but Firebase Admin credentials are not configured.'
			);
		}
		return;
	}

	for (let offset = 0; offset < registrations.length; offset += 500) {
		const batch = registrations.slice(offset, offset + 500);
		try {
			const response = await getMessaging(app).sendEachForMulticast({
				tokens: batch.map((registration) => registration.token),
				notification: { title: payload.title, body: payload.body },
				data: { route: payload.url },
				android: {
					priority: 'high',
					notification: {
						channelId: 'game-updates',
						tag: payload.url
					}
				}
			});
			processNativePushResponses(
				batch.map((registration) => registration.token),
				response.responses
			);
		} catch (error) {
			console.error('Failed to send native push notification batch:', error);
		}
	}
}
