import { App } from '@capacitor/app';
import { isNativeApp } from './runtime';

export async function installNativeLifecycle(): Promise<() => Promise<void>> {
	if (!isNativeApp()) return async () => {};
	const listener = await App.addListener('appStateChange', ({ isActive }) => {
		if (isActive) window.dispatchEvent(new CustomEvent('skitgubbe:native-resume'));
	});
	return async () => listener.remove();
}
