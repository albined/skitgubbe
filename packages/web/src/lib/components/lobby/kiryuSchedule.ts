const DAILY_VISIT_KEY = 'skitgubbe_kiryu_daily_visit_v1';
type VisitStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isKiryuEvening(date = new Date()): boolean {
	return date.getHours() >= 19 && date.getHours() < 23;
}

export function createKiryuSchedule(
	storage: () => VisitStorage = () => window.localStorage,
	random: () => number = Math.random
) {
	let cachedDay = '';
	let visiting = false;
	return (date = new Date()): boolean => {
		if (!isKiryuEvening(date)) return false;
		const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
		if (day === cachedDay) return visiting;
		cachedDay = day;
		try {
			const saved = JSON.parse(storage().getItem(DAILY_VISIT_KEY) ?? 'null');
			if (saved?.day === day && typeof saved.visiting === 'boolean') {
				visiting = saved.visiting;
				return visiting;
			}
		} catch {
			// Unavailable or malformed storage must not prevent the lobby loading.
		}
		visiting = random() < 0.5;
		try {
			storage().setItem(DAILY_VISIT_KEY, JSON.stringify({ day, visiting }));
		} catch {
			// Keep the decision in memory for this session if storage is blocked.
		}
		return visiting;
	};
}

export const isKiryuScheduled = createKiryuSchedule();
