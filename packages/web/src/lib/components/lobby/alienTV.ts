import { SRGBColorSpace, VideoTexture } from 'three';

export function isAlienTVTime(date = new Date()): boolean {
	return date.getHours() >= 22 || date.getHours() < 6;
}

export function createAlienTV(onVisibility: (visible: boolean) => void) {
	const video = document.createElement('video');
	video.muted = true;
	video.defaultMuted = true;
	video.loop = true;
	video.playsInline = true;
	video.preload = 'none';
	const texture = new VideoTexture(video);
	texture.colorSpace = SRGBColorSpace;
	let disposed = false;
	let pending = false;
	const shouldPlay = () => !disposed && isAlienTVTime() && document.visibilityState !== 'hidden';
	const hide = () => onVisibility(false);
	const show = () => onVisibility(shouldPlay());
	function sync() {
		if (!shouldPlay()) {
			video.pause();
			hide();
			return;
		}
		if (!video.paused || pending) return;
		if (!video.getAttribute('src')) video.src = '/lobby/alien-tv-video.mp4';
		pending = true;
		void video
			.play()
			.then(() => {
				if (!shouldPlay()) {
					video.pause();
					hide();
				}
			})
			.catch(hide)
			.finally(() => {
				pending = false;
			});
	}
	video.addEventListener('playing', show);
	video.addEventListener('error', hide);
	document.addEventListener('visibilitychange', sync);
	window.addEventListener('skitgubbe:native-resume', sync);
	window.addEventListener('pointerdown', sync, { passive: true });
	// Also catches clock/timezone changes while the lobby stays open.
	const timer = window.setInterval(sync, 1000);
	return {
		texture,
		sync,
		dispose() {
			disposed = true;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', sync);
			window.removeEventListener('skitgubbe:native-resume', sync);
			window.removeEventListener('pointerdown', sync);
			video.removeEventListener('playing', show);
			video.removeEventListener('error', hide);
			video.pause();
			video.removeAttribute('src');
			video.load();
			texture.dispose();
		}
	};
}
