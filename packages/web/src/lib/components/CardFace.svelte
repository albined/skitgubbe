<script lang="ts">
	import type { Card } from 'shared';

	let { card, isTrump = false, class: className = '', style = '' } = $props<{
		card: Card;
		isTrump?: boolean;
		class?: string;
		style?: string;
	}>();

	// Color definitions
	const suitColor = $derived(card.color === 'red' ? '#dc2626' : '#1e293b');
	const suitName = $derived(card.suitName);
	const suitSymbol = $derived(card.suit);
	const value = $derived(card.value);

	// Pip coordinate layouts for 2-10 cards
	interface Pip {
		x: number;
		y: number;
		rotate?: boolean;
	}

	const PIP_LAYOUTS: Record<string, Pip[]> = {
		'2': [
			{ x: 62.5, y: 48 },
			{ x: 62.5, y: 127, rotate: true }
		],
		'3': [
			{ x: 62.5, y: 48 },
			{ x: 62.5, y: 87.5 },
			{ x: 62.5, y: 127, rotate: true }
		],
		'4': [
			{ x: 35, y: 48 },
			{ x: 90, y: 48 },
			{ x: 35, y: 127, rotate: true },
			{ x: 90, y: 127, rotate: true }
		],
		'5': [
			{ x: 35, y: 48 },
			{ x: 90, y: 48 },
			{ x: 62.5, y: 87.5 },
			{ x: 35, y: 127, rotate: true },
			{ x: 90, y: 127, rotate: true }
		],
		'6': [
			{ x: 35, y: 48 },
			{ x: 90, y: 48 },
			{ x: 35, y: 87.5 },
			{ x: 90, y: 87.5 },
			{ x: 35, y: 127, rotate: true },
			{ x: 90, y: 127, rotate: true }
		],
		'7': [
			{ x: 35, y: 48 },
			{ x: 90, y: 48 },
			{ x: 35, y: 87.5 },
			{ x: 90, y: 87.5 },
			{ x: 62.5, y: 67.75 },
			{ x: 35, y: 127, rotate: true },
			{ x: 90, y: 127, rotate: true }
		],
		'8': [
			{ x: 35, y: 48 },
			{ x: 90, y: 48 },
			{ x: 35, y: 87.5 },
			{ x: 90, y: 87.5 },
			{ x: 62.5, y: 67.75 },
			{ x: 62.5, y: 107.25, rotate: true },
			{ x: 35, y: 127, rotate: true },
			{ x: 90, y: 127, rotate: true }
		],
		'9': [
			{ x: 35, y: 45 },
			{ x: 90, y: 45 },
			{ x: 35, y: 73.3 },
			{ x: 90, y: 73.3 },
			{ x: 62.5, y: 87.5 },
			{ x: 35, y: 101.7, rotate: true },
			{ x: 90, y: 101.7, rotate: true },
			{ x: 35, y: 130, rotate: true },
			{ x: 90, y: 130, rotate: true }
		],
		'10': [
			{ x: 35, y: 45 },
			{ x: 90, y: 45 },
			{ x: 35, y: 73.3 },
			{ x: 90, y: 73.3 },
			{ x: 62.5, y: 59.15 },
			{ x: 62.5, y: 115.85, rotate: true },
			{ x: 35, y: 101.7, rotate: true },
			{ x: 90, y: 101.7, rotate: true },
			{ x: 35, y: 130, rotate: true },
			{ x: 90, y: 130, rotate: true }
		]
	};

	const pips = $derived(PIP_LAYOUTS[value] || []);
	const isFaceCard = $derived(['J', 'Q', 'K'].includes(value));
	const isAce = $derived(value === 'A');

	const courtNames: Record<string, string> = { J: 'jack', Q: 'queen', K: 'king' };
	const courtFilename = $derived(isFaceCard ? `${courtNames[value]}_of_${suitName}.svg` : '');
</script>

<div
	class="card-face relative overflow-hidden select-none {className}"
	style="padding: 0; border: none; background: transparent; {style}"
>
	<svg
		viewBox="0 0 125 175"
		class="pointer-events-none h-full w-full select-none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<!-- Gradients -->
		<defs>
			<!-- Premium Gold Gradient for King and Queen -->
			<linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#b45309" />
				<stop offset="30%" stop-color="#fbbf24" />
				<stop offset="70%" stop-color="#f59e0b" />
				<stop offset="100%" stop-color="#78350f" />
			</linearGradient>

			<!-- Premium Silver Gradient for Jack -->
			<linearGradient id="silverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#475569" />
				<stop offset="30%" stop-color="#cbd5e1" />
				<stop offset="70%" stop-color="#94a3b8" />
				<stop offset="100%" stop-color="#1e293b" />
			</linearGradient>

			<!-- Delicate lattice pattern for Court Cards -->
			<pattern id="cardLattice" width="12" height="12" patternUnits="userSpaceOnUse">
				<path d="M 0 6 L 12 6 M 6 0 L 6 12" fill="none" stroke="rgba(212, 175, 55, 0.08)" stroke-width="0.5" />
				<circle cx="6" cy="6" r="1" fill="rgba(212, 175, 55, 0.12)" />
			</pattern>
		</defs>

		<!-- Card Body Background -->
		<rect
			width="125"
			height="175"
			rx="12"
			fill="#ffffff"
			stroke="rgba(0,0,0,0.12)"
			stroke-width="1.2"
		/>

		<!-- Elegant Inner Border Line -->
		<rect
			x="6"
			y="6"
			width="113"
			height="163"
			rx="8"
			fill="none"
			stroke="rgba(212, 175, 55, 0.15)"
			stroke-width="1"
		/>

		<!-- Corner Indices -->
		<!-- Top Left Corner -->
		<text
			x="14"
			y="24"
			font-family="'Georgia', 'Outfit', 'Times New Roman', serif"
			font-size="22"
			font-weight="900"
			fill={suitColor}
			text-anchor="middle"
		>{value}</text>
		<text
			x="14"
			y="40"
			font-family="'Georgia', 'Times New Roman', serif"
			font-size="18"
			fill={suitColor}
			text-anchor="middle"
		>{suitSymbol}</text>

		<!-- Bottom Right Corner (Rotated) -->
		<g transform="rotate(180 62.5 87.5)">
			<text
				x="14"
				y="24"
				font-family="'Georgia', 'Outfit', 'Times New Roman', serif"
				font-size="16"
				font-weight="900"
				fill={suitColor}
				text-anchor="middle"
			>{value}</text>
			<text
				x="14"
				y="38"
				font-family="'Georgia', 'Times New Roman', serif"
				font-size="14"
				fill={suitColor}
				text-anchor="middle"
			>{suitSymbol}</text>
		</g>

		<!-- Central Design (Depends on Card Type) -->
		{#if isAce}
			<!-- Ace: Stylized Large Ornate Centerpiece -->
			<g transform="translate(62.5, 87.5)">
				<!-- Shadow effect behind the symbol -->
				<text
					x="0"
					y="29"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="96"
					fill="rgba(0, 0, 0, 0.05)"
					text-anchor="middle"
				>{suitSymbol}</text>
				<!-- Main symbol -->
				<text
					x="-1"
					y="28"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="96"
					fill={suitColor}
					text-anchor="middle"
				>{suitSymbol}</text>
			</g>
		{:else if isFaceCard}
			<!-- Center SVG Figure for Court Cards -->
			<svg
				x="18.5"
				y="24.5"
				width="88"
				height="126"
				viewBox="22.8 21.2 119.7 198.7"
				preserveAspectRatio="xMidYMid meet"
				style="overflow: hidden; border-radius: 6px;"
			>
				<image href="/cards/{courtFilename}" x="0" y="0" width="168" height="243" />
			</svg>
		{:else}
			<!-- Number Cards (2-10): Grid placement of pips -->
			{#each pips as pip}
				<g
					transform="translate({pip.x}, {pip.y}) {pip.rotate ? 'rotate(180)' : ''}"
				>
					<text
						x="0"
						y="8"
						font-family="'Georgia', 'Times New Roman', serif"
						font-size="38"
						fill={suitColor}
						text-anchor="middle"
					>{suitSymbol}</text>
				</g>
			{/each}
		{/if}
	</svg>

	{#if isTrump}
		<div class="card-shimmer"></div>
	{/if}
</div>
