import { redirect } from '@sveltejs/kit';

export function load() {
	const randomRoomId = Math.random().toString(36).substring(2, 8);
	redirect(307, `/room/${randomRoomId}`);
}
