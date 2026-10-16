// SQLite's CURRENT_TIMESTAMP is UTC without a zone ("2026-10-13 18:12:00").
export function parseTimestamp(timestamp: string): Date {
	if (!timestamp.includes('Z') && !timestamp.includes('+') && !timestamp.includes('T')) {
		return new Date(timestamp.replace(' ', 'T') + 'Z');
	}
	return new Date(timestamp);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function startOfDay(d: Date): number {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between the date and today, in local time. */
export function daysAgo(timestamp: string, now = new Date()): number {
	return Math.round((startOfDay(now) - startOfDay(parseTimestamp(timestamp))) / 86_400_000);
}

export function timeAgo(timestamp: string): string {
	if (!timestamp) return '';
	const seconds = Math.floor((Date.now() - parseTimestamp(timestamp).getTime()) / 1000);
	let interval = Math.floor(seconds / 31536000);
	if (interval >= 1) return interval + ' år sedan';
	interval = Math.floor(seconds / 2592000);
	if (interval >= 1) return interval + ' mån sedan';
	interval = Math.floor(seconds / 86400);
	if (interval >= 1) return interval + (interval === 1 ? ' dag sedan' : ' dagar sedan');
	interval = Math.floor(seconds / 3600);
	if (interval >= 1) return interval + ' tim sedan';
	interval = Math.floor(seconds / 60);
	if (interval >= 1) return interval + ' min sedan';
	return 'just nu';
}

/** "13 okt", or "13 okt 2025" outside the current year. */
export function shortDate(timestamp: string, now = new Date()): string {
	if (!timestamp) return '';
	const d = parseTimestamp(timestamp);
	const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
	return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`;
}

/** "Idag", "Igår" or the short date. */
export function dayLabel(timestamp: string, now = new Date()): string {
	const days = daysAgo(timestamp, now);
	if (days === 0) return 'Idag';
	if (days === 1) return 'Igår';
	return shortDate(timestamp, now);
}

export function clockTime(timestamp: string): string {
	const d = parseTimestamp(timestamp);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
