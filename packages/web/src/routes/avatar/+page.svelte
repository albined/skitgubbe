<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { AVATAR_FEATURES, type AvatarFeatureTemplate } from '$lib/avatarFeatures';

	// State Variables
	let activeProfile = $state<any>(null);
	let isLoading = $state(true);

	// Customization States
	let skinColor = $state('#FFCDB2');
	let hairColor = $state('#3E2723');
	let eyeColor = $state('#4CAF50');
	let eyebrowColor = $state('#5D4037');

	// Canvas Features
	interface PlacedFeature {
		id: string;
		category: string;
		templateId: string;
		x: number;
		y: number;
		scaleX: number;
		scaleY: number;
		rotation: number;
		zIndex: number;
		svgContent: string;
		name: string;
	}

	let placedFeatures = $state<PlacedFeature[]>([]);
	let selectedFeatureId = $state<string | null>(null);

	// Dragging State
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let initialFeatureX = 0;
	let initialFeatureY = 0;

	// UI State
	let activeCategory = $state('head');
	let saveStatus = $state('');

	// Color Presets
	const SKIN_PRESETS = ['#FFCDB2', '#F5C6A5', '#E3A387', '#C68664', '#8C583C', '#FFDFD3', '#F1C27D', '#E0B0FF'];
	const HAIR_PRESETS = ['#3E2723', '#1A0F0D', '#8D5524', '#E5A93B', '#D95D39', '#757575', '#4A90E2', '#E24A8D'];
	const EYE_PRESETS = ['#4CAF50', '#2196F3', '#795548', '#FFC107', '#9C27B0', '#111111', '#FC3D3D'];
	const BROW_PRESETS = ['#5D4037', '#1A0F0D', '#3E2723', '#8D5524', '#757575', '#B88728'];

	onMount(async () => {
		await loadProfile();
		isLoading = false;
	});

	async function loadProfile() {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				activeProfile = await res.json();
				
				// Apply loaded avatar config or setup defaults
				if (activeProfile.avatar_config) {
					try {
						const config = JSON.parse(activeProfile.avatar_config);
						placedFeatures = config.features || [];
						skinColor = config.skinColor || '#FFCDB2';
						hairColor = config.hairColor || '#3E2723';
						eyeColor = config.eyeColor || '#4CAF50';
						eyebrowColor = config.eyebrowColor || '#5D4037';
					} catch (e) {
						console.error('Failed to parse avatar config:', e);
						setupDefaults();
					}
				} else {
					setupDefaults();
				}
			} else {
				// Redirect if not authenticated
				window.location.href = '/';
			}
		} catch (e) {
			console.error('Failed to load profile:', e);
			window.location.href = '/';
		}
	}

	function setupDefaults() {
		placedFeatures = [];
		// Load a default face
		AVATAR_FEATURES.forEach(cat => {
			if (cat.id === 'head' || cat.id === 'nose' || cat.id === 'mouth') {
				addFeature(cat.id, cat.features[0]);
			} else if (cat.id === 'eyes') {
				// Add pair of eyes
				const eye = cat.features[0];
				addFeature('eyes', eye, -30, -10, 0.45, 0.45, 'eye_left');
				addFeature('eyes', eye, 30, -10, -0.45, 0.45, 'eye_right'); // mirrored
			} else if (cat.id === 'eyebrows') {
				// Add pair of eyebrows
				const brow = cat.features[0];
				addFeature('eyebrows', brow, -30, -30, 0.45, 0.45, 'brow_left');
				addFeature('eyebrows', brow, 30, -30, -0.45, 0.45, 'brow_right'); // mirrored
			} else if (cat.id === 'hair_front') {
				addFeature('hair_front', cat.features[0]);
			} else if (cat.id === 'hair_back') {
				addFeature('hair_back', cat.features[0]);
			}
		});
	}

	function addFeature(
		category: string, 
		template: AvatarFeatureTemplate, 
		customX?: number, 
		customY?: number, 
		customScaleX?: number, 
		customScaleY?: number,
		customId?: string
	) {
		const newFeature: PlacedFeature = {
			id: customId || `${template.id}_${Math.random().toString(36).substring(2, 9)}`,
			category,
			templateId: template.id,
			x: customX !== undefined ? customX : template.defaultX,
			y: customY !== undefined ? customY : template.defaultY,
			scaleX: customScaleX !== undefined ? customScaleX : template.defaultScaleX,
			scaleY: customScaleY !== undefined ? customScaleY : template.defaultScaleY,
			rotation: 0,
			zIndex: template.zIndex,
			svgContent: template.svgContent,
			name: template.name
		};

		placedFeatures = [...placedFeatures, newFeature];
		selectedFeatureId = newFeature.id;
	}

	function removeSelectedFeature() {
		if (selectedFeatureId) {
			placedFeatures = placedFeatures.filter(f => f.id !== selectedFeatureId);
			selectedFeatureId = null;
		}
	}

	// Sorts placed features by Z-index for rendering
	const sortedFeatures = $derived(
		[...placedFeatures].sort((a, b) => a.zIndex - b.zIndex)
	);

	const selectedFeature = $derived(
		placedFeatures.find(f => f.id === selectedFeatureId) || null
	);

	// Dragging logic
	function handleCanvasPointerDown(e: PointerEvent) {
		// Deselect if clicking on empty space
		const target = e.target as SVGElement;
		if (target && target.id === 'avatar-canvas-rect') {
			selectedFeatureId = null;
		}
	}

	function startDrag(id: string, e: PointerEvent) {
		e.stopPropagation();
		selectedFeatureId = id;
		isDragging = true;

		const svg = document.getElementById('avatar-canvas') as any;
		if (!svg) return;

		const point = svg.createSVGPoint();
		point.x = e.clientX;
		point.y = e.clientY;
		const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

		dragStartX = svgPoint.x;
		dragStartY = svgPoint.y;

		const feature = placedFeatures.find(f => f.id === id);
		if (feature) {
			initialFeatureX = feature.x;
			initialFeatureY = feature.y;
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging || !selectedFeatureId) return;

		const svg = document.getElementById('avatar-canvas') as any;
		if (!svg) return;

		const point = svg.createSVGPoint();
		point.x = e.clientX;
		point.y = e.clientY;
		const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

		const dx = svgPoint.x - dragStartX;
		const dy = svgPoint.y - dragStartY;

		placedFeatures = placedFeatures.map(f => {
			if (f.id === selectedFeatureId) {
				return {
					...f,
					x: initialFeatureX + dx,
					y: initialFeatureY + dy
				};
			}
			return f;
		});
	}

	function handlePointerUp() {
		isDragging = false;
	}

	// Scale Actions
	function changeScale(factor: number) {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map(f => {
			if (f.id === selectedFeatureId) {
				// Limit scale between 0.1 and 3
				const signX = Math.sign(f.scaleX);
				const signY = Math.sign(f.scaleY);
				let newScaleX = Math.max(0.1, Math.min(3, Math.abs(f.scaleX) * factor)) * signX;
				let newScaleY = Math.max(0.1, Math.min(3, Math.abs(f.scaleY) * factor)) * signY;
				return { ...f, scaleX: newScaleX, scaleY: newScaleY };
			}
			return f;
		});
	}

	// Rotation Actions
	function rotateFeature(deg: number) {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map(f => {
			if (f.id === selectedFeatureId) {
				return { ...f, rotation: (f.rotation + deg) % 360 };
			}
			return f;
		});
	}

	// Mirror Action
	function mirrorFeature() {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map(f => {
			if (f.id === selectedFeatureId) {
				return { ...f, scaleX: -f.scaleX };
			}
			return f;
		});
	}

	// Z-Index Adjustments
	function adjustLayer(direction: 'up' | 'down') {
		if (!selectedFeatureId) return;
		const feature = placedFeatures.find(f => f.id === selectedFeatureId);
		if (!feature) return;

		let step = direction === 'up' ? 1 : -1;
		placedFeatures = placedFeatures.map(f => {
			if (f.id === selectedFeatureId) {
				return { ...f, zIndex: Math.max(0, Math.min(100, f.zIndex + step)) };
			}
			return f;
		});
	}

	// Save avatar function
	async function handleSave() {
		saveStatus = 'Generating picture...';
		try {
			const svgEl = document.getElementById('avatar-canvas');
			if (!svgEl) throw new Error('Canvas not found');

			// Clone SVG to modify it for saving
			const clone = svgEl.cloneNode(true) as SVGElement;

			// Add self-contained styles with exact selected color variables
			const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
			style.textContent = `
				.skin-color { fill: ${skinColor} !important; }
				.hair-color { fill: ${hairColor} !important; }
				.eye-color { fill: ${eyeColor} !important; }
				.eyebrow-color { fill: ${eyebrowColor} !important; }
			`;
			clone.appendChild(style);

			// Remove selection elements or filters
			const groups = clone.querySelectorAll('g');
			groups.forEach(g => {
				g.removeAttribute('filter');
				g.removeAttribute('class');
			});

			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(clone);
			const base64Image = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

			saveStatus = 'Saving...';

			const config = {
				features: placedFeatures,
				skinColor,
				hairColor,
				eyeColor,
				eyebrowColor
			};

			const res = await fetch('/api/profiles/me/avatar', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					avatar_config: config,
					avatar_image: base64Image
				})
			});

			if (res.ok) {
				saveStatus = 'Success!';
				setTimeout(() => {
					window.location.href = '/';
				}, 500);
			} else {
				const err = await res.json();
				saveStatus = `Error: ${err.error || 'Failed to save avatar'}`;
			}
		} catch (e: any) {
			console.error('Save failed:', e);
			saveStatus = `Failed to save: ${e.message}`;
		}
	}
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div class="felt-overlay"></div>

<div class="relative z-10 w-full min-h-screen flex flex-col justify-center items-center text-white px-4 py-6 font-nanum md:py-12">
	{#if isLoading}
		<div class="flex flex-col items-center gap-4">
			<div class="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin"></div>
			<span class="text-sm font-bold text-amber-500/80 tracking-widest uppercase">Loading Editor...</span>
		</div>
	{:else}
		<div class="w-full max-w-6xl flex flex-col gap-6" in:fade={{ duration: 200 }}>
			<!-- Header -->
			<div class="flex justify-between items-center bg-slate-950/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
				<div>
					<h1 class="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">
						Avatar Editor
					</h1>
					<p class="text-xs text-slate-450 uppercase font-sans tracking-widest mt-1">
						Customize character design for <span class="text-amber-400">{activeProfile.name}</span>
					</p>
				</div>
				<div class="flex gap-3 font-serif">
					<button
						onclick={() => (window.location.href = '/')}
						class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-bold transition-all border border-white/5 cursor-pointer"
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-bold text-sm tracking-wide transition-all duration-300 border border-yellow-500/20 cursor-pointer shadow-lg flex items-center gap-2"
					>
						💾 Save Avatar
					</button>
				</div>
			</div>

			<!-- Save Status Message -->
			{#if saveStatus}
				<div class="w-full text-center py-2 px-4 rounded-xl bg-slate-950/80 border border-white/10 text-amber-400 text-sm font-sans" transition:fade>
					{saveStatus}
				</div>
			{/if}

			<!-- Creator Layout -->
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
				<!-- Left Sidebar: Feature Library -->
				<div class="lg:col-span-3 flex flex-col gap-4 bg-slate-950/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
					<span class="text-xs font-bold text-slate-400 uppercase font-sans tracking-widest border-b border-white/5 pb-2">
						Category Library
					</span>
					
					<!-- Category Tabs -->
					<div class="grid grid-cols-3 lg:grid-cols-1 gap-2">
						{#each AVATAR_FEATURES as cat}
							<button
								onclick={() => (activeCategory = cat.id)}
								class="px-3 py-2 text-left rounded-xl text-sm font-semibold transition-all border cursor-pointer {activeCategory === cat.id ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-white/5 bg-slate-900/40 text-slate-400 hover:text-slate-200'}"
							>
								{cat.name}
							</button>
						{/each}
					</div>

					<div class="h-[1px] bg-white/5 my-2"></div>

					<!-- Feature Selection Grid -->
					<div class="flex-grow overflow-y-auto max-h-[300px] lg:max-h-none flex flex-col gap-2">
						{#each AVATAR_FEATURES.find(c => c.id === activeCategory)?.features || [] as item}
							<button
								onclick={() => {
									// If it's eyes or eyebrows, add a pair. For everything else, add single.
									if (activeCategory === 'eyes') {
										addFeature('eyes', item, -30, -10, 0.45, 0.45);
										addFeature('eyes', item, 30, -10, -0.45, 0.45);
									} else if (activeCategory === 'eyebrows') {
										addFeature('eyebrows', item, -30, -30, 0.45, 0.45);
										addFeature('eyebrows', item, 30, -30, -0.45, 0.45);
									} else {
										addFeature(activeCategory, item);
									}
								}}
								class="p-3 bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-white/10 rounded-xl text-left cursor-pointer transition-all flex flex-col items-start gap-1 group"
							>
								<span class="text-sm font-bold text-slate-200 group-hover:text-white">{item.name}</span>
								<span class="text-[10px] text-slate-500 uppercase font-sans">Click to add to face</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Center: Avatar Canvas (Felt style) -->
				<div class="lg:col-span-5 flex flex-col items-center justify-center bg-slate-950/20 border border-white/5 rounded-2xl p-6 backdrop-blur-md relative min-h-[380px] lg:min-h-0">
					<!-- Helper instructions -->
					<div class="absolute top-4 left-4 pointer-events-none text-left">
						<span class="text-[10px] text-slate-500 uppercase font-sans tracking-widest block">Canvas Workspace</span>
						<span class="text-[9px] text-slate-600 block">Drag items to compose face</span>
					</div>

					<!-- Selection reset click helper -->
					<button type="button" class="absolute inset-0 z-0 bg-transparent border-0 w-full h-full p-0 cursor-default" onclick={() => (selectedFeatureId = null)} aria-label="Clear selection"></button>

					<!-- Interactive Canvas -->
					<div class="w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl relative bg-slate-950 z-10 flex items-center justify-center">
						<svg
							id="avatar-canvas"
							viewBox="0 0 200 200"
							class="w-full h-full select-none"
							xmlns="http://www.w3.org/2000/svg"
							onpointerdown={handleCanvasPointerDown}
							style="--skin-color: {skinColor}; --hair-color: {hairColor}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor};"
							role="img"
							aria-label="Character Avatar Composition Canvas"
						>
							<defs>
								<!-- Soft shadow for cheeks -->
								<filter id="blur-shadow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="4" />
								</filter>
								<!-- Lip glow/blur -->
								<filter id="lip-glow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" />
								</filter>
								<!-- Nose filter -->
								<filter id="soft-nose" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="4" />
								</filter>
								<!-- Eye inner shadow filter -->
								<filter id="eye-shadow" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" />
								</filter>
								<!-- Eyebrow filter -->
								<filter id="brow-soft-1" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="3" />
								</filter>
								<!-- Bounding Selection Halo -->
								<filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
									<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#fbbf24" flood-opacity="0.85" />
								</filter>
								
								<!-- ClipPaths for Eyes -->
								<clipPath id="eye-clip-1">
									<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" />
								</clipPath>
							</defs>

							<style>
								.skin-color { fill: var(--skin-color, #FFCDB2); }
								.hair-color { fill: var(--hair-color, #3E2723); }
								.eye-color { fill: var(--eye-color, #4CAF50); }
								.eyebrow-color { fill: var(--eyebrow-color, #5D4037); }
							</style>

							<!-- Clickable Background Rect to clear selection -->
							<rect id="avatar-canvas-rect" width="200" height="200" fill="transparent" />

							<!-- Placed Features -->
							{#each sortedFeatures as f (f.id)}
								<!-- transform wraps translation first, then does rotation and scaling around design center (100, 100) -->
								<g
									transform="translate({f.x} {f.y}) translate(100 100) rotate({f.rotation}) scale({f.scaleX} {f.scaleY}) translate(-100 -100)"
									class="cursor-grab"
									class:cursor-grabbing={isDragging && selectedFeatureId === f.id}
									filter={selectedFeatureId === f.id ? 'url(#selection-glow)' : ''}
									onpointerdown={(e) => startDrag(f.id, e)}
									role="button"
									tabindex="0"
									aria-label={f.name}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											selectedFeatureId = f.id;
										}
									}}
								>
									{@html f.svgContent}
								</g>
							{/each}
						</svg>
					</div>

					<button
						onclick={setupDefaults}
						class="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/5 hover:border-white/10 text-xs font-bold rounded-xl text-slate-400 hover:text-slate-200 cursor-pointer transition-all uppercase tracking-widest font-sans"
					>
						🔄 Reset to Default Face
					</button>
				</div>

				<!-- Right Sidebar: Configuration & Global Styling -->
				<div class="lg:col-span-4 flex flex-col gap-5 bg-slate-950/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
					<!-- Active Item Customization -->
					<div class="flex flex-col gap-3">
						<span class="text-xs font-bold text-slate-400 uppercase font-sans tracking-widest border-b border-white/5 pb-2">
							Selected Feature Control
						</span>

						{#if selectedFeature}
							<div class="bg-slate-900/40 p-3 rounded-xl border border-white/5 flex flex-col gap-3" transition:scale={{ duration: 150 }}>
								<div class="flex justify-between items-center">
									<span class="text-sm font-bold text-amber-400 capitalize">{selectedFeature.name}</span>
									<button
										onclick={removeSelectedFeature}
										class="px-2 py-1 bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-[10px] font-sans font-bold text-red-400 rounded-lg cursor-pointer transition-all"
									>
										Delete
									</button>
								</div>

								<!-- Manipulators -->
								<div class="grid grid-cols-2 gap-2 font-sans">
									<button
										onclick={() => changeScale(1.05)}
										class="py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
									>
										🔍 Grow (+5%)
									</button>
									<button
										onclick={() => changeScale(0.95)}
										class="py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
									>
										🔍 Shrink (-5%)
									</button>
									<button
										onclick={() => rotateFeature(-15)}
										class="py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
									>
										↩️ Rotate L (15°)
									</button>
									<button
										onclick={() => rotateFeature(15)}
										class="py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
									>
										↪️ Rotate R (15°)
									</button>
									<button
										onclick={mirrorFeature}
										class="py-2 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
									>
										↔️ Mirror (Flip X)
									</button>
									<div class="flex gap-1">
										<button
											onclick={() => adjustLayer('up')}
											class="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-[10px] text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
											title="Bring Forward"
										>
											▲ Bring Up
										</button>
										<button
											onclick={() => adjustLayer('down')}
											class="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-[10px] text-white rounded-lg cursor-pointer border border-white/5 active:scale-95 transition-all"
											title="Send Backward"
										>
											▼ Send Down
										</button>
									</div>
								</div>
							</div>
						{:else}
							<div class="py-6 text-center bg-slate-900/20 border border-dashed border-white/5 rounded-xl text-slate-500 text-xs font-sans">
								No feature selected.<br/>Click a feature on the canvas to edit.
							</div>
						{/if}
					</div>

					<!-- Global Styling: Color Palettes -->
					<div class="flex flex-col gap-4">
						<span class="text-xs font-bold text-slate-400 uppercase font-sans tracking-widest border-b border-white/5 pb-2">
							Color Customization
						</span>

						<!-- Skin tone selector -->
						<div class="flex flex-col gap-1.5 font-sans">
							<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Skin Color</span>
							<div class="flex flex-wrap gap-1.5">
								{#each SKIN_PRESETS as color}
									<button
										onclick={() => (skinColor = color)}
										class="w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-105"
										style="background-color: {color}; border-color: {skinColor === color ? '#fbbf24' : 'transparent'};"
										aria-label="Select Skin Color {color}"
									></button>
								{/each}
								<input type="color" bind:value={skinColor} class="w-6 h-6 p-0 rounded-full border-0 cursor-pointer overflow-hidden" />
							</div>
						</div>

						<!-- Hair color selector -->
						<div class="flex flex-col gap-1.5 font-sans">
							<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Hair Color</span>
							<div class="flex flex-wrap gap-1.5">
								{#each HAIR_PRESETS as color}
									<button
										onclick={() => (hairColor = color)}
										class="w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-105"
										style="background-color: {color}; border-color: {hairColor === color ? '#fbbf24' : 'transparent'};"
										aria-label="Select Hair Color {color}"
									></button>
								{/each}
								<input type="color" bind:value={hairColor} class="w-6 h-6 p-0 rounded-full border-0 cursor-pointer overflow-hidden" />
							</div>
						</div>

						<!-- Eye color selector -->
						<div class="flex flex-col gap-1.5 font-sans">
							<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Eye Color</span>
							<div class="flex flex-wrap gap-1.5">
								{#each EYE_PRESETS as color}
									<button
										onclick={() => (eyeColor = color)}
										class="w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-105"
										style="background-color: {color}; border-color: {eyeColor === color ? '#fbbf24' : 'transparent'};"
										aria-label="Select Eye Color {color}"
									></button>
								{/each}
								<input type="color" bind:value={eyeColor} class="w-6 h-6 p-0 rounded-full border-0 cursor-pointer overflow-hidden" />
							</div>
						</div>

						<!-- Eyebrow color selector -->
						<div class="flex flex-col gap-1.5 font-sans">
							<span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Eyebrow Color</span>
							<div class="flex flex-wrap gap-1.5">
								{#each BROW_PRESETS as color}
									<button
										onclick={() => (eyebrowColor = color)}
										class="w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-105"
										style="background-color: {color}; border-color: {eyebrowColor === color ? '#fbbf24' : 'transparent'};"
										aria-label="Select Eyebrow Color {color}"
									></button>
								{/each}
								<input type="color" bind:value={eyebrowColor} class="w-6 h-6 p-0 rounded-full border-0 cursor-pointer overflow-hidden" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap');

	.font-nanum {
		font-family: 'Nanum Brush Script', cursive;
	}

	.cursor-grab {
		cursor: grab;
	}

	.cursor-grabbing {
		cursor: grabbing;
	}
</style>
