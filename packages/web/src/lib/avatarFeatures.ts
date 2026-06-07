export interface AvatarFeatureTemplate {
	id: string;
	name: string;
	svgContent: string;
	defaultX: number;
	defaultY: number;
	defaultScaleX: number;
	defaultScaleY: number;
	zIndex: number;
}

export interface FeatureCategory {
	id: string;
	name: string;
	features: AvatarFeatureTemplate[];
}

export const AVATAR_FEATURES: FeatureCategory[] = [
	{
		id: 'head',
		name: 'Head Shapes',
		features: [
			{
				id: 'head_base',
				name: 'Classic Rounded',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 1.0,
				defaultScaleY: 1.0,
				zIndex: 10,
				svgContent: `
					<!-- Base Head and Ears -->
					<path class="skin-color" fill="#FFCDB2" d="M 25 75 C 5 70, 0 110, 25 125 C 35 165, 65 195, 100 195 C 135 195, 165 165, 175 125 C 200 110, 195 70, 175 75 C 170 25, 145 5, 100 5 C 55 5, 30 25, 25 75 Z" />
					<!-- Outer Edge Shadow for Depth -->
					<path fill="#000000" opacity="0.12" d="M 25 125 C 35 165, 65 195, 100 195 C 135 195, 165 165, 175 125 C 160 170, 130 185, 100 185 C 70 185, 40 170, 25 125 Z" />
					<!-- Subtle Highlight Top Left -->
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 60 5, 35 25, 30 70 C 40 30, 70 15, 100 15 C 120 15, 150 25, 165 50 C 150 20, 125 5, 100 5 Z" />
					<!-- Inner Ear Depth (Left) -->
					<path fill="#000000" opacity="0.15" d="M 22 85 C 12 85, 12 110, 20 115 C 15 110, 15 90, 22 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 25 95 C 20 100, 20 110, 28 110 C 25 110, 22 105, 25 95 Z" />
					<!-- Inner Ear Depth (Right) -->
					<path fill="#000000" opacity="0.15" d="M 178 85 C 188 85, 188 110, 180 115 C 185 110, 185 90, 178 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 175 95 C 180 100, 180 110, 172 110 C 175 110, 178 105, 175 95 Z" />
					<!-- Soft Cheek Volume -->
					<ellipse cx="50" cy="130" rx="15" ry="10" fill="#FF0000" opacity="0.08" filter="url(#blur-shadow)" />
					<ellipse cx="150" cy="130" rx="15" ry="10" fill="#FF0000" opacity="0.08" filter="url(#blur-shadow)" />
				`
			}
		]
	},
	{
		id: 'eyes',
		name: 'Eyes',
		features: [
			{
				id: 'eye_classic',
				name: 'Expressive Eye',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.45,
				defaultScaleY: 0.45,
				zIndex: 20,
				svgContent: `
					<!-- Eye White (Sclera) -->
					<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" fill="#F9F9F9" />
					<!-- Sclera Inner Shadow (Top & Sides) -->
					<path d="M 20 100 C 60 40, 140 40, 180 90 C 160 70, 80 70, 20 100 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="100" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow)" />
					<!-- Iris & Pupil Clipped to Eye Shape -->
					<g clip-path="url(#eye-clip-1)">
						<!-- Base Iris Color -->
						<circle class="eye-color" cx="100" cy="90" r="35" fill="#4CAF50" />
						<!-- Iris Inner Gradient/Shadow -->
						<circle cx="100" cy="90" r="35" fill="none" stroke="#000000" stroke-width="10" opacity="0.3" />
						<!-- Pupil -->
						<circle cx="100" cy="90" r="15" fill="#111111" />
						<!-- Eye Highlights -->
						<circle cx="90" cy="75" r="8" fill="#FFFFFF" opacity="0.9" />
						<circle cx="115" cy="105" r="4" fill="#FFFFFF" opacity="0.7" />
					</g>
					<!-- Upper Eyelid / Lash Line -->
					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 100 C 60 35, 140 35, 185 90" />
					<!-- Lower Eyelid -->
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 102 C 60 142, 140 142, 175 92" />
					<!-- Crease Line -->
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 30 75 C 70 30, 130 30, 170 70" />
				`
			}
		]
	},
	{
		id: 'eyebrows',
		name: 'Eyebrows',
		features: [
			{
				id: 'eyebrow_arched',
				name: 'Arched Brow',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.45,
				defaultScaleY: 0.45,
				zIndex: 30,
				svgContent: `
					<!-- Character Left Eyebrow: Inner (x=20) to Outer (x=180) -->
					<path class="eyebrow-color" fill="#5D4037" d="M 20 130 C 50 80, 120 70, 180 120 C 160 100, 100 80, 25 140 Z" filter="url(#brow-soft-1)" />
					<!-- Core Solid Shape -->
					<path class="eyebrow-color" fill="#5D4037" d="M 20 125 C 60 85, 120 85, 180 120 C 140 105, 80 105, 20 140 Z" />
				`
			}
		]
	},
	{
		id: 'nose',
		name: 'Nose Shapes',
		features: [
			{
				id: 'nose_cute',
				name: 'Cute Round',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.5,
				defaultScaleY: 0.5,
				zIndex: 25,
				svgContent: `
					<!-- Base Nose Color -->
					<circle class="skin-color" cx="100" cy="130" r="40" fill="#FFCDB2" opacity="0.8" filter="url(#soft-nose)" />
					<!-- Underside Shadow -->
					<path fill="#000000" opacity="0.15" d="M 60 130 C 60 160, 140 160, 140 130 C 120 145, 80 145, 60 130 Z" filter="url(#soft-nose)" />
					<!-- Nostril C-Curves -->
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 50 120 C 40 135, 50 150, 70 140" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 150 120 C 160 135, 150 150, 130 140" />
					<!-- Inner Nostril Holes -->
					<ellipse cx="75" cy="135" rx="8" ry="4" fill="#000000" opacity="0.3" transform="rotate(-15 75 135)" />
					<ellipse cx="125" cy="135" rx="8" ry="4" fill="#000000" opacity="0.3" transform="rotate(15 125 135)" />
					<!-- Cute Round Tip Highlight -->
					<circle cx="100" cy="115" r="15" fill="#FFFFFF" opacity="0.5" filter="url(#soft-nose)" />
					<!-- Bridge Highlight Fade -->
					<path fill="#FFFFFF" opacity="0.3" d="M 95 40 L 105 40 L 110 90 L 90 90 Z" filter="url(#soft-nose)" />
				`
			}
		]
	},
	{
		id: 'mouth',
		name: 'Mouth / Lips',
		features: [
			{
				id: 'mouth_smile',
				name: 'Warm Smile',
				defaultX: 0,
				defaultY: 35,
				defaultScaleX: 0.5,
				defaultScaleY: 0.5,
				zIndex: 35,
				svgContent: `
					<!-- Smile Creases / Dimples -->
					<path fill="none" stroke="#A1695A" stroke-width="6" opacity="0.4" stroke-linecap="round" d="M 25 70 C 15 80, 15 100, 25 110" />
					<path fill="none" stroke="#A1695A" stroke-width="6" opacity="0.4" stroke-linecap="round" d="M 175 70 C 185 80, 185 100, 175 110" />
					<!-- Lower Lip Shadow/Base -->
					<path fill="#D84315" opacity="0.8" d="M 30 85 C 60 160, 140 160, 170 85 C 140 120, 60 120, 30 85 Z" />
					<!-- Central Mouth Line -->
					<path fill="none" stroke="#3E2723" stroke-width="8" stroke-linecap="round" d="M 30 85 C 70 130, 130 130, 170 85" />
					<!-- Upper Lip -->
					<path fill="#E64A19" opacity="0.7" d="M 30 85 C 60 100, 80 70, 100 80 C 120 70, 140 100, 170 85 C 130 115, 70 115, 30 85 Z" />
					<!-- Lower Lip Highlight -->
					<path fill="#FFFFFF" opacity="0.4" d="M 70 120 C 85 130, 115 130, 130 120 C 110 125, 90 125, 70 120 Z" filter="url(#lip-glow)" />
				`
			}
		]
	},
	{
		id: 'hair_front',
		name: 'Hair (Front)',
		features: [
			{
				id: 'hair_front_wavy',
				name: 'Flowing Front Wavy',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 1.0,
				defaultScaleY: 1.0,
				zIndex: 40,
				svgContent: `
					<!-- Flowing Side Pieces -->
					<path class="hair-color" fill="#3E2723" d="M 100 10 C 60 10, 30 25, 20 90 C 15 140, 25 180, 10 195 C 40 195, 55 150, 55 100 C 65 70, 80 50, 100 50 Z" />
					<path class="hair-color" fill="#3E2723" d="M 100 10 C 140 10, 170 25, 180 90 C 185 140, 175 180, 190 195 C 160 195, 145 150, 145 100 C 135 70, 120 50, 100 50 Z" />
					<!-- Heavy shadowing inside curves -->
					<path fill="#000000" opacity="0.3" d="M 100 50 C 80 50, 65 70, 55 100 C 45 150, 35 180, 10 195 C 25 170, 35 140, 30 100 C 35 50, 60 25, 100 10 Z" />
					<path fill="#000000" opacity="0.3" d="M 100 50 C 120 50, 135 70, 145 100 C 155 150, 165 180, 190 195 C 175 170, 165 140, 170 100 C 165 50, 140 25, 100 10 Z" />
					<!-- Wavy Overlay Strands -->
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.2" stroke-linecap="round" d="M 40 50 C 30 90, 45 140, 25 180 M 160 50 C 170 90, 155 140, 175 180" />
					<!-- Smooth Highlights -->
					<path fill="#FFFFFF" opacity="0.12" d="M 60 30 C 45 60, 40 110, 20 150 C 30 110, 50 60, 80 35 Z" />
					<path fill="#FFFFFF" opacity="0.12" d="M 140 30 C 155 60, 160 110, 180 150 C 170 110, 150 60, 120 35 Z" />
				`
			}
		]
	},
	{
		id: 'hair_back',
		name: 'Hair (Back)',
		features: [
			{
				id: 'hair_back_flared',
				name: 'Classic Flared Back',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 1.0,
				defaultScaleY: 1.0,
				zIndex: 5,
				svgContent: `
					<!-- Flares outwards at the bottom -->
					<path class="hair-color" fill="#3E2723" d="M 35 70 C 30 110, 20 160, 10 180 C 40 170, 60 150, 70 140 C 80 145, 120 145, 130 140 C 140 150, 160 170, 190 180 C 180 160, 170 110, 165 70 Z" />
					<!-- Inner Neck Shadow -->
					<path fill="#000000" opacity="0.5" d="M 60 120 C 80 140, 120 140, 140 120 L 130 140 C 120 145, 80 145, 70 140 Z" />
					<!-- Flared Shadow Edges -->
					<path fill="#000000" opacity="0.25" d="M 10 180 C 30 175, 40 160, 50 140 C 30 150, 20 165, 10 180 Z" />
					<path fill="#000000" opacity="0.25" d="M 190 180 C 170 175, 160 160, 150 140 C 170 150, 180 165, 190 180 Z" />
					<!-- Curved Highlight Swipes -->
					<path fill="#FFFFFF" opacity="0.1" d="M 25 150 C 40 160, 55 145, 65 130 C 50 145, 35 140, 25 150 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 175 150 C 160 160, 145 145, 135 130 C 150 145, 165 140, 175 150 Z" />
				`
			}
		]
	}
];
