import {
	CanvasTexture,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	SRGBColorSpace,
	type Object3D,
	type Texture
} from 'three';
import { CROWN_SVG_CONTENT, HALO_SVG_CONTENT } from '$lib/avatarAccessories';
import { renderAvatarImage } from './noticeBoard3D';
import { createPillarGeometry } from './pillarGeometry';
import { splitTally, type TallyPlayer } from './pillarTally';

const WIDTH = 800,
	HEIGHT = 1220,
	ROW_TOP = 205,
	ROW_HEIGHT = 190;
const decorationImages = new Map<string, Promise<HTMLImageElement>>();
function loadDecoration(kind: 'crown' | 'halo'): Promise<HTMLImageElement> {
	const cached = decorationImages.get(kind);
	if (cached) return cached;
	const markup = kind === 'crown' ? CROWN_SVG_CONTENT : HALO_SVG_CONTENT;
	const source = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 64 48">${markup}</svg>`;
	const promise = new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => {
			decorationImages.delete(kind);
			reject(new Error('Could not load avatar decoration'));
		};
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
	});
	decorationImages.set(kind, promise);
	return promise;
}

function noise(seed: number) {
	const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
	return value - Math.floor(value);
}

function stroke(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	dx: number,
	dy: number,
	seed: number
) {
	ctx.lineCap = 'round';
	for (let pass = 0; pass < 7; pass++) {
		ctx.globalAlpha = 0.12 + noise(seed + pass) * 0.18;
		ctx.lineWidth = 1.2 + noise(seed + pass + 20) * 2.4;
		ctx.beginPath();
		const jitter = (noise(seed + pass + 40) - 0.5) * 7;
		ctx.moveTo(x + jitter, y);
		ctx.quadraticCurveTo(x + dx / 2 + jitter + 2, y + dy / 2, x + dx + jitter, y + dy);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

export class PillarTally3D {
	readonly mesh: Mesh;
	readonly material: MeshBasicMaterial;
	private texture: CanvasTexture;
	private revision = 0;
	private key = '';
	private disposed = false;
	constructor(
		root: Object3D,
		lightMap: Texture,
		private requestRender: () => void
	) {
		const canvas = document.createElement('canvas');
		canvas.width = WIDTH;
		canvas.height = HEIGHT;
		this.texture = new CanvasTexture(canvas);
		this.texture.colorSpace = SRGBColorSpace;
		this.material = new MeshBasicMaterial({
			map: this.texture,
			lightMap,
			transparent: true,
			depthWrite: false,
			side: DoubleSide,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		this.mesh = new Mesh(createPillarGeometry(root), this.material);
		this.mesh.name = 'Pillar skitgubbe tallies';
	}
	async update(players: TallyPlayer[]) {
		const key = JSON.stringify(players);
		if (this.key === key || this.disposed) return;
		this.key = key;
		const revision = ++this.revision;
		try {
			await document.fonts.load('48px "Nanum Brush Script"');
			const [avatars, decorations] = await Promise.all([
				Promise.all(players.map((player) => renderAvatarImage(player).catch(() => null))),
				Promise.all(
					players.map((player) =>
						player.isTrumfman
							? loadDecoration('crown')
							: player.isSweetgubbe
								? loadDecoration('halo')
								: null
					)
				)
			]);
			if (this.disposed || revision !== this.revision) return;
			const canvas = this.texture.image as HTMLCanvasElement;
			const ctx = canvas.getContext('2d')!;
			ctx.clearRect(0, 0, WIDTH, HEIGHT);
			ctx.fillStyle = ctx.strokeStyle = '#fff1d2';
			players.forEach((player, row) => {
				const y = ROW_TOP + row * ROW_HEIGHT;
				if (avatars[row]) ctx.drawImage(avatars[row]!, 20, y, 150, 150);
				else {
					ctx.font = '62px "Nanum Brush Script"';
					ctx.fillText(player.name.slice(0, 2), 38, y + 94, 120);
				}
				if (decorations[row]) {
					ctx.save();
					const top = player.isTrumfman ? y - 38 : y - 28;
					ctx.translate(95, top + 39);
					ctx.rotate(((player.isTrumfman ? 7 : -8) * Math.PI) / 180);
					ctx.drawImage(decorations[row]!, -52, -39, 104, 78);
					ctx.restore();
				}
				const { bundles, remainder } = splitTally(player.skitgubbe);
				let tallyY = y + 34;
				if (bundles) {
					ctx.font = '92px "Nanum Brush Script"';
					ctx.fillText(`25 × ${bundles}`, 206, y + (remainder ? 58 : 94), 540);
					tallyY += 66;
				}
				if (!player.skitgubbe) {
					ctx.font = '48px "Nanum Brush Script"';
					ctx.fillText('0', 215, y + 90);
				}
				for (let n = 0; n < remainder; n++) {
					const group = Math.floor(n / 5),
						mark = n % 5,
						x = 211 + group * 108 + mark * 20;
					if (mark === 4) stroke(ctx, x - 87, tallyY + 52, 87, -39, row * 100 + n);
					else
						stroke(
							ctx,
							x,
							tallyY + noise(n + row * 30) * 7,
							(noise(n + 50) - 0.5) * 10,
							63,
							row * 100 + n
						);
				}
			});
			this.texture.needsUpdate = true;
			this.requestRender();
		} catch (error) {
			this.key = '';
			console.warn('Could not draw pillar tallies.', error);
		}
	}
	dispose() {
		this.disposed = true;
		this.revision++;
		this.mesh.geometry.dispose();
		this.material.dispose();
		this.texture.dispose();
	}
}
