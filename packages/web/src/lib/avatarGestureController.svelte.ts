import type { AvatarFeatureTemplate, PlacedFeature } from './avatarFeatures.svelte';

export class AvatarGestureController {
	// Placed Features and Selection
	placedFeatures = $state<PlacedFeature[]>([]);
	selectedFeatureId = $state<string | null>(null);

	// Callback to save history
	pushHistoryState: () => void;

	// Dragging State (Canvas feature drag)
	isDragging = $state(false);
	dragStartX = 0;
	dragStartY = 0;
	initialFeatureX = 0;
	initialFeatureY = 0;
	cachedInverseCTM: DOMMatrix | null = null;

	// Gesture tracking state
	activePointers = new Map<number, { clientX: number; clientY: number }>();
	isPinching = $state(false);
	// True if the current drag gesture involved a pinch at any point —
	// pinch fingers often end outside the canvas, which must not count
	// as the drag-to-trash gesture
	hadPinch = false;
	initialPinchDistance = 0;
	initialPinchAngle = 0;
	initialFeatureScaleX = 1;
	initialFeatureScaleY = 1;
	initialFeatureRotation = 0;
	initialPinchMidpoint = { x: 0, y: 0 };

	// Library Drag State
	pendingLibraryDrag = $state<{ category: string; template: AvatarFeatureTemplate } | null>(null);
	originalFeaturesState: { features: PlacedFeature[]; selectedFeatureId: string | null } | null =
		null;
	libDragStartX = 0;
	libDragStartY = 0;
	libDragHasMoved = $state(false);
	cursorX = $state(0);
	cursorY = $state(0);
	isOverCanvas = $state(false);

	wheelTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(pushHistoryState: () => void) {
		this.pushHistoryState = pushHistoryState;
	}

	get selectedFeature() {
		return this.placedFeatures.find((f) => f.id === this.selectedFeatureId) || null;
	}

	getDistance(p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) {
		const dx = p1.clientX - p2.clientX;
		const dy = p1.clientY - p2.clientY;
		return Math.hypot(dx, dy);
	}

	getAngle(p1: { clientX: number; clientY: number }, p2: { clientX: number; clientY: number }) {
		return Math.atan2(p2.clientY - p1.clientY, p2.clientX - p1.clientX);
	}

	initPinchGesture() {
		if (this.activePointers.size !== 2 || !this.selectedFeatureId) return;

		const pointers = Array.from(this.activePointers.values());
		const p1 = pointers[0];
		const p2 = pointers[1];

		this.initialPinchDistance = this.getDistance(p1, p2);
		this.initialPinchAngle = this.getAngle(p1, p2);

		const feature = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
		if (feature) {
			this.initialFeatureScaleX = feature.scaleX;
			this.initialFeatureScaleY = feature.scaleY;
			this.initialFeatureRotation = feature.rotation;
			this.initialFeatureX = feature.x;
			this.initialFeatureY = feature.y;

			const screenMidX = (p1.clientX + p2.clientX) / 2;
			const screenMidY = (p1.clientY + p2.clientY) / 2;
			this.initialPinchMidpoint = this.getSVGCoords(screenMidX, screenMidY);
			this.isPinching = true;
			this.hadPinch = true;
		}
	}

	isPointerOverCanvas(clientX: number, clientY: number) {
		const canvasEl = document.getElementById('avatar-canvas');
		if (!canvasEl) return false;
		const rect = canvasEl.getBoundingClientRect();
		return (
			clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
		);
	}

	getSVGCoords(clientX: number, clientY: number): { x: number; y: number } {
		const svg = document.getElementById('avatar-canvas') as unknown as SVGSVGElement | null;
		if (!svg) return { x: 0, y: 0 };
		const ctm = this.cachedInverseCTM || svg.getScreenCTM()?.inverse();
		if (!ctm) return { x: 0, y: 0 };
		const point = svg.createSVGPoint();
		point.x = clientX;
		point.y = clientY;
		const svgPoint = point.matrixTransform(ctm);
		return { x: svgPoint.x, y: svgPoint.y };
	}

	prepareAddFeature(category: string, template: AvatarFeatureTemplate, x: number, y: number) {
		const activeSelected = this.selectedFeature;

		// In-place replace check
		if (activeSelected && activeSelected.category === category) {
			this.placedFeatures = this.placedFeatures.map((f) => {
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
		const placedOfCat = this.placedFeatures.filter((f) => f.category === category);
		const limit =
			category === 'eyes' || category === 'eyebrows' || category === 'beard'
				? 2
				: category === 'other'
					? 10
					: 1;

		if (placedOfCat.length < limit) {
			// Add fresh
			const newId = `${template.id}_${Math.random().toString(36).substring(2, 9)}`;
			const isFlip =
				(category === 'eyes' || category === 'eyebrows') &&
				placedOfCat.length === 1 &&
				placedOfCat[0].scaleX > 0;

			const newFeature = {
				id: newId,
				category,
				templateId: template.id,
				x,
				y,
				scaleX: isFlip ? -template.defaultScaleX : template.defaultScaleX,
				scaleY: template.defaultScaleY,
				rotation: 0,
				zIndex: template.zIndex,
				svgContent: template.svgContent,
				name: template.name
			};
			this.placedFeatures = [...this.placedFeatures, newFeature];
			this.selectedFeatureId = newId;
		} else {
			// Replace earliest added asset: remove it and append the new one
			const earliest = placedOfCat[0];
			const remaining = placedOfCat[1];
			const newId = `${template.id}_${Math.random().toString(36).substring(2, 9)}`;
			const isFlip =
				(category === 'eyes' || category === 'eyebrows') && remaining && remaining.scaleX > 0;

			const newFeature = {
				id: newId,
				category,
				templateId: template.id,
				x,
				y,
				scaleX: isFlip ? -template.defaultScaleX : template.defaultScaleX,
				scaleY: template.defaultScaleY,
				rotation: 0,
				zIndex: template.zIndex,
				svgContent: template.svgContent,
				name: template.name
			};
			this.placedFeatures = this.placedFeatures.filter((f) => f.id !== earliest.id);
			this.placedFeatures = [...this.placedFeatures, newFeature];
			this.selectedFeatureId = newId;
		}
	}

	handleLibraryPointerDown(category: string, template: AvatarFeatureTemplate, e: PointerEvent) {
		e.stopPropagation();

		// While a canvas drag is active, a finger landing on a library item is
		// gesture input (pinch to scale/rotate) — not the start of a new drag
		if (this.isDragging) {
			this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
			if (this.activePointers.size === 2) {
				this.initPinchGesture();
			}
			return;
		}

		this.pendingLibraryDrag = { category, template };
		this.libDragStartX = e.clientX;
		this.libDragStartY = e.clientY;
		this.cursorX = e.clientX;
		this.cursorY = e.clientY;
		this.libDragHasMoved = false;
		this.isOverCanvas = false;

		const svg = document.getElementById('avatar-canvas') as unknown as SVGSVGElement | null;
		this.cachedInverseCTM = svg?.getScreenCTM()?.inverse() || null;

		// Snapshot the clean state before drag begins
		this.originalFeaturesState = {
			features: JSON.parse(JSON.stringify(this.placedFeatures)),
			selectedFeatureId: this.selectedFeatureId
		};

		const target = e.currentTarget as HTMLElement;
		try {
			target.setPointerCapture(e.pointerId);
		} catch (err) {
			console.error('setPointerCapture failed for library item', err);
		}
	}

	handleLibraryPointerMove(e: PointerEvent) {
		if (!this.pendingLibraryDrag) return;
		e.stopPropagation();

		this.cursorX = e.clientX;
		this.cursorY = e.clientY;

		const dx = e.clientX - this.libDragStartX;
		const dy = e.clientY - this.libDragStartY;
		const dist = Math.hypot(dx, dy);

		if (dist > 5) {
			if (!this.libDragHasMoved) {
				this.libDragHasMoved = true;
			}

			const over = this.isPointerOverCanvas(e.clientX, e.clientY);
			if (over) {
				if (!this.isOverCanvas) {
					// Transition: enter canvas!
					this.isOverCanvas = true;
					const coords = this.getSVGCoords(e.clientX, e.clientY);
					// Feature x/y are offsets from the artwork's centered default
					// position, so drop the viewBox center (100,100) at the pointer.
					const dropX = coords.x - 100;
					const dropY = coords.y - 100;
					// A drag means "place a piece here" — never an in-place swap of
					// the still-selected piece (that's the tap gesture), so clear the
					// selection first. Category limits still apply inside
					// prepareAddFeature (the oldest piece gets replaced at the limit).
					this.selectedFeatureId = null;
					this.prepareAddFeature(
						this.pendingLibraryDrag.category,
						this.pendingLibraryDrag.template,
						dropX,
						dropY
					);

					// Setup canvas dragging variables to take over
					this.isDragging = true;
					this.hadPinch = false;
					this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
					this.dragStartX = coords.x;
					this.dragStartY = coords.y;
					this.initialFeatureX = dropX;
					this.initialFeatureY = dropY;
				} else {
					// Continue drag positioning on canvas
					if (this.isDragging && this.selectedFeatureId && !this.isPinching) {
						const svgPoint = this.getSVGCoords(e.clientX, e.clientY);
						const cDx = svgPoint.x - this.dragStartX;
						const cDy = svgPoint.y - this.dragStartY;
						const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
						if (f) {
							f.x = this.initialFeatureX + cDx;
							f.y = this.initialFeatureY + cDy;
						}
					}
				}
			} else {
				// Dragging outside canvas
				if (this.isOverCanvas) {
					// Transition: left canvas! Revert to original features state
					if (this.originalFeaturesState) {
						this.placedFeatures = JSON.parse(JSON.stringify(this.originalFeaturesState.features));
						this.selectedFeatureId = this.originalFeaturesState.selectedFeatureId;
					}
					this.isOverCanvas = false;
					this.isDragging = false;
				}
			}
		}
	}

	handleLibraryPointerUp(e: PointerEvent) {
		if (!this.pendingLibraryDrag) return;
		e.stopPropagation();

		const target = e.currentTarget as HTMLElement;
		try {
			target.releasePointerCapture(e.pointerId);
		} catch {}

		if (!this.libDragHasMoved) {
			// Tapped: spawn in the middle
			this.prepareAddFeature(
				this.pendingLibraryDrag.category,
				this.pendingLibraryDrag.template,
				0,
				0
			);
			this.pushHistoryState();
		} else {
			// Dragged: if it entered the canvas, save to history
			if (this.isOverCanvas) {
				this.pushHistoryState();
			} else {
				// Revert to original clean state if released outside canvas
				if (this.originalFeaturesState) {
					this.placedFeatures = JSON.parse(JSON.stringify(this.originalFeaturesState.features));
					this.selectedFeatureId = this.originalFeaturesState.selectedFeatureId;
				}
			}
			// Stop active dragging
			this.isDragging = false;
			this.hadPinch = false;
		}
		this.originalFeaturesState = null;

		this.activePointers.clear();
		this.pendingLibraryDrag = null;
		this.libDragHasMoved = false;
		this.isOverCanvas = false;
		this.cachedInverseCTM = null;
	}

	removeSelectedFeature() {
		if (this.selectedFeatureId) {
			this.placedFeatures = this.placedFeatures.filter((f) => f.id !== this.selectedFeatureId);
			this.selectedFeatureId = null;
			this.pushHistoryState();
		}
	}

	handleCanvasPointerDown(e: PointerEvent) {
		// While a drag is active this is the second finger of a pinch gesture,
		// not a deselection tap
		if (this.isDragging) return;
		const target = e.target as SVGElement;
		if (target && target.id === 'avatar-canvas-rect') {
			this.selectedFeatureId = null;
		}
	}

	handleGlobalPointerDown(e: PointerEvent) {
		this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

		if (this.isDragging && this.activePointers.size === 2) {
			this.initPinchGesture();
		}

		// While a drag/pinch is in progress, extra fingers anywhere on screen are
		// gesture input — never deselection taps
		if (this.isDragging) return;

		if (!this.selectedFeatureId) return;

		const target = e.target as HTMLElement;

		const canvasEl = document.getElementById('avatar-canvas');
		if (canvasEl && canvasEl.contains(target)) {
			return;
		}

		if (target.closest('button') || target.closest('input') || target.closest('[role="button"]')) {
			return;
		}

		this.selectedFeatureId = null;
	}

	startDrag(id: string, e: PointerEvent) {
		e.stopPropagation();
		e.preventDefault();

		if (this.isDragging && this.selectedFeatureId) {
			this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
			if (this.activePointers.size === 2) {
				this.initPinchGesture();
			}
			return;
		}

		this.selectedFeatureId = id;
		this.isDragging = true;
		this.hadPinch = false;

		this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

		const target = e.currentTarget as HTMLElement | SVGElement;
		try {
			target.setPointerCapture(e.pointerId);
		} catch (err) {
			console.error('setPointerCapture failed in startDrag', err);
		}

		const svg = document.getElementById('avatar-canvas') as unknown as SVGSVGElement | null;
		this.cachedInverseCTM = svg?.getScreenCTM()?.inverse() || null;

		const feature = this.placedFeatures.find((f) => f.id === id);
		const svgPoint = this.getSVGCoords(e.clientX, e.clientY);

		this.dragStartX = svgPoint.x;
		this.dragStartY = svgPoint.y;

		if (feature) {
			this.initialFeatureX = feature.x;
			this.initialFeatureY = feature.y;
		}

		if (this.activePointers.size === 2) {
			this.initPinchGesture();
		}
	}

	handlePointerMove(e: PointerEvent) {
		if (this.activePointers.has(e.pointerId)) {
			this.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
		}

		if (!this.isDragging || !this.selectedFeatureId) return;

		// Two-finger pinch & rotate gesture
		if (this.isPinching && this.activePointers.size === 2) {
			const pointers = Array.from(this.activePointers.values());
			const p1 = pointers[0];
			const p2 = pointers[1];

			const currentDistance = this.getDistance(p1, p2);
			const currentAngle = this.getAngle(p1, p2);

			const scaleFactor =
				this.initialPinchDistance > 0 ? currentDistance / this.initialPinchDistance : 1;
			const angleDiff = (currentAngle - this.initialPinchAngle) * (180 / Math.PI);

			const screenMidX = (p1.clientX + p2.clientX) / 2;
			const screenMidY = (p1.clientY + p2.clientY) / 2;
			const currentMidpoint = this.getSVGCoords(screenMidX, screenMidY);

			const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
			if (f) {
				const signX = Math.sign(this.initialFeatureScaleX);
				const signY = Math.sign(this.initialFeatureScaleY);
				f.scaleX =
					Math.max(0.1, Math.min(3, Math.abs(this.initialFeatureScaleX) * scaleFactor)) * signX;
				f.scaleY =
					Math.max(0.1, Math.min(3, Math.abs(this.initialFeatureScaleY) * scaleFactor)) * signY;
				let newRotation = (this.initialFeatureRotation + angleDiff) % 360;
				if (newRotation < 0) newRotation += 360;
				f.rotation = newRotation;
				f.x = this.initialFeatureX + (currentMidpoint.x - this.initialPinchMidpoint.x);
				f.y = this.initialFeatureY + (currentMidpoint.y - this.initialPinchMidpoint.y);
			}
			return;
		}

		// Single pointer normal drag
		if (this.activePointers.size === 1) {
			const svgPoint = this.getSVGCoords(e.clientX, e.clientY);

			const dx = svgPoint.x - this.dragStartX;
			const dy = svgPoint.y - this.dragStartY;

			const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
			if (f) {
				f.x = this.initialFeatureX + dx;
				f.y = this.initialFeatureY + dy;
			}
		}
	}

	handlePointerUp(e: PointerEvent) {
		const wasPinching = this.isPinching;
		this.activePointers.delete(e.pointerId);

		if (this.activePointers.size < 2) {
			this.isPinching = false;
		}

		if (this.isDragging && this.activePointers.size === 0) {
			const over = this.isPointerOverCanvas(e.clientX, e.clientY);
			// Drag-to-trash: only for plain drags — a pinch gesture's fingers
			// legitimately end outside the canvas
			if (!over && this.selectedFeatureId && !this.hadPinch) {
				this.placedFeatures = this.placedFeatures.filter((f) => f.id !== this.selectedFeatureId);
				this.selectedFeatureId = null;
			}
			this.pushHistoryState();
			this.isDragging = false;
			this.hadPinch = false;
			this.cachedInverseCTM = null;
		} else if (this.isDragging && wasPinching && this.activePointers.size === 1) {
			this.pushHistoryState();
			const remainingPointerId = Array.from(this.activePointers.keys())[0];
			const remainingPointer = this.activePointers.get(remainingPointerId);
			if (remainingPointer) {
				const svgPoint = this.getSVGCoords(remainingPointer.clientX, remainingPointer.clientY);
				this.dragStartX = svgPoint.x;
				this.dragStartY = svgPoint.y;
				const feature = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
				if (feature) {
					this.initialFeatureX = feature.x;
					this.initialFeatureY = feature.y;
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

	handlePointerCancel(e: PointerEvent) {
		this.activePointers.delete(e.pointerId);
		if (this.activePointers.size < 2) {
			this.isPinching = false;
		}
		if (this.activePointers.size === 0) {
			this.isDragging = false;
			this.hadPinch = false;
			this.cachedInverseCTM = null;
		}
	}

	changeScale(factor: number) {
		if (!this.selectedFeatureId) return;
		const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
		if (f) {
			const signX = Math.sign(f.scaleX);
			const signY = Math.sign(f.scaleY);
			f.scaleX = Math.max(0.1, Math.min(3, Math.abs(f.scaleX) * factor)) * signX;
			f.scaleY = Math.max(0.1, Math.min(3, Math.abs(f.scaleY) * factor)) * signY;
		}
		this.pushHistoryState();
	}

	rotateFeature(deg: number) {
		if (!this.selectedFeatureId) return;
		const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
		if (f) {
			f.rotation = (f.rotation + deg) % 360;
		}
		this.pushHistoryState();
	}

	mirrorFeature() {
		if (!this.selectedFeatureId) return;
		const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
		if (f) {
			f.scaleX = -f.scaleX;
		}
		this.pushHistoryState();
	}

	handleWheel = (e: WheelEvent) => {
		if (!this.selectedFeatureId) return;
		e.preventDefault();

		if (e.shiftKey) {
			const dir = Math.sign(e.deltaY);
			const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
			if (f) {
				let newRotation = (f.rotation + dir * 15) % 360;
				if (newRotation < 0) newRotation += 360;
				f.rotation = newRotation;
			}
		} else {
			const dir = Math.sign(e.deltaY);
			const factor = dir > 0 ? 0.95 : 1.05;
			const f = this.placedFeatures.find((f) => f.id === this.selectedFeatureId);
			if (f) {
				const signX = Math.sign(f.scaleX);
				const signY = Math.sign(f.scaleY);
				f.scaleX = Math.max(0.1, Math.min(3, Math.abs(f.scaleX) * factor)) * signX;
				f.scaleY = Math.max(0.1, Math.min(3, Math.abs(f.scaleY) * factor)) * signY;
			}
		}

		if (this.wheelTimeout !== null) clearTimeout(this.wheelTimeout);
		this.wheelTimeout = setTimeout(() => {
			this.pushHistoryState();
		}, 300);
	};
}
