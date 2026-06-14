import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	envDir: '../../',
	server: {
		proxy: {
			// Forward standard HTTP API calls and WebSocket connections
			'/api': {
				target: 'http://localhost:3000',
				ws: true
			}
		}
	}
});
