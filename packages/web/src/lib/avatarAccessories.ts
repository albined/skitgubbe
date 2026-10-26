// Shared, trusted SVG artwork for game-room and pillar avatar decorations.
// Trumfman's leprechaun hat, drawn at 152x82 around the origin and fitted into
// the 64x48 accessory box. Flat fills, so no gradient ids clash between avatars.
export const LEPRECHAUN_HAT_SVG_CONTENT = `<g transform="translate(32 52) scale(0.4)">
			<path
				d="M-44 -36L-54 -92C-55 -104 55 -104 54 -92L44 -36Z"
				fill="#1e8449"
				stroke="#0b3b24"
				stroke-width="5"
			/>
			<path
				d="M-38 -86C-15 -93 15 -93 38 -86"
				fill="none"
				stroke="#58d68d"
				stroke-width="6"
				stroke-linecap="round"
				opacity="0.6"
			/>
			<path d="M-46 -54L46 -54L44 -36L-44 -36Z" fill="#141e18" />
			<g transform="translate(32 -66) rotate(18)">
				<circle cx="-5" cy="-5" r="7" fill="#58d68d" stroke="#0b3b24" stroke-width="2.5" />
				<circle cx="6" cy="-4" r="7" fill="#58d68d" stroke="#0b3b24" stroke-width="2.5" />
				<circle cx="-4" cy="6" r="7" fill="#58d68d" stroke="#0b3b24" stroke-width="2.5" />
			</g>
			<rect
				x="-15"
				y="-59"
				width="30"
				height="24"
				rx="4"
				fill="#f1c40f"
				stroke="#7d6608"
				stroke-width="4"
			/>
			<rect x="-7" y="-52" width="14" height="10" rx="1.5" fill="#141e18" />
			<path
				d="M-70 -34C-40 -46 40 -46 70 -34C76 -30 72 -22 62 -24C30 -32 -30 -32 -62 -24C-72 -22 -76 -30 -70 -34Z"
				fill="#27ae60"
				stroke="#0b3b24"
				stroke-width="5"
			/>
		</g>`;

export const HALO_SVG_CONTENT = `<ellipse
				cx="32"
				cy="29"
				rx="25"
				ry="9"
				fill="none"
				stroke="#ffdf80"
				stroke-width="10"
				opacity="0.15"
			/>
			<ellipse cx="32" cy="29" rx="25" ry="9" fill="none" stroke="#795223" stroke-width="7" />
			<ellipse cx="32" cy="28" rx="25" ry="9" fill="none" stroke="#f4ce63" stroke-width="4.5" />
			<path
				d="M12 25C18 20 37 19 47 23"
				fill="none"
				stroke="#fff3c3"
				stroke-width="2.5"
				stroke-linecap="round"
			/>`;
