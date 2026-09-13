import { SystemBars, SystemBarType } from '@capacitor/core';
import { isAndroidApp } from './runtime';

export async function hideGameStatusBar(): Promise<void> {
	if (!isAndroidApp()) return;
	try {
		await SystemBars.hide({ bar: SystemBarType.StatusBar });
	} catch (error) {
		console.warn('Failed to hide game status bar:', error);
	}
}

export async function showGameStatusBar(): Promise<void> {
	if (!isAndroidApp()) return;
	try {
		await SystemBars.show({ bar: SystemBarType.StatusBar });
	} catch (error) {
		console.warn('Failed to show game status bar:', error);
	}
}
