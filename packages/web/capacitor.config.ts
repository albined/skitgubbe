import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.edegrangames.skitgubbe',
	appName: 'Skitgubbe',
	webDir: 'build-mobile',
	server: {
		hostname: 'localhost',
		androidScheme: 'https',
		cleartext: false
	},
	android: {
		allowMixedContent: false,
		webContentsDebuggingEnabled: false
	},
	plugins: {
		CapacitorCookies: {
			enabled: true
		},
		CapacitorHttp: {
			enabled: true
		},
		PushNotifications: {
			presentationOptions: ['badge', 'sound', 'alert']
		},
		SystemBars: {
			insetsHandling: 'css'
		}
	}
};

export default config;
