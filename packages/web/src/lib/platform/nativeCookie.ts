import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from './runtime';

interface NativeCookiePlugin {
	syncResponseCookie(options: { url: string; cookie: string }): Promise<void>;
}

const plugin = registerPlugin<NativeCookiePlugin>('NativeCookie');

/** Wait until Android's WebView cookie jar has committed a native HTTP response cookie. */
export async function syncNativeResponseCookie(url: string, cookie?: string): Promise<void> {
	if (!isAndroidApp() || !cookie) return;
	await plugin.syncResponseCookie({ url, cookie });
}
