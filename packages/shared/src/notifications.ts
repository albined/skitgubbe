// Android notification channels. The server tags each push with one and the app
// creates them, so players switch each kind on or off in Android's settings.
export type NotificationChannel = 'invites' | 'turns' | 'game-ended';
