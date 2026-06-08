<script lang="ts">
	import { onMount } from 'svelte';
	import { AVATAR_FEATURES, type AvatarFeatureTemplate } from '$lib/avatarFeatures';

	// State Variables
	let activeProfile = $state<any>(null);
	let isLoading = $state(true);
	let isNewProfile = $state(false);
	let profileName = $state('');
	let nameError = $state(false);

	// Customization Colors
	let skinColor = $state('#FFCDB2');
	let hairColor = $state('#3E2723');
	let eyeColor = $state('#4CAF50');
	let eyebrowColor = $state('#5D4037');
	let bgColor = $state('#FFFFFF');
	let bgHue = $state(210);
	let bgSaturation = $state(20);
	let bgLightness = $state(98);

	const GRID_HUES = [10, 45, 120, 190, 240, 300];
	const GRID_LIGHTNESSES = [92, 80, 68, 55, 42, 25];
	const SATURATION_PRESETS = [100, 85, 70, 55, 40, 25, 12, 0];

	function snapHue(h: number): number {
		return GRID_HUES.reduce((prev, curr) => 
			Math.abs(curr - h) < Math.abs(prev - h) ? curr : prev
		);
	}

	function snapLightness(l: number): number {
		return GRID_LIGHTNESSES.reduce((prev, curr) => 
			Math.abs(curr - l) < Math.abs(prev - l) ? curr : prev
		);
	}

	function snapSaturation(s: number): number {
		return SATURATION_PRESETS.reduce((prev, curr) => 
			Math.abs(curr - s) < Math.abs(prev - s) ? curr : prev
		);
	}

	function handleSelectGridColor(h: number, l: number) {
		selectedFeatureId = null;
		bgHue = h;
		bgLightness = l;
		bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
		pushHistoryState();
	}

	// HSL conversion helpers
	function hexToHSL(hex: string) {
		hex = hex.replace(/^#/, '');
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		let r = parseInt(hex.substring(0, 2), 16) / 255;
		let g = parseInt(hex.substring(2, 4), 16) / 255;
		let b = parseInt(hex.substring(4, 6), 16) / 255;

		let max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h = 0, s = 0, l = (max + min) / 2;

		if (max !== min) {
			let d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		return {
			h: Math.round(h * 360),
			s: Math.round(s * 100),
			l: Math.round(l * 100)
		};
	}

	function hslToHex(h: number, s: number, l: number) {
		s /= 100;
		l /= 100;
		let c = (1 - Math.abs(2 * l - 1)) * s;
		let x = c * (1 - Math.abs((h / 60) % 2 - 1));
		let m = l - c / 2;
		let r = 0, g = 0, b = 0;

		if (0 <= h && h < 60) {
			r = c; g = x; b = 0;
		} else if (60 <= h && h < 120) {
			r = x; g = c; b = 0;
		} else if (120 <= h && h < 180) {
			r = 0; g = c; b = x;
		} else if (180 <= h && h < 240) {
			r = 0; g = x; b = c;
		} else if (240 <= h && h < 300) {
			r = x; g = 0; b = c;
		} else if (300 <= h && h < 360) {
			r = c; g = 0; b = x;
		}

		let rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
		let gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
		let bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

		return `#${rHex}${gHex}${bHex}`.toUpperCase();
	}

	// Canvas Placed Features
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

	// Dragging State (Canvas feature drag)
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let initialFeatureX = 0;
	let initialFeatureY = 0;

	// Gesture tracking state
	const activePointers = new Map<number, { clientX: number; clientY: number }>();
	let isPinching = $state(false);
	let initialPinchDistance = 0;
	let initialPinchAngle = 0;
	let initialFeatureScaleX = 1;
	let initialFeatureScaleY = 1;
	let initialFeatureRotation = 0;
	let initialPinchMidpoint = { x: 0, y: 0 };

	function getDistance(p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) {
		const dx = p1.clientX - p2.clientX;
		const dy = p1.clientY - p2.clientY;
		return Math.hypot(dx, dy);
	}

	function getAngle(p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) {
		return Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
	}

	function initPinchGesture() {
		if (activePointers.size !== 2 || !selectedFeatureId) return;

		const pointers = Array.from(activePointers.values());
		const p1 = pointers[0];
		const p2 = pointers[1];

		initialPinchDistance = getDistance(p1, p2);
		initialPinchAngle = getAngle(p1, p2);

		const feature = placedFeatures.find((f) => f.id === selectedFeatureId);
		if (feature) {
			initialFeatureScaleX = feature.scaleX;
			initialFeatureScaleY = feature.scaleY;
			initialFeatureRotation = feature.rotation;
			initialFeatureX = feature.x;
			initialFeatureY = feature.y;

			const screenMidX = (p1.clientX + p2.clientX) / 2;
			const screenMidY = (p1.clientY + p2.clientY) / 2;
			initialPinchMidpoint = getSVGCoords(screenMidX, screenMidY);
			isPinching = true;
		}
	}

	// Library Drag State
	let pendingLibraryDrag = $state<{ category: string; template: AvatarFeatureTemplate } | null>(
		null
	);
	let originalFeaturesState: { features: PlacedFeature[]; selectedFeatureId: string | null } | null = null;
	let libDragStartX = 0;
	let libDragStartY = 0;
	let libDragHasMoved = $state(false);
	let cursorX = $state(0);
	let cursorY = $state(0);
	let isOverCanvas = $state(false);

	// Undo/Redo State History
	interface AvatarState {
		features: PlacedFeature[];
		skinColor: string;
		hairColor: string;
		eyeColor: string;
		eyebrowColor: string;
		bgColor: string;
	}

	let history = $state<AvatarState[]>([]);
	let historyIndex = $state(-1);

	// UI State
	let activeCategory = $state('head');
	let saveStatus = $state('');

	// Tab Bar scroll dragging state
	let isTabScrolling = false;
	let tabScrollStartX = 0;
	let tabScrollLeft = 0;
	let tabDragDistance = 0;

	// Color Presets
	const SKIN_PRESETS = [
		'#FFF5EE', // light seashell / peach
		'#FFE4C4', // bisque / soft cream-peach
		'#FFD8BE', // very light peach
		'#FFCDB2', // classic light skin
		'#E8B090', // warm medium skin
		'#D69777', // tan / olive skin
		'#A66E4E', // light brown / caramel
		'#6B442B' // dark brown
	];
	const HAIR_PRESETS = [
		'#FAF0D7', // platinum blonde
		'#F3E5AB', // warm golden blonde
		'#D2B48C', // dirty blonde / light brown
		'#8B5A2B', // medium warm brown
		'#4A2E1B', // dark chocolate brown
		'#1C120C', // near black
		'#E5A073', // strawberry blonde
		'#D95D39' // dark ginger
	];
	const BROW_PRESETS = HAIR_PRESETS; // Brow colors identical to hair colors
	const EYE_PRESETS = [
		'#7EA7D8', // soft sky blue
		'#4A90E2', // medium sapphire blue
		'#1F4E79', // deep ocean blue
		'#9CD095', // soft sage green
		'#4CAF50', // forest green
		'#2E6930', // deep emerald green
		'#8E6F50', // warm amber brown
		'#52361B' // deep chocolate brown
	];
	const BG_PRESETS = [
		'#FFFFFF', // White
		'#F1F5F9', // Very light slate gray
		'#E2E8F0', // Soft blue-gray
		'#FCA5A5', // Soft pastel red
		'#FEF08A', // Soft pastel yellow
		'#A7F3D0', // Soft pastel green
		'#93C5FD', // Soft pastel blue
		'#C084FC' // Soft pastel purple
	];

	onMount(async () => {
		const urlParams = new URLSearchParams(window.location.search);
		isNewProfile = urlParams.get('new') === 'true';

		if (isNewProfile) {
			// Initialize default values for new profile
			activeProfile = null;
			profileName = '';
			skinColor = '#FFCDB2';
			hairColor = '#3E2723';
			eyeColor = '#4CAF50';
			eyebrowColor = '#5D4037';
			bgColor = '#FFFFFF';
			placedFeatures = [];
			
			// Initialize history stack
			history = [{
				features: [],
				skinColor,
				hairColor,
				eyeColor,
				eyebrowColor,
				bgColor
			}];
			historyIndex = 0;
			isLoading = false;
		} else {
			await loadProfile();
			isLoading = false;
		}
	});

	async function loadProfile() {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				activeProfile = await res.json();
				profileName = activeProfile.name || '';

				// Apply loaded avatar config or start completely clear
				if (activeProfile.avatar_config) {
					try {
						const config = JSON.parse(activeProfile.avatar_config);
						placedFeatures = (config.features || []).map((f: any) => {
							const template = AVATAR_FEATURES.flatMap(cat => cat.features).find(t => t.id === f.templateId);
							return {
								...f,
								svgContent: template ? template.svgContent : (f.svgContent || ''),
								name: template ? template.name : (f.name || '')
							};
						});
						skinColor = config.skinColor || '#FFCDB2';
						hairColor = config.hairColor || '#3E2723';
						eyeColor = config.eyeColor || '#4CAF50';
						eyebrowColor = config.eyebrowColor || '#5D4037';
						bgColor = config.bgColor || '#FFFFFF';
						const hsl = hexToHSL(bgColor);
						bgHue = snapHue(hsl.h);
						bgLightness = snapLightness(hsl.l);
						bgSaturation = snapSaturation(hsl.s);
						bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
					} catch (e) {
						console.error('Failed to parse avatar config:', e);
						placedFeatures = [];
					}
				} else {
					placedFeatures = [];
				}

				// Initialize history state stack
				history = [{
					features: JSON.parse(JSON.stringify(placedFeatures)),
					skinColor,
					hairColor,
					eyeColor,
					eyebrowColor,
					bgColor
				}];
				historyIndex = 0;
			} else {
				window.location.href = '/';
			}
		} catch (e) {
			console.error('Failed to load profile:', e);
			window.location.href = '/';
		}
	}

	// Record a new state snapshot in the Undo/Redo history stack
	function pushHistoryState() {
		const newState: AvatarState = {
			features: JSON.parse(JSON.stringify(placedFeatures)),
			skinColor,
			hairColor,
			eyeColor,
			eyebrowColor,
			bgColor
		};

		// Avoid pushing identical duplicate state back-to-back
		if (historyIndex >= 0) {
			const curr = history[historyIndex];
			if (JSON.stringify(curr) === JSON.stringify(newState)) {
				return;
			}
		}

		history = [...history.slice(0, historyIndex + 1), newState];
		historyIndex = history.length - 1;
	}

	function undo() {
		if (historyIndex > 0) {
			historyIndex--;
			applyState(history[historyIndex]);
		}
	}

	// Re-add redo function
	function redo() {
		if (historyIndex < history.length - 1) {
			historyIndex++;
			applyState(history[historyIndex]);
		}
	}

	function applyState(state: AvatarState) {
		placedFeatures = JSON.parse(JSON.stringify(state.features));
		skinColor = state.skinColor;
		hairColor = state.hairColor;
		eyeColor = state.eyeColor;
		eyebrowColor = state.eyebrowColor;
		bgColor = state.bgColor || '#FFFFFF';
		const hsl = hexToHSL(bgColor);
		bgHue = snapHue(hsl.h);
		bgLightness = snapLightness(hsl.l);
		bgSaturation = snapSaturation(hsl.s);
		bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
		if (selectedFeatureId && !placedFeatures.some(f => f.id === selectedFeatureId)) {
			selectedFeatureId = null;
		}
	}

	// Determine if coordinates are inside the canvas bounding rect
	function isPointerOverCanvas(clientX: number, clientY: number) {
		const canvasEl = document.getElementById('avatar-canvas');
		if (!canvasEl) return false;
		const rect = canvasEl.getBoundingClientRect();
		return (
			clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
		);
	}

	// Translate screen coords to SVG coords relative to center 100,100
	function getSVGCoords(clientX: number, clientY: number) {
		const svg = document.getElementById('avatar-canvas') as any;
		if (!svg) return { x: 0, y: 0 };

		const point = svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
		return {
			x: svgPoint.x - 100,
			y: svgPoint.y - 100
		};
	}

	// Prepare and resolve spawning/replacing features
	function prepareAddFeature(
		category: string,
		template: AvatarFeatureTemplate,
		x: number,
		y: number
	) {
		const activeSelected = selectedFeature;

		// In-place replace check
		if (activeSelected && activeSelected.category === category) {
			placedFeatures = placedFeatures.map((f) => {
				if (f.id === activeSelected.id) {
					return {
						...f,
						templateId: template.id,
						svgContent: template.svgContent,
						name: template.name
					};
				}
				return f;
			});
			return;
		}

		// limit check
		const placedOfCat = placedFeatures.filter((f) => f.category === category);
		const limit = category === 'eyes' || category === 'eyebrows' ? 2 : 1;

		if (placedOfCat.length < limit) {
			// Add fresh
			const newId = `${template.id}_${Math.random().toString(36).substring(2, 9)}`;
			const newFeature: PlacedFeature = {
				id: newId,
				category,
				templateId: template.id,
				x,
				y,
				scaleX: template.defaultScaleX,
				scaleY: template.defaultScaleY,
				rotation: 0,
				zIndex: template.zIndex,
				svgContent: template.svgContent,
				name: template.name
			};
			placedFeatures = [...placedFeatures, newFeature];
			selectedFeatureId = newId;
		} else {
			// Replace earliest added asset: remove it and append the new one
			const earliest = placedOfCat[0];
			const newId = `${template.id}_${Math.random().toString(36).substring(2, 9)}`;
			const newFeature: PlacedFeature = {
				id: newId,
				category,
				templateId: template.id,
				x,
				y,
				scaleX: template.defaultScaleX,
				scaleY: template.defaultScaleY,
				rotation: 0,
				zIndex: template.zIndex,
				svgContent: template.svgContent,
				name: template.name
			};
			placedFeatures = placedFeatures.filter((f) => f.id !== earliest.id);
			placedFeatures = [...placedFeatures, newFeature];
			selectedFeatureId = newId;
		}
	}

	// Pointerdown library grid item
	function handleLibraryPointerDown(
		category: string,
		template: AvatarFeatureTemplate,
		e: PointerEvent
	) {
		e.stopPropagation();
		pendingLibraryDrag = { category, template };
		libDragStartX = e.clientX;
		libDragStartY = e.clientY;
		cursorX = e.clientX;
		cursorY = e.clientY;
		libDragHasMoved = false;
		isOverCanvas = false;

		// Snapshot the clean state before drag begins
		originalFeaturesState = {
			features: JSON.parse(JSON.stringify(placedFeatures)),
			selectedFeatureId: selectedFeatureId
		};

		const target = e.currentTarget as HTMLElement;
		try {
			target.setPointerCapture(e.pointerId);
		} catch (err) {
			console.error('setPointerCapture failed for library item', err);
		}
	}

	function handleLibraryPointerMove(e: PointerEvent) {
		if (!pendingLibraryDrag) return;
		e.stopPropagation();

		cursorX = e.clientX;
		cursorY = e.clientY;

		const dx = e.clientX - libDragStartX;
		const dy = e.clientY - libDragStartY;
		const dist = Math.hypot(dx, dy);

		if (dist > 5) {
			if (!libDragHasMoved) {
				libDragHasMoved = true;
			}

			const over = isPointerOverCanvas(e.clientX, e.clientY);
			if (over) {
				if (!isOverCanvas) {
					// Transition: enter canvas!
					isOverCanvas = true;
					const coords = getSVGCoords(e.clientX, e.clientY);
					prepareAddFeature(
						pendingLibraryDrag.category,
						pendingLibraryDrag.template,
						coords.x,
						coords.y
					);

					// Setup canvas dragging variables to take over
					isDragging = true;
					activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
					const svg = document.getElementById('avatar-canvas') as any;
					if (svg) {
						const point = svg.createSVGPoint();
						point.x = e.clientX;
						point.y = e.clientY;
						const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
						dragStartX = svgPoint.x;
						dragStartY = svgPoint.y;
						initialFeatureX = coords.x;
						initialFeatureY = coords.y;
					}
				} else {
					// Continue drag positioning on canvas
					if (isDragging && selectedFeatureId) {
						const svg = document.getElementById('avatar-canvas') as any;
						if (svg) {
							const point = svg.createSVGPoint();
							point.x = e.clientX;
							point.y = e.clientY;
							const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
							const cDx = svgPoint.x - dragStartX;
							const cDy = svgPoint.y - dragStartY;
							placedFeatures = placedFeatures.map((f) => {
								if (f.id === selectedFeatureId) {
									return {
										...f,
										x: initialFeatureX + cDx,
										y: initialFeatureY + cDy
									};
								}
								return f;
							});
						}
					}
				}
			} else {
				// Dragging outside canvas
				if (isOverCanvas) {
					// Transition: left canvas! Revert to original features state
					if (originalFeaturesState) {
						placedFeatures = JSON.parse(JSON.stringify(originalFeaturesState.features));
						selectedFeatureId = originalFeaturesState.selectedFeatureId;
					}
					isOverCanvas = false;
					isDragging = false;
				}
			}
		}
	}

	function handleLibraryPointerUp(e: PointerEvent) {
		if (!pendingLibraryDrag) return;
		e.stopPropagation();

		const target = e.currentTarget as HTMLElement;
		try {
			target.releasePointerCapture(e.pointerId);
		} catch {}

		if (!libDragHasMoved) {
			// Tapped: spawn in the middle
			prepareAddFeature(pendingLibraryDrag.category, pendingLibraryDrag.template, 0, 0);
			pushHistoryState();
		} else {
			// Dragged: if it entered the canvas, save to history
			if (isOverCanvas) {
				pushHistoryState();
			} else {
				// Revert to original clean state if released outside canvas
				if (originalFeaturesState) {
					placedFeatures = JSON.parse(JSON.stringify(originalFeaturesState.features));
					selectedFeatureId = originalFeaturesState.selectedFeatureId;
				}
			}
			// Stop active dragging
			isDragging = false;
		}
		originalFeaturesState = null;

		activePointers.clear();
		pendingLibraryDrag = null;
		libDragHasMoved = false;
		isOverCanvas = false;
	}

	// Remove selected feature
	function removeSelectedFeature() {
		if (selectedFeatureId) {
			placedFeatures = placedFeatures.filter((f) => f.id !== selectedFeatureId);
			selectedFeatureId = null;
			pushHistoryState();
		}
	}

	// Fixed sorting (bottom-to-top rendering order)
	const CATEGORY_ORDER = ['hair_back', 'head', 'mouth', 'eyes', 'nose', 'eyebrows', 'hair_front'];

	const sortedFeatures = $derived(
		[...placedFeatures].sort((a, b) => {
			return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
		})
	);

	const selectedFeature = $derived(placedFeatures.find((f) => f.id === selectedFeatureId) || null);

	// Contextual active color modes derived automatically
	const activeColorMode = $derived.by(() => {
		const cat = selectedFeature ? selectedFeature.category : activeCategory;
		if (cat === 'head' || cat === 'nose' || cat === 'mouth') {
			return 'skin';
		} else if (cat === 'hair_front' || cat === 'hair_back') {
			return 'hair';
		} else if (cat === 'eyes') {
			return 'eyes';
		} else if (cat === 'eyebrows') {
			return 'eyebrow';
		} else if (cat === 'background') {
			return 'background';
		}
		return 'skin';
	});

	const activePresets = $derived.by(() => {
		if (activeColorMode === 'skin') return SKIN_PRESETS;
		if (activeColorMode === 'hair') return HAIR_PRESETS;
		if (activeColorMode === 'eyes') return EYE_PRESETS;
		if (activeColorMode === 'eyebrow') return BROW_PRESETS;
		if (activeColorMode === 'background') {
			return SATURATION_PRESETS.map((s) => hslToHex(bgHue, s, bgLightness));
		}
		return SKIN_PRESETS;
	});

	const activeColorValue = $derived.by(() => {
		if (activeColorMode === 'skin') return skinColor;
		if (activeColorMode === 'hair') return hairColor;
		if (activeColorMode === 'eyes') return eyeColor;
		if (activeColorMode === 'eyebrow') return eyebrowColor;
		if (activeColorMode === 'background') return bgColor;
		return skinColor;
	});

	function handleSelectColor(color: string) {
		if (activeColorMode === 'skin') {
			skinColor = color;
		} else if (activeColorMode === 'hair') {
			hairColor = color;
		} else if (activeColorMode === 'eyes') {
			eyeColor = color;
		} else if (activeColorMode === 'eyebrow') {
			eyebrowColor = color;
		} else if (activeColorMode === 'background') {
			bgColor = color;
			const hsl = hexToHSL(color);
			bgHue = snapHue(hsl.h);
			bgLightness = snapLightness(hsl.l);
			bgSaturation = snapSaturation(hsl.s);
		}
		pushHistoryState();
	}

	// Smooth canvas dragging logic
	function handleCanvasPointerDown(e: PointerEvent) {
		const target = e.target as SVGElement;
		if (target && target.id === 'avatar-canvas-rect') {
			selectedFeatureId = null;
		}
	}

	function handleGlobalPointerDown(e: PointerEvent) {
		activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

		if (isDragging && activePointers.size === 2) {
			initPinchGesture();
		}

		if (!selectedFeatureId) return;

		const target = e.target as HTMLElement;

		// 1. Inside the canvas container or canvas itself:
		const canvasEl = document.getElementById('avatar-canvas');
		if (canvasEl && canvasEl.contains(target)) {
			return; // Let the canvas pointer events handle it
		}

		// 2. Any button or interactive control:
		if (target.closest('button') || target.closest('input') || target.closest('[role="button"]')) {
			return; // Keep selection
		}

		// Otherwise, deselect
		selectedFeatureId = null;
	}

	function startDrag(id: string, e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();

		// If a gesture/drag is already in progress on a selected feature, subsequent touch points
		// should be treated as part of the pinch/scale gesture rather than switching active features.
		if (isDragging && selectedFeatureId) {
			activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
			if (activePointers.size === 2) {
				initPinchGesture();
			}
			return;
		}

		selectedFeatureId = id;
		isDragging = true;

		activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

		const target = e.currentTarget as HTMLElement | SVGElement;
		try {
			target.setPointerCapture(e.pointerId);
		} catch (err) {
			console.error('setPointerCapture failed in startDrag', err);
		}

		const feature = placedFeatures.find((f) => f.id === id);
		const svg = document.getElementById('avatar-canvas') as any;
		if (!svg) return;

		const point = svg.createSVGPoint();
		point.x = e.clientX;
		point.y = e.clientY;
		const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

		dragStartX = svgPoint.x;
		dragStartY = svgPoint.y;

		if (feature) {
			initialFeatureX = feature.x;
			initialFeatureY = feature.y;
		}

		if (activePointers.size === 2) {
			initPinchGesture();
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (activePointers.has(e.pointerId)) {
			activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
		}

		if (!isDragging || !selectedFeatureId) return;

		// Two-finger pinch & rotate gesture
		if (isPinching && activePointers.size === 2) {
			const pointers = Array.from(activePointers.values());
			const p1 = pointers[0];
			const p2 = pointers[1];

			const currentDistance = getDistance(p1, p2);
			const currentAngle = getAngle(p1, p2);

			const scaleFactor = initialPinchDistance > 0 ? (currentDistance / initialPinchDistance) : 1;
			const angleDiff = (currentAngle - initialPinchAngle) * (180 / Math.PI);

			const screenMidX = (p1.clientX + p2.clientX) / 2;
			const screenMidY = (p1.clientY + p2.clientY) / 2;
			const currentMidpoint = getSVGCoords(screenMidX, screenMidY);

			placedFeatures = placedFeatures.map((f) => {
				if (f.id === selectedFeatureId) {
					const signX = Math.sign(initialFeatureScaleX);
					const signY = Math.sign(initialFeatureScaleY);
					let newScaleX = Math.max(0.1, Math.min(3, Math.abs(initialFeatureScaleX) * scaleFactor)) * signX;
					let newScaleY = Math.max(0.1, Math.min(3, Math.abs(initialFeatureScaleY) * scaleFactor)) * signY;
					let newRotation = (initialFeatureRotation + angleDiff) % 360;
					if (newRotation < 0) newRotation += 360;

					let newX = initialFeatureX + (currentMidpoint.x - initialPinchMidpoint.x);
					let newY = initialFeatureY + (currentMidpoint.y - initialPinchMidpoint.y);

					return {
						...f,
						scaleX: newScaleX,
						scaleY: newScaleY,
						rotation: newRotation,
						x: newX,
						y: newY
					};
				}
				return f;
			});
			return;
		}

		// Single pointer normal drag
		if (activePointers.size === 1) {
			const svg = document.getElementById('avatar-canvas') as any;
			if (!svg) return;

			const point = svg.createSVGPoint();
			point.x = e.clientX;
			point.y = e.clientY;
			const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());

			const dx = svgPoint.x - dragStartX;
			const dy = svgPoint.y - dragStartY;

			placedFeatures = placedFeatures.map((f) => {
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
	}

	// Update pointer lift transition and history push
	function handlePointerUp(e: PointerEvent) {
		const wasPinching = isPinching;
		activePointers.delete(e.pointerId);

		if (activePointers.size < 2) {
			isPinching = false;
		}

		if (isDragging && activePointers.size === 0) {
			// If pointer released outside the canvas, delete the feature!
			const over = isPointerOverCanvas(e.clientX, e.clientY);
			if (!over && selectedFeatureId) {
				placedFeatures = placedFeatures.filter((f) => f.id !== selectedFeatureId);
				selectedFeatureId = null;
			}
			pushHistoryState();
			isDragging = false;
		} else if (isDragging && wasPinching && activePointers.size === 1) {
			pushHistoryState();
			const remainingPointerId = Array.from(activePointers.keys())[0];
			const remainingPointer = activePointers.get(remainingPointerId);
			if (remainingPointer) {
				const svg = document.getElementById('avatar-canvas') as any;
				if (svg) {
					const point = svg.createSVGPoint();
					point.x = remainingPointer.clientX;
					point.y = remainingPointer.clientY;
					const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
					dragStartX = svgPoint.x;
					dragStartY = svgPoint.y;
				}
				const feature = placedFeatures.find((f) => f.id === selectedFeatureId);
				if (feature) {
					initialFeatureX = feature.x;
					initialFeatureY = feature.y;
				}
			}
		}

		const target = e.target as HTMLElement;
		if (target && typeof target.releasePointerCapture === 'function') {
			try {
				target.releasePointerCapture(e.pointerId);
			} catch {}
		}
	}

	function handlePointerCancel(e: PointerEvent) {
		activePointers.delete(e.pointerId);
		if (activePointers.size < 2) {
			isPinching = false;
		}
		if (activePointers.size === 0) {
			isDragging = false;
		}
	}

	// Canvas button actions
	function changeScale(factor: number) {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map((f) => {
			if (f.id === selectedFeatureId) {
				const signX = Math.sign(f.scaleX);
				const signY = Math.sign(f.scaleY);
				let newScaleX = Math.max(0.1, Math.min(3, Math.abs(f.scaleX) * factor)) * signX;
				let newScaleY = Math.max(0.1, Math.min(3, Math.abs(f.scaleY) * factor)) * signY;
				return { ...f, scaleX: newScaleX, scaleY: newScaleY };
			}
			return f;
		});
		pushHistoryState();
	}

	function rotateFeature(deg: number) {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map((f) => {
			if (f.id === selectedFeatureId) {
				return { ...f, rotation: (f.rotation + deg) % 360 };
			}
			return f;
		});
		pushHistoryState();
	}

	// Mirror Action
	function mirrorFeature() {
		if (!selectedFeatureId) return;
		placedFeatures = placedFeatures.map((f) => {
			if (f.id === selectedFeatureId) {
				return { ...f, scaleX: -f.scaleX };
			}
			return f;
		});
		pushHistoryState();
	}

	// Tab bar drag-scrolling
	function handleTabPointerDown(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		isTabScrolling = true;
		tabScrollStartX = e.pageX - el.offsetLeft;
		tabScrollLeft = el.scrollLeft;
		tabDragDistance = 0;
	}

	function handleTabPointerMove(e: PointerEvent) {
		if (!isTabScrolling) return;
		const el = e.currentTarget as HTMLElement;
		const dx = Math.abs(e.movementX || 0);
		tabDragDistance += dx;

		if (tabDragDistance > 5) {
			try {
				if (!el.hasPointerCapture(e.pointerId)) {
					el.setPointerCapture(e.pointerId);
				}
			} catch {}
			const x = e.pageX - el.offsetLeft;
			const walk = (x - tabScrollStartX) * 1.5;
			el.scrollLeft = tabScrollLeft - walk;
		}
	}

	function handleTabPointerUp(e: PointerEvent) {
		isTabScrolling = false;
		const el = e.currentTarget as HTMLElement;
		try {
			if (el.hasPointerCapture(e.pointerId)) {
				el.releasePointerCapture(e.pointerId);
			}
		} catch {}
	}

	function handleBack() {
		window.location.href = '/';
	}

	// Save avatar function
	async function handleSave() {
		const name = profileName.trim();
		if (!name) {
			nameError = true;
			// Focus name input field
			const inputEl = document.querySelector('.profile-name-input') as HTMLInputElement;
			if (inputEl) {
				inputEl.focus();
			}
			return;
		}

		saveStatus = 'Generating...';
		try {
			const svgEl = document.getElementById('avatar-canvas');
			if (!svgEl) throw new Error('Canvas not found');

			const clone = svgEl.cloneNode(true) as SVGElement;

			// Add self-contained styles with exact selected colors
			const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
			style.textContent = `
				.skin-color { fill: ${skinColor} !important; }
				.hair-color { fill: ${hairColor} !important; }
				.eye-color { fill: ${eyeColor} !important; }
				.eyebrow-color { fill: ${eyebrowColor} !important; }
				.canvas-bg { fill: ${bgColor} !important; }
			`;
			clone.appendChild(style);

			// Remove guide circle and class attributes from saved output
			const guideCircle = clone.querySelector('.canvas-guide-circle');
			if (guideCircle) guideCircle.remove();

			const groups = clone.querySelectorAll('g');
			groups.forEach((g) => {
				g.removeAttribute('filter');
				g.removeAttribute('class');
			});

			const serializer = new XMLSerializer();
			const svgString = serializer.serializeToString(clone);
			const base64Image =
				'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

			saveStatus = 'Saving...';

			const config = {
				features: placedFeatures.map(f => ({
					id: f.id,
					category: f.category,
					templateId: f.templateId,
					x: f.x,
					y: f.y,
					scaleX: f.scaleX,
					scaleY: f.scaleY,
					rotation: f.rotation,
					zIndex: f.zIndex
				})),
				skinColor,
				hairColor,
				eyeColor,
				eyebrowColor,
				bgColor
			};

			if (isNewProfile) {
				// 1. Create Profile
				const createRes = await fetch('/api/profiles', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, color: bgColor })
				});
				if (!createRes.ok) {
					const data = await createRes.json();
					throw new Error(data.error || 'Failed to create profile.');
				}
				const createdProfile = await createRes.json();

				// 2. Select profile (sets cookie session)
				const selectRes = await fetch(`/api/profiles/${createdProfile.id}/select`, {
					method: 'POST'
				});
				if (!selectRes.ok) {
					const data = await selectRes.json();
					throw new Error(data.error || 'Failed to select profile.');
				}

				// Sync to local/session storage for backward compatibility with the game room
				sessionStorage.setItem('skitgubbe_playerId', createdProfile.id);
				sessionStorage.setItem('skitgubbe_playerName', createdProfile.name);
				sessionStorage.setItem('skitgubbe_playerColor', createdProfile.color);
			} else {
				// 1. Update Profile name & color
				const updateRes = await fetch('/api/profiles/me', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, color: bgColor })
				});
				if (!updateRes.ok) {
					const data = await updateRes.json();
					throw new Error(data.error || 'Failed to update profile name.');
				}
				
				// Sync to local/session storage
				if (activeProfile) {
					sessionStorage.setItem('skitgubbe_playerName', name);
					sessionStorage.setItem('skitgubbe_playerColor', bgColor);
				}
			}

			// Save Avatar Configuration
			const res = await fetch('/api/profiles/me/avatar', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					avatar_config: config
				})
			});

			if (res.ok) {
				saveStatus = 'Success!';
				window.location.href = '/';
			} else {
				const err = await res.json();
				saveStatus = `Error: ${err.error || 'Failed'}`;
			}
		} catch (e: any) {
			console.error('Save failed:', e);
			saveStatus = `Failed: ${e.message}`;
		}
	}
</script>

<svelte:window
	onpointermove={handlePointerMove}
	onpointerup={handlePointerUp}
	onpointerdown={handleGlobalPointerDown}
	onpointercancel={handlePointerCancel}
/>

<!-- Library Dragging Floating Preview -->
{#if pendingLibraryDrag && libDragHasMoved && !isOverCanvas}
	<div
		class="pointer-events-none fixed z-[1000] flex h-[90px] w-[90px] items-center justify-center bg-transparent select-none"
		style="left: {cursorX}px; top: {cursorY}px; transform: translate(-50%, -50%); opacity: 0.85; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35)); touch-action: none;"
	>
		<svg viewBox="0 0 200 200" class="h-full w-full" xmlns="http://www.w3.org/2000/svg">
			<style>
				.skin-color { fill: {skinColor}; }
				.hair-color { fill: {hairColor}; }
				.eye-color { fill: {eyeColor}; }
				.eyebrow-color { fill: {eyebrowColor}; }
			</style>
			{@html pendingLibraryDrag.template.svgContent}
		</svg>
	</div>
{/if}

<div
	class="relative z-10 flex h-screen w-screen flex-row items-stretch gap-6 overflow-hidden bg-[#a0b2c6] p-4 font-sans text-slate-800 select-none"
>
	{#if isLoading}
		<div class="flex flex-grow flex-col items-center justify-center gap-4">
			<div class="h-12 w-12 animate-spin border-4 border-slate-600/20 border-t-slate-700"></div>
			<span class="font-serif text-sm font-bold tracking-widest text-slate-700 uppercase"
				>Loading Editor...</span
			>
		</div>
	{:else}
		<!-- Left: Back Button, scrollable tabs and asset grid selection -->
		<div class="flex h-full w-[320px] shrink-0 flex-col justify-start gap-1 pt-1 md:w-[360px]">
			<div class="flex w-full items-center min-h-[34px] relative mb-0">
				<button
					onclick={handleBack}
					class="cursor-pointer border-0 bg-transparent p-0 text-2xl font-bold text-slate-800 transition-colors outline-none select-none hover:text-amber-600 absolute left-0 z-10"
					aria-label="Back to home"
				>
					←
				</button>

				<div class="w-full flex justify-center">
					<div class="profile-name-input-container" class:error={nameError}>
						<input
							type="text"
							bind:value={profileName}
							oninput={() => (nameError = false)}
							placeholder="Enter Name"
							maxlength="15"
							class="profile-name-input font-serif"
						/>
					</div>
				</div>
			</div>

			<!-- Slanted Tabs Selector (gap-0 makes buttons lie adjacent to each other) -->
			<div
				role="tablist"
				tabindex="-1"
				onpointerdown={handleTabPointerDown}
				onpointermove={handleTabPointerMove}
				onpointerup={handleTabPointerUp}
				class="flex h-[48px] shrink-0 cursor-grab scrollbar-none flex-row flex-nowrap items-center gap-0 overflow-x-auto border-b border-[#8297af] px-4 py-2 select-none active:cursor-grabbing"
				style="scrollbar-width: none; -ms-overflow-style: none; touch-action: none;"
			>
				{#each AVATAR_FEATURES as cat}
					<button
						onclick={(e) => {
							if (tabDragDistance > 5) {
								e.preventDefault();
								return;
							}
							activeCategory = cat.id;
						}}
						class="premium-tab-btn shrink-0 cursor-pointer border px-4 py-1.5 font-serif text-xs font-semibold transition-all outline-none select-none"
						class:active={activeCategory === cat.id}
					>
						{#if cat.id === 'head'}Head
						{:else if cat.id === 'eyes'}Eyes
						{:else if cat.id === 'eyebrows'}Brows
						{:else if cat.id === 'nose'}Nose
						{:else if cat.id === 'mouth'}Lips
						{:else if cat.id === 'hair_front'}Bangs
						{:else if cat.id === 'hair_back'}Hair
						{/if}
					</button>
				{/each}

				<!-- Background Color tab -->
				<button
					onclick={(e) => {
						if (tabDragDistance > 5) {
							e.preventDefault();
							return;
						}
						activeCategory = 'background';
						selectedFeatureId = null;
					}}
					class="premium-tab-btn shrink-0 cursor-pointer border px-4 py-1.5 font-serif text-xs font-semibold transition-all outline-none select-none"
					class:active={activeCategory === 'background'}
				>
					Background
				</button>
			</div>

			<!-- Grid of Assets (No rounded corners, slightly darker background) -->
			<div
				class="align-content-start grid flex-grow grid-cols-3 gap-2 overflow-y-auto border border-[#8297af] bg-[#8297af]/20 p-2"
				style="touch-action: none;"
			>
				{#if activeCategory === 'background'}
					<div class="col-span-3 grid grid-cols-6 gap-1.5 w-full">
						{#each GRID_LIGHTNESSES as l}
							{#each GRID_HUES as h}
								{@const cellColor = hslToHex(h, 80, l)}
								<button
									onclick={() => handleSelectGridColor(h, l)}
									class="w-full aspect-square cursor-pointer border transition-all outline-none hover:scale-105"
									style="background-color: {cellColor}; border-color: {bgHue === h && bgLightness === l ? '#0f172a' : '#8297af'}; border-width: 1px; box-shadow: {bgHue === h && bgLightness === l ? 'inset 0 0 0 2px #ffffff' : 'none'}; border-radius: 0px;"
									aria-label="Select base background color"
								></button>
							{/each}
						{/each}
					</div>
				{:else}
					{#each AVATAR_FEATURES.find((c) => c.id === activeCategory)?.features || [] as item}
						<button
							onpointerdown={(e) => handleLibraryPointerDown(activeCategory, item, e)}
							onpointermove={(e) => handleLibraryPointerMove(e)}
							onpointerup={(e) => handleLibraryPointerUp(e)}
							class="group relative flex aspect-square cursor-pointer items-center justify-center border border-[#8297af] bg-transparent p-1 transition-all outline-none select-none hover:bg-[#8297af]/30"
							style="border-radius: 0px; touch-action: none;"
						>
							<svg
								viewBox="0 0 200 200"
								class="pointer-events-none h-full w-full"
								xmlns="http://www.w3.org/2000/svg"
							>
								<style>
									.skin-color {
										fill: #fcd34d;
									}
									.hair-color {
										fill: #5b21b6;
									}
									.eye-color {
										fill: #10b981;
									}
									.eyebrow-color {
										fill: #10b981;
									}
								</style>
								{@html item.svgContent}
							</svg>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Middle: Composition Canvas (centered, maximized, square, no buttons underneath) -->
		<div class="flex-grow flex items-center justify-center relative h-full">
			<!-- Floating Saving/Status Banner -->
			{#if saveStatus}
				<div
					class="absolute top-2 z-50 animate-pulse border border-[#8297af] bg-slate-900/90 px-4 py-1.5 font-serif text-xs tracking-wider text-amber-400"
				>
					{saveStatus}
				</div>
			{/if}

			<!-- Canvas Frame: Guaranteed Square with Responsive Scaling limits -->
			<div
				class="relative flex items-center justify-center border border-[#8297af] bg-white shadow-lg select-none"
				style="touch-action: none; width: calc(min(80vh, 100vw - 500px)); height: calc(min(80vh, 100vw - 500px));"
			>
				<button
					type="button"
					class="absolute inset-0 z-0 h-full w-full cursor-default border-0 bg-transparent p-0 outline-none"
					onclick={() => (selectedFeatureId = null)}
					aria-label="Clear selection"
				></button>

				<svg
					id="avatar-canvas"
					viewBox="0 0 200 200"
					class="pointer-events-auto relative z-10 h-full w-full select-none"
					xmlns="http://www.w3.org/2000/svg"
					onpointerdown={handleCanvasPointerDown}
					style="touch-action: none; --skin-color: {skinColor}; --hair-color: {hairColor}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor};"
					role="img"
					aria-label="Character Avatar Composition Canvas"
				>
					<defs>
						<filter id="blur-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
						<filter id="lip-glow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="soft-nose" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
						<filter id="eye-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-1" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-2" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-3" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-6" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-8" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-9" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="brow-soft-10" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
						<filter id="selection-glow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow
								dx="0"
								dy="0"
								stdDeviation="2.5"
								flood-color="#b88728"
								flood-opacity="0.9"
							/>
						</filter>

						<clipPath id="eye-clip-1">
							<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" />
						</clipPath>
						<clipPath id="eye-clip-3">
							<path d="M 20 110 L 180 100 C 140 150, 60 150, 20 110 Z" />
						</clipPath>
						<clipPath id="eye-clip-4">
							<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 120, 70 120, 20 100 Z" />
						</clipPath>
						<clipPath id="eye-clip-6">
							<path d="M 20 80 C 80 50, 140 90, 180 140 C 120 150, 60 120, 20 80 Z" />
						</clipPath>
						<clipPath id="eyeClip7">
							<path d="M 20 100 C 40 20 150 30 180 120 C 140 180 60 160 20 100 Z" />
						</clipPath>
						<clipPath id="eyeClip6">
							<path d="M 20 80 C 80 40 160 100 180 120 C 140 160 60 140 20 80 Z" />
						</clipPath>
						<clipPath id="eyeClip10">
							<path d="M 20 100 C 60 60 140 70 180 110 C 140 140 60 140 20 100 Z" />
						</clipPath>
					</defs>

					<style>
						.skin-color {
							fill: var(--skin-color, #ffcdb2);
						}
						.hair-color {
							fill: var(--hair-color, #3e2723);
						}
						.eye-color {
							fill: var(--eye-color, #4caf50);
						}
						.eyebrow-color {
							fill: var(--eyebrow-color, #5d4037);
						}
					</style>

					<!-- Backdrop color rect -->
					<rect class="canvas-bg" width="200" height="200" fill={bgColor} />

					<!-- Backdrop click catcher -->
					<rect id="avatar-canvas-rect" width="200" height="200" fill="transparent" />

					<!-- Render features -->
					{#each sortedFeatures as f (f.id)}
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

					<!-- Profile Circular Crop Guide overlay -->
					<circle
						cx="100"
						cy="100"
						r="95"
						fill="none"
						stroke="#8297af"
						stroke-width="1"
						stroke-dasharray="3 3"
						opacity="0.5"
						class="canvas-guide-circle pointer-events-none"
					/>
				</svg>

				<!-- Canvas Delete Button: inside top-right corner, red and borderless/backgroundless -->
				{#if selectedFeatureId}
					<button
						onclick={removeSelectedFeature}
						class="absolute top-2 right-2 z-20 cursor-pointer border-0 bg-transparent p-0 text-3xl font-bold text-red-500 transition-colors outline-none select-none hover:text-red-700"
						title="Delete selected feature"
					>
						✕
					</button>
				{/if}
			</div>
		</div>

		<!-- Right: Dual column layout with colors and vertical controls (Save on top, Undo/Redo at bottom) -->
		<div
			class="flex h-full w-[80px] sm:w-[92px] md:w-[104px] shrink-0 flex-row gap-2 sm:gap-3 border-l border-[#8297af] pl-2 sm:pl-3 pr-2 py-4 sm:py-5 justify-between items-stretch"
		>
			<!-- Column A: Colors -->
			<div
				class="flex-grow flex scrollbar-none flex-col items-center gap-1.5 md:gap-2 overflow-y-auto pr-0.5"
			>
				{#each activePresets as color, i}
					{@const isSelected = activeColorMode === 'background'
						? bgSaturation === SATURATION_PRESETS[i]
						: activeColorValue.toLowerCase() === color.toLowerCase()}
					<button
						onclick={() => handleSelectColor(color)}
						class="h-[28px] w-[28px] sm:h-[32px] sm:w-[32px] md:h-[36px] md:w-[36px] shrink-0 cursor-pointer border transition-all outline-none hover:scale-105"
						style="background-color: {color}; border-color: {isSelected ? '#0f172a' : '#8297af'}; border-width: 1px; box-shadow: {isSelected ? 'inset 0 0 0 2px #ffffff' : 'none'}; border-radius: 0px;"
						aria-label="Select Color {color}"
					></button>
				{/each}
			</div>

			<!-- Column B: Controls (Save at the top, Mirror/Rotate/Scale in middle, Undo/Redo at the bottom) -->
			<div class="w-[28px] sm:w-[32px] md:w-[36px] flex flex-col justify-between items-center h-full gap-2 shrink-0">
				<!-- Top Stack: Save and Action Buttons (Mirror, Rotate L/R, Scale L/R) -->
				<div class="flex flex-col gap-1.5 sm:gap-2 items-center w-full">
					<!-- Save Button -->
					<button
						onclick={handleSave}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none"
						title="Save"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
						</svg>
					</button>

					<!-- Mirror -->
					<button
						onclick={mirrorFeature}
						disabled={!selectedFeatureId}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Mirror"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<rect x="11.25" y="2" width="1.5" height="20" opacity="0.3" />
							<path d="M9 6L3 12L9 18V6z" />
							<path d="M15 6L21 12L15 18V6z" class="opacity-80" />
						</svg>
					</button>
					<!-- Rotate Left -->
					<button
						onclick={() => rotateFeature(-15)}
						disabled={!selectedFeatureId}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Rotate Left"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4.5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
						</svg>
					</button>
					<!-- Rotate Right -->
					<button
						onclick={() => rotateFeature(15)}
						disabled={!selectedFeatureId}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Rotate Right"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path
								d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4.5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
								transform="translate(12, 12) scale(-1, 1) translate(-12, -12)"
							/>
						</svg>
					</button>
					<!-- Grow -->
					<button
						onclick={() => changeScale(1.05)}
						disabled={!selectedFeatureId}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Grow"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
						</svg>
					</button>
					<!-- Shrink -->
					<button
						onclick={() => changeScale(0.95)}
						disabled={!selectedFeatureId}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Shrink"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M19 13H5v-2h14v2z"/>
						</svg>
					</button>
				</div>

				<!-- Bottom Stack: Undo and Redo -->
				<div class="flex flex-col gap-1.5 sm:gap-2 items-center w-full">
					<!-- Undo -->
					<button
						onclick={undo}
						disabled={historyIndex <= 0}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Undo"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
						</svg>
					</button>
					<!-- Redo -->
					<button
						onclick={redo}
						disabled={historyIndex >= history.length - 1}
						class="flex items-center justify-center w-[28px] h-[28px] sm:w-[32px] sm:h-[32px] md:w-[36px] md:h-[36px] cursor-pointer border-0 bg-transparent p-0.5 text-slate-800 hover:text-amber-700 transition-colors outline-none select-none disabled:opacity-30 disabled:pointer-events-none"
						title="Redo"
					>
						<svg viewBox="0 0 24 24" class="w-[20px] h-[20px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] fill-current">
							<path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap');

	.font-serif {
		font-family: 'Cormorant Garamond', Georgia, serif;
	}

	.cursor-grab {
		cursor: grab;
	}

	.cursor-grabbing {
		cursor: grabbing;
	}

	/* Slanted tabs silver metallic styling sitting adjacent to each other */
	.premium-tab-btn {
		background: rgba(10, 30, 20, 0.45);
		border: 1px solid #8297af;
		border-right-width: 0px;
		color: #1e293b;
		transform: skewX(-15deg);
	}

	.premium-tab-btn:last-child {
		border-right-width: 1px;
	}

	.premium-tab-btn:hover {
		color: #ffffff;
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(255, 255, 255, 0.1);
	}

	.premium-tab-btn.active {
		background: linear-gradient(135deg, #ffffff, #cbd5e1, #94a3b8);
		border-color: #cbd5e1;
		border-right-width: 1px;
		color: #0f172a;
		font-weight: 700;
		box-shadow: 0 2px 8px rgba(148, 163, 184, 0.25);
	}

	/* Prevent doubling of borders after active item */
	.premium-tab-btn.active + .premium-tab-btn {
		border-left-width: 0px;
	}

	/* Hide scrollbar utility */
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}

	/* Skewed Name Input Field matching the start screen game room buttons style */
	.profile-name-input-container {
		position: relative;
		display: flex;
		align-items: center;
		padding: 0.25rem 1.25rem;
		background: linear-gradient(90deg, rgba(20, 20, 20, 0.85) 0%, rgba(28, 28, 28, 0.65) 100%);
		transform: skewX(-15deg);
		border: none;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
		overflow: hidden;
		width: 190px;
		height: 34px;
	}

	.profile-name-input-container::before {
		content: '';
		position: absolute;
		inset: 0;
		border-left: 3.5px solid;
		border-image: linear-gradient(to bottom, 
			#ffffff 0%,
			#cbd5e1 35%,
			#94a3b8 65%,
			#475569 100%
		) 1;
		pointer-events: none;
	}

	.profile-name-input {
		width: 100%;
		background: transparent;
		border: none;
		color: #ffffff;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		transform: skewX(15deg);
		outline: none;
		text-align: center;
	}

	.profile-name-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	/* Pulsing Red Glow error styles */
	.profile-name-input-container.error {
		animation: pulse-red-glow 1.5s infinite ease-in-out;
	}

	.profile-name-input-container.error::before {
		border-image: none;
		border-left: 3.5px solid #ef4444;
	}

	@keyframes pulse-red-glow {
		0% {
			box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
		}
		50% {
			box-shadow: 0 0 20px rgba(239, 68, 68, 1);
		}
		100% {
			box-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
		}
	}
</style>
