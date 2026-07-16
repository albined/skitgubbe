export interface ParsedAgent {
	os: string;
	browser: string;
	device: string;
}

export function isValidIp(ip: string): boolean {
	if (!ip) return false;
	const firstIp = ip.split(',')[0].trim();

	// For IPv4: split by `.`, check length is 4, all are numbers between 0 and 255.
	const ipv4Parts = firstIp.split('.');
	if (ipv4Parts.length === 4) {
		const allValidIpv4 = ipv4Parts.every((part) => {
			if (!part || !/^\d+$/.test(part)) return false;
			const num = Number(part);
			return num >= 0 && num <= 255;
		});
		if (allValidIpv4) return true;
	}

	// For IPv6: check it only contains hex digits and colons, length is at most 45, and it contains at least one `:`.
	if (firstIp.length <= 45 && firstIp.includes(':')) {
		if (/^[0-9a-fA-F:]+$/.test(firstIp)) {
			return true;
		}
	}

	return false;
}

export function isPrivateIp(ip: string): boolean {
	if (!ip) return true;
	const firstIp = ip.split(',')[0].trim();

	if (firstIp === '127.0.0.1' || firstIp === '::1' || firstIp.toLowerCase() === 'localhost')
		return true;

	const parts = firstIp.split('.').map(Number);
	if (parts.length === 4 && !parts.some(isNaN)) {
		if (parts[0] === 10) return true;
		if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
		if (parts[0] === 192 && parts[1] === 168) return true;
	}

	const lower = firstIp.toLowerCase();
	if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
		return true;
	}

	return false;
}

export async function getIpLocation(ip: string): Promise<string> {
	if (!ip || ip === 'Unknown IP') return 'Okänd plats';
	const firstIp = ip.split(',')[0].trim();
	if (!isValidIp(firstIp)) {
		return 'Okänd plats';
	}
	if (isPrivateIp(firstIp)) {
		return 'Lokalt nätverk';
	}
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);

		const res = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(firstIp)}`, {
			signal: controller.signal
		});
		clearTimeout(timeoutId);

		if (res.ok) {
			const data = (await res.json()) as any;
			const city = data.cityName;
			const country = data.countryName;
			const countryCode = data.countryCode;

			if (city && city !== '-' && city !== 'Unknown') {
				return `${city} (${countryCode || country})`;
			} else if (country && country !== '-' && country !== 'Unknown') {
				return country;
			}
		}
	} catch (e) {
		console.error(`Failed to geolocate IP ${firstIp}:`, e);
	}
	return 'Okänd plats';
}

export function parseUserAgent(ua: string): ParsedAgent {
	if (!ua) {
		return { os: 'Okänd', browser: 'Okänd', device: 'Okänd' };
	}

	let os = 'Okänd OS';
	let browser = 'Okänd webbläsare';
	let device = 'Dator';

	const uaLower = ua.toLowerCase();

	if (uaLower.includes('iphone')) {
		device = 'iPhone';
		os = 'iOS';
	} else if (uaLower.includes('ipad')) {
		device = 'iPad';
		os = 'iOS';
	} else if (uaLower.includes('android')) {
		device = 'Android';
		os = 'Android';

		const androidMatch = ua.match(/\(([^)]+)\)/);
		if (androidMatch && androidMatch[1]) {
			const tokens = androidMatch[1].split(';').map((t) => t.trim());
			const modelToken = tokens.find((token) => {
				const lowerToken = token.toLowerCase();
				return (
					!lowerToken.includes('linux') &&
					!lowerToken.includes('android') &&
					lowerToken !== 'k' &&
					lowerToken !== 'wv' &&
					!lowerToken.includes('build/')
				);
			});
			if (modelToken) {
				device = modelToken;
			}
		}
	} else if (uaLower.includes('macintosh') || uaLower.includes('mac os x')) {
		os = 'macOS';
		device = 'Mac';
	} else if (uaLower.includes('windows nt')) {
		os = 'Windows';
		device = 'Windows Dator';
	} else if (uaLower.includes('linux')) {
		os = 'Linux';
		device = 'Linux Dator';
	}

	if (uaLower.includes('edg/')) {
		browser = 'Edge';
	} else if (uaLower.includes('opr/') || uaLower.includes('opera')) {
		browser = 'Opera';
	} else if (uaLower.includes('chrome') || uaLower.includes('crios')) {
		browser = 'Chrome';
	} else if (uaLower.includes('firefox') || uaLower.includes('fxios')) {
		browser = 'Firefox';
	} else if (uaLower.includes('safari')) {
		browser = 'Safari';
	}

	return { os, browser, device };
}

export function formatDeviceString(ua: string): string {
	const parsed = parseUserAgent(ua);
	if (parsed.os === 'Okänd' && parsed.browser === 'Okänd') {
		return ua || 'Okänd enhet';
	}

	let osName = parsed.os;
	let browserName = parsed.browser;
	let deviceName = parsed.device;

	if (deviceName === 'Windows Dator') deviceName = 'Windows-dator';
	if (deviceName === 'Linux Dator') deviceName = 'Linux-dator';

	if (deviceName === 'iPhone' || deviceName === 'iPad' || deviceName === 'Mac') {
		return `${deviceName} (${browserName})`;
	}

	if (deviceName === 'Android') {
		return `Android-enhet (${browserName})`;
	}

	if (
		parsed.device !== 'Dator' &&
		parsed.device !== 'Windows Dator' &&
		parsed.device !== 'Linux Dator'
	) {
		return `${deviceName} (${browserName} på ${osName})`;
	}

	return `${deviceName} (${browserName})`;
}
