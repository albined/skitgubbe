<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		scrollContainer: HTMLDivElement | null;
		watchValue?: any;
	}

	let { scrollContainer, watchValue }: Props = $props();

	let scrollbarTrackEl = $state<HTMLDivElement | null>(null);
	let gridScrollTop = $state(0);
	let gridScrollHeight = $state(0);
	let gridClientHeight = $state(0);
	let isScrollbarDragging = $state(false);
	let scrollDragStartY = 0;
	let scrollDragStartTop = 0;

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
		if (scrollContainer) {
			gridScrollTop = scrollContainer.scrollTop;
			gridScrollHeight = scrollContainer.scrollHeight;
			gridClientHeight = scrollContainer.clientHeight;
		}
	}

	function handleScrollbarPointerDown(e: PointerEvent) {
		if (!scrollContainer || !scrollbarTrackEl) return;
		e.preventDefault();
		e.stopPropagation();

		const trackRect = scrollbarTrackEl.getBoundingClientRect();
		const clickY = e.clientY - trackRect.top;

		const scrollHeight = scrollContainer.scrollHeight;
		const clientHeight = scrollContainer.clientHeight;
		const maxScrollTop = scrollHeight - clientHeight;

		const thumbHeightVal = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
		const maxThumbTop = clientHeight - thumbHeightVal;

		// Current thumb position
		const currentThumbTop =
			maxThumbTop > 0 && maxScrollTop > 0
				? (scrollContainer.scrollTop / maxScrollTop) * maxThumbTop
				: 0;

		let targetThumbTop = currentThumbTop;
		if (clickY < currentThumbTop || clickY > currentThumbTop + thumbHeightVal) {
			// Clicked outside the thumb: center the thumb on the click position
			targetThumbTop = Math.max(0, Math.min(maxThumbTop, clickY - thumbHeightVal / 2));
			if (maxThumbTop > 0) {
				scrollContainer.scrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;
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
		if (!isScrollbarDragging || !scrollContainer || !scrollbarTrackEl) return;
		e.preventDefault();
		e.stopPropagation();

		const clientHeight = scrollContainer.clientHeight;
		const scrollHeight = scrollContainer.scrollHeight;
		const maxScrollTop = scrollHeight - clientHeight;

		const thumbHeightVal = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
		const maxThumbTop = clientHeight - thumbHeightVal;

		const deltaY = e.clientY - scrollDragStartY;
		const targetThumbTop = Math.max(0, Math.min(maxThumbTop, scrollDragStartTop + deltaY));

		if (maxThumbTop > 0) {
			scrollContainer.scrollTop = (targetThumbTop / maxThumbTop) * maxScrollTop;
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

	// Listen to scroll events on the container
	$effect(() => {
		if (!scrollContainer) return;
		
		const handleScroll = () => {
			gridScrollTop = scrollContainer.scrollTop;
		};

		scrollContainer.addEventListener('scroll', handleScroll);
		updateScrollbarDimensions();

		return () => {
			scrollContainer.removeEventListener('scroll', handleScroll);
		};
	});

	// ResizeObserver for container
	$effect(() => {
		if (!scrollContainer) return;

		const observer = new ResizeObserver(() => {
			updateScrollbarDimensions();
		});
		observer.observe(scrollContainer);

		return () => {
			observer.disconnect();
		};
	});

	// Switching watchValue swaps content, which changes scrollHeight
	$effect(() => {
		void watchValue;
		tick().then(updateScrollbarDimensions);
	});
</script>

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
