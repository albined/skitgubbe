import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

export function isAndroidApp(): boolean {
	return isNativeApp() && Capacitor.getPlatform() === 'android';
}
