import { describe, test, expect, beforeEach, mock } from 'bun:test';

let mockIsNative = false;
let mockPlatform = 'web';
const hideCalls: any[] = [];
const showCalls: any[] = [];
let shouldThrow = false;

mock.module('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: () => mockIsNative,
		getPlatform: () => mockPlatform
	},
	SystemBars: {
		hide: async (opts: any) => {
			if (shouldThrow) throw new Error('Native error');
			hideCalls.push(opts);
		},
		show: async (opts: any) => {
			if (shouldThrow) throw new Error('Native error');
			showCalls.push(opts);
		}
	},
	SystemBarType: {
		StatusBar: 'StatusBar',
		NavigationBar: 'NavigationBar'
	}
}));

const { hideGameStatusBar, showGameStatusBar } = await import('../src/lib/platform/gameSystemBars');

describe('Android game route SystemBars control (gameSystemBars.ts)', () => {
	beforeEach(() => {
		mockIsNative = false;
		mockPlatform = 'web';
		hideCalls.length = 0;
		showCalls.length = 0;
		shouldThrow = false;
	});

	test('no-op when running in browser or non-Android environment', async () => {
		mockIsNative = false;
		mockPlatform = 'web';

		await hideGameStatusBar();
		await showGameStatusBar();

		expect(hideCalls.length).toBe(0);
		expect(showCalls.length).toBe(0);
	});

	test('no-op when running in iOS native environment', async () => {
		mockIsNative = true;
		mockPlatform = 'ios';

		await hideGameStatusBar();
		await showGameStatusBar();

		expect(hideCalls.length).toBe(0);
		expect(showCalls.length).toBe(0);
	});

	test('hides and shows only the status bar on Android', async () => {
		mockIsNative = true;
		mockPlatform = 'android';

		await hideGameStatusBar();
		expect(hideCalls).toEqual([{ bar: 'StatusBar' }]);

		await showGameStatusBar();
		expect(showCalls).toEqual([{ bar: 'StatusBar' }]);
	});

	test('catches native errors gracefully and does not throw', async () => {
		mockIsNative = true;
		mockPlatform = 'android';
		shouldThrow = true;

		await expect(hideGameStatusBar()).resolves.toBeUndefined();
		await expect(showGameStatusBar()).resolves.toBeUndefined();
	});
});
