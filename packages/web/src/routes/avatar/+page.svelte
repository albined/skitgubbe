<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import {
		AVATAR_FEATURES,
		getAvatarFeaturesMap,
		HAIR_PRESETS,
		getHairShades,
		LIP_PRESETS,
		getLipShades,
		namespaceSvgGradients,
		type AvatarFeatureTemplate,
		type AvatarConfig,
		type PlacedFeature,
		loadAvatarFeatures
	} from '$lib/avatarFeatures.svelte';
	import type { ApiProfile } from 'shared';
	import {
		snapHue,
		snapLightness,
		snapSaturation,
		hexToHSL,
		hslToHex,
		GRID_HUES,
		GRID_LIGHTNESSES,
		SATURATION_PRESETS
	} from '$lib/colorMath';
	import { FeatureHistory, type AvatarState } from '$lib/featureHistory.svelte';
	import { AvatarGestureController } from '$lib/avatarGestureController.svelte';

	loadAvatarFeatures();

	// State Variables
	let activeProfile = $state<ApiProfile | null>(null);
	let isLoading = $state(true);
	let isNewProfile = $state(false);
	let profileName = $state('');
	let nameError = $state(false);

	// Customization Colors
	let skinColor = $state('#FFCDB2');
	let hairColor = $state('#3E2723');
	let eyeColor = $state('#4CAF50');
	let eyebrowColor = $state('#5D4037');
	let lipColor = $state('#e64a19');
	let bgColor = $state('#FFFFFF');

	const hairColors = $derived(getHairShades(hairColor));
	const lipColors = $derived(getLipShades(lipColor));
	let bgHue = $state(210);
	let bgSaturation = $state(20);
	let bgLightness = $state(98);

	function handleSelectGridColor(h: number, l: number) {
		gestureController.selectedFeatureId = null;
		bgHue = h;
		bgLightness = l;
		bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
		pushHistoryState();
	}

	const gestureController = new AvatarGestureController(pushHistoryState);

	// Undo/Redo State History
	const historyManager = new FeatureHistory((templateId) => {
		const template = getAvatarFeaturesMap().get(templateId);
		return template ? { svgContent: template.svgContent, name: template.name } : undefined;
	});

	// UI State
	let activeCategory = $state('head');
	let saveStatus = $state('');

	// Tab Bar scroll dragging state
	let isTabScrolling = false;
	let tabScrollStartX = 0;
	let tabScrollLeft = 0;
	let tabDragDistance = 0;

	// Custom Scrollbar state
	let gridContainerEl = $state<HTMLDivElement | null>(null);
	let scrollbarTrackEl = $state<HTMLDivElement | null>(null);
	let gridScrollTop = $state(0);
	let gridScrollHeight = $state(0);
	let gridClientHeight = $state(0);
	let isScrollbarDragging = $state(false);
	let scrollDragStartY = 0;
	let scrollDragStartTop = 0;

	// Dynamic vertical layout sizing variables
	let windowWidth = $state(0);
	let rightPanelHeight = $state(0);

	const defaultButtonSize = $derived.by(() => {
		if (windowWidth >= 768) return 36;
		if (windowWidth >= 640) return 32;
		return 28;
	});

	const dynamicButtonSize = $derived.by(() => {
		if (rightPanelHeight <= 0) return defaultButtonSize;
		const verticalPadding = rightPanelHeight < 500 ? 24 : 40;
		const gap = rightPanelHeight < 500 ? 4 : 8;
		const totalGapsHeight = 7 * gap;
		const availableHeight = rightPanelHeight - verticalPadding - totalGapsHeight;
		const maxPossibleSize = Math.floor(availableHeight / 8);

		return Math.max(18, Math.min(defaultButtonSize, maxPossibleSize));
	});

	const svgSize = $derived(Math.max(12, dynamicButtonSize - 8));
	const gapSize = $derived(dynamicButtonSize >= 28 ? 8 : 4);

	const defaultPanelWidth = $derived.by(() => {
		if (windowWidth >= 768) return 104;
		if (windowWidth >= 640) return 92;
		return 80;
	});

	const dynamicPanelWidth = $derived.by(() => {
		if (dynamicButtonSize === defaultButtonSize) {
			return defaultPanelWidth;
		}
		const gapBetweenCols = dynamicButtonSize >= 28 ? 8 : 4;
		const horizontalPadding = windowWidth >= 640 ? 20 : 16;
		return 2 * dynamicButtonSize + gapBetweenCols + horizontalPadding;
	});

	const showScrollbar = $derived(gridScrollHeight > gridClientHeight);

	const thumbHeight = $derived(
		gridScrollHeight > 0
			? Math.max(30, (gridClientHeight / gridScrollHeight) * gridClientHeight)
			: 0
	);

	const thumbTop = $derived.by(() => {
		const maxScrollTop = gridScrollHeight - gridClientHeight;
		if (maxScrollTop <= 0) return 0;
		const maxThumbTop = gridClientHeight - thumbHeight;
		return (gridScrollTop / maxScrollTop) * maxThumbTop;
	});

	function updateScrollbarDimensions() {
		if (gridContainerEl) {
			gridScrollTop = gridContainerEl.scrollTop;
			gridScrollHeight = gridContainerEl.scrollHeight;
			gridClientHeight = gridContainerEl.clientHeight;
		}
	}

	function handleGridScroll() {
		if (gridContainerEl) {
			gridScrollTop = gridContainerEl.scrollTop;
		}
	}

	function handleScrollbarPointerDown(e: PointerEvent) {
		if (!gridContainerEl || !scrollbarTrackEl) return;
		e.preventDefault();
		e.stopPropagation();

		const trackRect = scrollbarTrackEl.getBoundingClientRect();
		const clickY = e.clientY - trackRect.top;

		const scrollHeight = gridContainerEl.scrollHeight;
		const clientHeight = gridContainerEl.clientHeight;
		const maxScrollTop = scrollHeight - clientHeight;

		const thumbHeightVal = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
		const maxThumbTop = clientHeight - thumbHeightVal;

		// Current thumb position
		const currentThumbTop =
			maxThumbTop > 0 && maxScrollTop > 0
				? (gridContainerEl.scrollTop / maxScrollTop) * maxThumbTop
				: 0;

		let targetThumbTop = currentThumbTop;
		if (clickY < currentThumbTop || clickY > currentThumbTop + thumbHeightVal) {
			// Clicked outside the thumb: center the thumb on the click position
			targetThumbTop = Math.max(0, Math.min(maxThumbTop, clickY - thumbHeightVal / 2));
			if (maxThumbTop > 0) {
				gridContainerEl.scrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;
			}
			updateScrollbarDimensions();
		}

		isScrollbarDragging = true;
		scrollDragStartY = e.clientY;
		scrollDragStartTop = targetThumbTop;

		try {
			scrollbarTrackEl.setPointerCapture(e.pointerId);
		} catch (err) {
			console.error('setPointerCapture failed on scrollbar track', err);
		}
	}

	function handleScrollbarPointerMove(e: PointerEvent) {
		if (!isScrollbarDragging || !gridContainerEl || !scrollbarTrackEl) return;
		e.preventDefault();
		e.stopPropagation();

		const clientHeight = gridContainerEl.clientHeight;
		const scrollHeight = gridContainerEl.scrollHeight;
		const maxScrollTop = scrollHeight - clientHeight;

		const thumbHeightVal = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
		const maxThumbTop = clientHeight - thumbHeightVal;

		const deltaY = e.clientY - scrollDragStartY;
		const targetThumbTop = Math.max(0, Math.min(maxThumbTop, scrollDragStartTop + deltaY));

		if (maxThumbTop > 0) {
			gridContainerEl.scrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;
		}
		updateScrollbarDimensions();
	}

	function handleScrollbarPointerUp(e: PointerEvent) {
		if (isScrollbarDragging) {
			isScrollbarDragging = false;
			if (scrollbarTrackEl) {
				try {
					scrollbarTrackEl.releasePointerCapture(e.pointerId);
				} catch {}
			}
		}
	}

	$effect(() => {
		if (!gridContainerEl) return;

		const observer = new ResizeObserver(() => {
			updateScrollbarDimensions();
		});
		observer.observe(gridContainerEl);

		return () => {
			observer.disconnect();
		};
	});

	// Switching category swaps the grid content, which changes scrollHeight
	// without firing the ResizeObserver (the container's own box is unchanged)
	// — re-measure after the DOM updates or the scrollbar goes stale.
	$effect(() => {
		void activeCategory;
		tick().then(updateScrollbarDimensions);
	});

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
	const HAIR_BASE_COLORS = HAIR_PRESETS.map((p) => p.base);
	const BROW_PRESETS = HAIR_BASE_COLORS; // Brow colors identical to hair base colors
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
		// Register non-passive wheel event listener
		window.addEventListener('wheel', gestureController.handleWheel, { passive: false });

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
			lipColor = '#e64a19';
			bgColor = '#FFFFFF';
			gestureController.placedFeatures = [];
			gestureController.selectedFeatureId = null;

			// Initialize history stack
			historyManager.reset({
				features: [],
				skinColor,
				hairColor,
				eyeColor,
				eyebrowColor,
				lipColor,
				bgColor
			});
			isLoading = false;
		} else {
			await loadProfile();
			isLoading = false;
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('wheel', gestureController.handleWheel);
		}
	});

	async function loadProfile() {
		try {
			const res = await fetch('/api/profiles/me');
			if (res.ok) {
				const profile: ApiProfile = await res.json();
				activeProfile = profile;
				profileName = profile.name || '';

				// Apply loaded avatar config or start completely clear
				if (profile.avatar_config) {
					try {
						const config: AvatarConfig = JSON.parse(profile.avatar_config);
						gestureController.placedFeatures = (config.features || []).map((f): PlacedFeature => {
							const template = getAvatarFeaturesMap().get(f.templateId);
							return {
								...f,
								svgContent: template ? template.svgContent : f.svgContent || '',
								name: template ? template.name : f.name || ''
							};
						});
						skinColor = config.skinColor || '#FFCDB2';
						hairColor = config.hairColor || '#3E2723';
						eyeColor = config.eyeColor || '#4CAF50';
						eyebrowColor = config.eyebrowColor || '#5D4037';
						lipColor = config.lipColor || '#e64a19';
						bgColor = config.bgColor || '#FFFFFF';
						const hsl = hexToHSL(bgColor);
						bgHue = snapHue(hsl.h);
						bgLightness = snapLightness(hsl.l);
						bgSaturation = snapSaturation(hsl.s);
						bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
					} catch (e) {
						console.error('Failed to parse avatar config:', e);
						gestureController.placedFeatures = [];
					}
				} else {
					gestureController.placedFeatures = [];
				}

				// Initialize history state stack
				historyManager.reset({
					features: gestureController.placedFeatures,
					skinColor,
					hairColor,
					eyeColor,
					eyebrowColor,
					lipColor,
					bgColor
				});
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
		historyManager.push({
			features: gestureController.placedFeatures,
			skinColor,
			hairColor,
			eyeColor,
			eyebrowColor,
			lipColor,
			bgColor
		});
	}

	function undo() {
		const undone = historyManager.undo();
		if (undone) {
			applyState(undone);
		}
	}

	function redo() {
		const redone = historyManager.redo();
		if (redone) {
			applyState(redone);
		}
	}

	function applyState(state: AvatarState) {
		gestureController.placedFeatures = JSON.parse(JSON.stringify(state.features));
		skinColor = state.skinColor;
		hairColor = state.hairColor;
		eyeColor = state.eyeColor;
		eyebrowColor = state.eyebrowColor;
		lipColor = state.lipColor || '#e64a19';
		bgColor = state.bgColor || '#FFFFFF';
		const hsl = hexToHSL(bgColor);
		bgHue = snapHue(hsl.h);
		bgLightness = snapLightness(hsl.l);
		bgSaturation = snapSaturation(hsl.s);
		bgColor = hslToHex(bgHue, bgSaturation, bgLightness);
		if (
			gestureController.selectedFeatureId &&
			!gestureController.placedFeatures.some((f) => f.id === gestureController.selectedFeatureId)
		) {
			gestureController.selectedFeatureId = null;
		}
	}

	// Fixed sorting (bottom-to-top rendering order)
	const CATEGORY_ORDER = [
		'hair_back',
		'head',
		'mouth',
		'beard',
		'eyes',
		'nose',
		'other',
		'eyebrows',
		'glasses',
		'hair_front'
	];

	const sortedFeatures = $derived(
		[...gestureController.placedFeatures].sort((a, b) => {
			return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
		})
	);

	const selectedFeature = $derived(
		gestureController.placedFeatures.find((f) => f.id === gestureController.selectedFeatureId) ||
			null
	);

	// Contextual active color modes derived automatically
	const activeColorMode = $derived.by(() => {
		const cat = selectedFeature ? selectedFeature.category : activeCategory;
		if (cat === 'head' || cat === 'nose') {
			return 'skin';
		} else if (cat === 'hair_front' || cat === 'hair_back' || cat === 'beard') {
			return 'hair';
		} else if (cat === 'eyes') {
			return 'eyes';
		} else if (cat === 'eyebrows') {
			return 'eyebrow';
		} else if (cat === 'mouth') {
			return 'lip';
		} else if (cat === 'background') {
			return 'background';
		} else if (cat === 'glasses' || cat === 'other') {
			return 'none';
		}
		return 'skin';
	});

	const activePresets = $derived.by(() => {
		if (activeColorMode === 'none') return [];
		if (activeColorMode === 'skin') return SKIN_PRESETS;
		if (activeColorMode === 'hair') return HAIR_BASE_COLORS;
		if (activeColorMode === 'eyes') return EYE_PRESETS;
		if (activeColorMode === 'eyebrow') return BROW_PRESETS;
		if (activeColorMode === 'lip') return LIP_PRESETS.map((p) => p.base);
		if (activeColorMode === 'background') {
			return SATURATION_PRESETS.map((s) => hslToHex(bgHue, s, bgLightness));
		}
		return SKIN_PRESETS;
	});

	const activeColorValue = $derived.by(() => {
		if (activeColorMode === 'none') return '';
		if (activeColorMode === 'skin') return skinColor;
		if (activeColorMode === 'hair') return hairColor;
		if (activeColorMode === 'eyes') return eyeColor;
		if (activeColorMode === 'eyebrow') return eyebrowColor;
		if (activeColorMode === 'lip') return lipColor;
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
		} else if (activeColorMode === 'lip') {
			lipColor = color;
		} else if (activeColorMode === 'background') {
			bgColor = color;
			const hsl = hexToHSL(color);
			bgHue = snapHue(hsl.h);
			bgLightness = snapLightness(hsl.l);
			bgSaturation = snapSaturation(hsl.s);
		}
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

		try {
			saveStatus = 'Saving...';

			const config = {
				features: gestureController.placedFeatures.map((f) => ({
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
				lipColor,
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
		} catch (e) {
			console.error('Save failed:', e);
			saveStatus = `Failed: ${e instanceof Error ? e.message : String(e)}`;
		}
	}
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	onpointermove={(e) => gestureController.handlePointerMove(e)}
	onpointerup={(e) => gestureController.handlePointerUp(e)}
	onpointerdown={(e) => gestureController.handleGlobalPointerDown(e)}
	onpointercancel={(e) => gestureController.handlePointerCancel(e)}
/>

<!-- Library Dragging Floating Preview -->
{#if gestureController.pendingLibraryDrag && gestureController.libDragHasMoved && !gestureController.isOverCanvas}
	<div
		class="pointer-events-none fixed z-[1000] flex h-[90px] w-[90px] items-center justify-center bg-transparent select-none"
		style="left: {gestureController.cursorX}px; top: {gestureController.cursorY}px; transform: translate(-50%, -50%); opacity: 0.85; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35)); touch-action: none;"
	>
		<svg
			viewBox="0 0 200 200"
			class="h-full w-full"
			xmlns="http://www.w3.org/2000/svg"
			style="--skin-color: {skinColor}; --hair-color: {hairColor}; --hair-shadow: {hairColors.shadow}; --hair-light: {hairColors.light}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor}; --lip-color-light: {lipColor}; --lip-color-dark: {lipColors.dark};"
		>
			<style>
				.skin-color {
					fill: var(--skin-color);
				}
				.hair-color {
					fill: var(--hair-color);
					stop-color: var(--hair-color);
				}
				.hair-shadow {
					fill: var(--hair-shadow);
					stop-color: var(--hair-shadow);
				}
				.hair-light {
					fill: var(--hair-light);
					stop-color: var(--hair-light);
				}
				.eye-color {
					fill: var(--eye-color);
				}
				.eyebrow-color {
					fill: var(--eyebrow-color);
				}
				.lip-color-light {
					fill: var(--lip-color-light);
				}
				.lip-color-dark {
					fill: var(--lip-color-dark);
				}
			</style>
			{@html namespaceSvgGradients(
				gestureController.pendingLibraryDrag.template.svgContent,
				'drag'
			)}
		</svg>
	</div>
{/if}

<div
	class="relative z-10 flex h-dvh w-screen flex-row items-stretch gap-6 overflow-hidden bg-[#a0b2c6] p-4 font-sans text-slate-800 select-none"
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
			<div class="relative mb-0 flex min-h-[34px] w-full items-center">
				<button
					onclick={handleBack}
					class="absolute left-0 z-10 cursor-pointer border-0 bg-transparent p-0 text-2xl font-bold text-slate-800 transition-colors outline-none select-none hover:text-amber-600"
					aria-label="Back to home"
				>
					←
				</button>

				<div class="flex w-full justify-center">
					<div class="profile-name-input-container" class:error={nameError}>
						<input
							type="text"
							bind:value={profileName}
							oninput={() => (nameError = false)}
							placeholder="Ditt namn"
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
						{#if cat.id === 'head'}Huvud
						{:else if cat.id === 'eyes'}Ögon
						{:else if cat.id === 'eyebrows'}Ögonbryn
						{:else if cat.id === 'nose'}Näsa
						{:else if cat.id === 'mouth'}Mun
						{:else if cat.id === 'glasses'}Glasögon
						{:else if cat.id === 'other'}Övrigt
						{:else if cat.id === 'hair_front'}Lugg
						{:else if cat.id === 'hair_back'}Hår
						{:else if cat.id === 'beard'}Skägg
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
						gestureController.selectedFeatureId = null;
					}}
					class="premium-tab-btn shrink-0 cursor-pointer border px-4 py-1.5 font-serif text-xs font-semibold transition-all outline-none select-none"
					class:active={activeCategory === 'background'}
				>
					Bakgrund
				</button>
			</div>

			<!-- Grid of Assets (No rounded corners, slightly darker background) -->
			<div
				class="relative flex flex-grow flex-row items-stretch overflow-hidden border border-[#8297af] bg-[#8297af]/20"
			>
				<div
					bind:this={gridContainerEl}
					onscroll={handleGridScroll}
					class="align-content-start grid flex-grow scrollbar-none grid-cols-3 gap-2 overflow-y-auto p-2"
					style="touch-action: none;"
				>
					{#if activeCategory === 'background'}
						<div class="col-span-3 grid w-full grid-cols-6 gap-1.5">
							{#each GRID_LIGHTNESSES as l}
								{#each GRID_HUES as h}
									{@const cellColor = hslToHex(h, 80, l)}
									<button
										onclick={() => handleSelectGridColor(h, l)}
										class="aspect-square w-full cursor-pointer border transition-all outline-none hover:scale-105"
										style="background-color: {cellColor}; border-color: {bgHue === h &&
										bgLightness === l
											? '#0f172a'
											: '#8297af'}; border-width: 1px; box-shadow: {bgHue === h && bgLightness === l
											? 'inset 0 0 0 2px #ffffff'
											: 'none'}; border-radius: 0px;"
										aria-label="Select base background color"
									></button>
								{/each}
							{/each}
						</div>
					{:else}
						{#each AVATAR_FEATURES.find((c) => c.id === activeCategory)?.features || [] as item}
							<button
								onpointerdown={(e) =>
									gestureController.handleLibraryPointerDown(activeCategory, item, e)}
								onpointermove={(e) => gestureController.handleLibraryPointerMove(e)}
								onpointerup={(e) => gestureController.handleLibraryPointerUp(e)}
								class="group relative flex aspect-square cursor-pointer items-center justify-center border border-[#8297af] bg-transparent p-1 transition-all outline-none select-none hover:bg-[#8297af]/30"
								style="border-radius: 0px; touch-action: none;"
							>
								<svg
									viewBox="0 0 200 200"
									class="pointer-events-none h-full w-full"
									xmlns="http://www.w3.org/2000/svg"
									style="--skin-color: {skinColor}; --hair-color: {hairColor}; --hair-shadow: {hairColors.shadow}; --hair-light: {hairColors.light}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor}; --lip-color-light: {lipColor}; --lip-color-dark: {lipColors.dark};"
								>
									<style>
										.skin-color {
											fill: var(--skin-color);
										}
										.hair-color {
											fill: var(--hair-color);
											stop-color: var(--hair-color);
										}
										.hair-shadow {
											fill: var(--hair-shadow);
											stop-color: var(--hair-shadow);
										}
										.hair-light {
											fill: var(--hair-light);
											stop-color: var(--hair-light);
										}
										.eye-color {
											fill: var(--eye-color);
										}
										.eyebrow-color {
											fill: var(--eyebrow-color);
										}
										.lip-color-light {
											fill: var(--lip-color-light);
										}
										.lip-color-dark {
											fill: var(--lip-color-dark);
										}
									</style>
									{@html namespaceSvgGradients(item.svgContent, 'grid_' + item.id)}
								</svg>
							</button>
						{/each}
					{/if}
				</div>

				<!-- Custom Scrollbar. The grid has touch-action: none (drag-out gestures),
				     so this is the only way to scroll on touch — the track is therefore
				     always rendered; when content fits it shows an inert full-height thumb. -->
				<div
					bind:this={scrollbarTrackEl}
					onpointerdown={handleScrollbarPointerDown}
					onpointermove={handleScrollbarPointerMove}
					onpointerup={handleScrollbarPointerUp}
					onpointercancel={handleScrollbarPointerUp}
					class="relative w-[16px] shrink-0 cursor-pointer touch-none border-l border-[#8297af] bg-[#8297af]/10 select-none"
					aria-hidden="true"
				>
					{#if showScrollbar}
						<div
							class="absolute right-[3px] left-[3px] bg-slate-700/60 transition-colors duration-150 hover:bg-slate-700/80 active:bg-slate-800"
							style="top: {thumbTop}px; height: {thumbHeight}px; border-radius: 4px;"
						></div>
					{:else}
						<div
							class="absolute inset-y-[3px] right-[3px] left-[3px] bg-slate-700/25"
							style="border-radius: 4px;"
						></div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Middle: Composition Canvas (centered, maximized, square, no buttons underneath) -->
		<div class="relative flex h-full flex-grow items-center justify-center">
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
				style="touch-action: none; width: calc(min(80dvh, 100vw - 500px)); height: calc(min(80dvh, 100vw - 500px));"
			>
				<button
					type="button"
					class="absolute inset-0 z-0 h-full w-full cursor-default border-0 bg-transparent p-0 outline-none"
					onclick={() => (gestureController.selectedFeatureId = null)}
					aria-label="Clear selection"
				></button>

				<svg
					id="avatar-canvas"
					viewBox="0 0 200 200"
					class="pointer-events-auto relative z-10 h-full w-full select-none"
					xmlns="http://www.w3.org/2000/svg"
					onpointerdown={(e) => gestureController.handleCanvasPointerDown(e)}
					style="touch-action: none; --skin-color: {skinColor}; --hair-color: {hairColor}; --hair-shadow: {hairColors.shadow}; --hair-light: {hairColors.light}; --eye-color: {eyeColor}; --eyebrow-color: {eyebrowColor}; --lip-color-light: {lipColor}; --lip-color-dark: {lipColors.dark};"
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
							stop-color: var(--hair-color, #3e2723);
						}
						.hair-shadow {
							fill: var(--hair-shadow, #24140e);
							stop-color: var(--hair-shadow, #24140e);
						}
						.hair-light {
							fill: var(--hair-light, #583e32);
							stop-color: var(--hair-light, #583e32);
						}
						.eye-color {
							fill: var(--eye-color, #4caf50);
						}
						.eyebrow-color {
							fill: var(--eyebrow-color, #5d4037);
						}
						.lip-color-light {
							fill: var(--lip-color-light, #e64a19);
						}
						.lip-color-dark {
							fill: var(--lip-color-dark, #d84315);
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
							class:cursor-grabbing={gestureController.isDragging &&
								gestureController.selectedFeatureId === f.id}
							filter={gestureController.selectedFeatureId === f.id ? 'url(#selection-glow)' : ''}
							onpointerdown={(e) => gestureController.startDrag(f.id, e)}
							role="button"
							tabindex="0"
							aria-label={f.name}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									gestureController.selectedFeatureId = f.id;
								}
							}}
						>
							{@html namespaceSvgGradients(f.svgContent, 'canvas')}
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
				{#if gestureController.selectedFeatureId}
					<button
						onclick={() => gestureController.removeSelectedFeature()}
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
			bind:clientHeight={rightPanelHeight}
			class="flex h-full shrink-0 flex-row items-stretch justify-between border-l border-[#8297af]"
			style="width: {dynamicPanelWidth}px; gap: {gapSize}px; padding-top: {rightPanelHeight < 500
				? 12
				: windowWidth >= 640
					? 20
					: 16}px; padding-bottom: {rightPanelHeight < 500
				? 12
				: windowWidth >= 640
					? 20
					: 16}px; padding-left: {windowWidth >= 640 ? 12 : 8}px; padding-right: 8px;"
		>
			<!-- Column A: Colors -->
			<div
				class="flex flex-grow scrollbar-none flex-col items-center overflow-y-auto pr-0.5"
				style="gap: {gapSize}px;"
			>
				{#each activePresets as color, i}
					{@const isSelected =
						activeColorMode === 'background'
							? bgSaturation === SATURATION_PRESETS[i]
							: activeColorValue.toLowerCase() === color.toLowerCase()}
					<button
						onclick={() => handleSelectColor(color)}
						class="shrink-0 cursor-pointer border transition-all outline-none hover:scale-105"
						style="background-color: {color}; border-color: {isSelected
							? '#0f172a'
							: '#8297af'}; border-width: 1px; box-shadow: {isSelected
							? 'inset 0 0 0 2px #ffffff'
							: 'none'}; border-radius: 0px; width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						aria-label="Select Color {color}"
					></button>
				{/each}
			</div>

			<!-- Column B: Controls (Save at the top, Mirror/Rotate/Scale in middle, Undo/Redo at the bottom) -->
			<div
				class="flex h-full shrink-0 flex-col items-center justify-between"
				style="width: {dynamicButtonSize}px; gap: {gapSize}px;"
			>
				<!-- Top Stack: Save and Action Buttons (Mirror, Rotate L/R, Scale L/R) -->
				<div class="flex w-full flex-col items-center" style="gap: {gapSize}px;">
					<!-- Save Button -->
					<button
						onclick={handleSave}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Save"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path
								d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
							/>
						</svg>
					</button>

					<!-- Mirror -->
					<button
						onclick={() => gestureController.mirrorFeature()}
						disabled={!gestureController.selectedFeatureId}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Mirror"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<rect x="11.25" y="2" width="1.5" height="20" opacity="0.3" />
							<path d="M9 6L3 12L9 18V6z" />
							<path d="M15 6L21 12L15 18V6z" class="opacity-80" />
						</svg>
					</button>
					<!-- Rotate Left -->
					<button
						onclick={() => gestureController.rotateFeature(-15)}
						disabled={!gestureController.selectedFeatureId}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Rotate Left"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path
								d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4.5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
							/>
						</svg>
					</button>
					<!-- Rotate Right -->
					<button
						onclick={() => gestureController.rotateFeature(15)}
						disabled={!gestureController.selectedFeatureId}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Rotate Right"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path
								d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4.5c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
								transform="translate(12, 12) scale(-1, 1) translate(-12, -12)"
							/>
						</svg>
					</button>
					<!-- Grow -->
					<button
						onclick={() => gestureController.changeScale(1.05)}
						disabled={!gestureController.selectedFeatureId}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Grow"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
						</svg>
					</button>
					<!-- Shrink -->
					<button
						onclick={() => gestureController.changeScale(0.95)}
						disabled={!gestureController.selectedFeatureId}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Shrink"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path d="M19 13H5v-2h14v2z" />
						</svg>
					</button>
				</div>

				<!-- Bottom Stack: Undo and Redo -->
				<div class="flex w-full flex-col items-center" style="gap: {gapSize}px;">
					<!-- Undo -->
					<button
						onclick={undo}
						disabled={!historyManager.canUndo}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Undo"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path
								d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
							/>
						</svg>
					</button>
					<!-- Redo -->
					<button
						onclick={redo}
						disabled={!historyManager.canRedo}
						class="flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-slate-800 transition-colors outline-none select-none hover:text-amber-700 disabled:pointer-events-none disabled:opacity-30"
						style="width: {dynamicButtonSize}px; height: {dynamicButtonSize}px;"
						title="Redo"
					>
						<svg
							viewBox="0 0 24 24"
							class="fill-current"
							style="width: {svgSize}px; height: {svgSize}px;"
						>
							<path
								d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Portrait Orientation Warning Overlay -->
<div class="portrait-warning">
	<div class="warning-content">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="rotate-phone-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
			<line x1="12" y1="18" x2="12.01" y2="18" />
		</svg>
		<h2>Rotera mobilen!</h2>
		<p>Appen är anpassad för horisontellt läge. Rotera mobilen för att börja skapa!</p>
	</div>
</div>

<style>
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
		border-image: linear-gradient(to bottom, #ffffff 0%, #cbd5e1 35%, #94a3b8 65%, #475569 100%) 1;
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
