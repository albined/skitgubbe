import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({ 
    plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			// Forward standard HTTP API calls
			'/api': 'http://localhost:3000',
			// Forward WebSocket connections
			'/ws': {
				target: 'ws://localhost:3000',
				ws: true
			}
		}
	}
});