import { Capacitor } from '@capacitor/core';

export function isNativeApp(): boolean {
	return Capacitor.isNativePlatform();
}

export function isAndroidApp(): boolean {
	return isNativeApp() && Capacitor.getPlatform() === 'android';
}

/** Runtime build flag supplied by Capacitor from Android's debuggable application flag. */
export function isNativeDebugBuild(): boolean {
	return isAndroidApp() && Capacitor.DEBUG === true;
}
