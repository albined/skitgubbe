export const GRID_HUES = [10, 45, 120, 190, 240, 300];
export const GRID_LIGHTNESSES = [92, 80, 68, 55, 42, 25];
export const SATURATION_PRESETS = [100, 85, 70, 55, 40, 25, 12, 0];

export function snapHue(h: number): number {
	return GRID_HUES.reduce((prev, curr) => (Math.abs(curr - h) < Math.abs(prev - h) ? curr : prev));
}

export function snapLightness(l: number): number {
	return GRID_LIGHTNESSES.reduce((prev, curr) =>
		Math.abs(curr - l) < Math.abs(prev - l) ? curr : prev
	);
}

export function snapSaturation(s: number): number {
	return SATURATION_PRESETS.reduce((prev, curr) =>
		Math.abs(curr - s) < Math.abs(prev - s) ? curr : prev
	);
}

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
	hex = hex.replace(/^#/, '');
	if (hex.length === 3) {
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	}
	const r = parseInt(hex.substring(0, 2), 16) / 255;
	const g = parseInt(hex.substring(2, 4), 16) / 255;
	const b = parseInt(hex.substring(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100)
	};
}

export function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	const rHex = Math.round((r + m) * 255)
		.toString(16)
		.padStart(2, '0');
	const gHex = Math.round((g + m) * 255)
		.toString(16)
		.padStart(2, '0');
	const bHex = Math.round((b + m) * 255)
		.toString(16)
		.padStart(2, '0');

	return `#${rHex}${gHex}${bHex}`.toUpperCase();
}
