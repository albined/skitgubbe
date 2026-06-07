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
			<g transform="translate(62.5, 87.5) scale(1.1)">
				<!-- Shadow effect behind the symbol -->
				<text
					x="0"
					y="22"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="72"
					fill="rgba(0, 0, 0, 0.05)"
					text-anchor="middle"
				>{suitSymbol}</text>
				<!-- Main symbol -->
				<text
					x="-1"
					y="21"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="72"
					fill={suitColor}
					text-anchor="middle"
				>{suitSymbol}</text>
			</g>
			<!-- Decorative Ornate Diamond Frame around center -->
			<polygon
				points="62.5,38 90,87.5 62.5,137 35,87.5"
				fill="none"
				stroke="rgba(212, 175, 55, 0.25)"
				stroke-width="1"
				stroke-dasharray="3, 2"
			/>
		{:else if isFaceCard}
			<!-- Court Cards (Jack, Queen, King): Detailed Tapestry Shield & Emblems -->
			<!-- Inner Frame Box -->
			<rect
				x="26"
				y="38"
				width="73"
				height="99"
				rx="6"
				fill="url(#cardLattice)"
				stroke="rgba(212, 175, 55, 0.3)"
				stroke-width="1.5"
			/>
			<rect
				x="30"
				y="42"
				width="65"
				height="91"
				rx="4"
				fill="rgba(255, 255, 255, 0.85)"
				stroke="rgba(212, 175, 55, 0.15)"
				stroke-width="1"
			/>

			<!-- Center Crown or Emblem for Court Cards -->
			<g transform="translate(62.5, 87.5)">
				<!-- Giant Serif Letter (J/Q/K) with Premium Gradient -->
				<text
					x="0"
					y="18"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="52"
					font-weight="bold"
					fill={value === 'J' ? 'url(#silverGradient)' : 'url(#goldGradient)'}
					text-anchor="middle"
					filter="drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.25))"
				>{value}</text>

				<!-- Small side suits in the tapestry box -->
				<text
					x="-20"
					y="30"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="14"
					fill={suitColor}
					opacity="0.8"
					text-anchor="middle"
				>{suitSymbol}</text>
				<text
					x="20"
					y="-20"
					font-family="'Georgia', 'Times New Roman', serif"
					font-size="14"
					fill={suitColor}
					opacity="0.8"
					text-anchor="middle"
					transform="rotate(180 20 -20)"
				>{suitSymbol}</text>

				<!-- Ornate Crown (King/Queen) or Shield (Jack) -->
				{#if value === 'K'}
					<!-- King Crown -->
					<path
						d="M -16,-28 L -12,-38 L -5,-32 L 0,-42 L 5,-32 L 12,-38 L 16,-28 Z"
						fill="url(#goldGradient)"
						stroke="#b45309"
						stroke-width="0.5"
					/>
					<rect
						x="-16"
						y="-27"
						width="32"
						height="3"
						fill="#78350f"
						rx="0.5"
					/>
				{:else if value === 'Q'}
					<!-- Queen Tiara -->
					<path
						d="M -12,-26 C -12,-35 -4,-33 0,-40 C 4,-33 12,-35 12,-26 Z"
						fill="url(#goldGradient)"
						stroke="#b45309"
						stroke-width="0.5"
					/>
					<circle cx="0" cy="-40" r="1.5" fill="#f59e0b" />
					<rect
						x="-12"
						y="-25"
						width="24"
						height="2"
						fill="#78350f"
						rx="0.5"
					/>
				{:else if value === 'J'}
					<!-- Jack Knight Helmet / Shield -->
					<path
						d="M -10,-24 L 10,-24 L 10,-31 C 10,-36 0,-39 0,-39 C 0,-39 -10,-36 -10,-31 Z"
						fill="url(#silverGradient)"
						stroke="#475569"
						stroke-width="0.5"
					/>
					<!-- Visor line -->
					<line x1="-7" y1="-28" x2="7" y2="-28" stroke="#1e293b" stroke-width="1.5" />
				{/if}
			</g>
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
