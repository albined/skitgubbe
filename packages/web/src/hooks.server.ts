import type { HandleServerError } from '@sveltejs/kit';

// Keep this: Logs detailed server errors and stack traces to your container output
export const handleError: HandleServerError = ({ error, event }) => {
	console.error(`[SvelteKit Server Error] on ${event.url.pathname}:`, error);
	return {
		message: 'Internal server error.',
	};
};
