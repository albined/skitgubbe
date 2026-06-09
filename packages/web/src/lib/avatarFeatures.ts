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
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<path class="skin-color" fill="#FFCDB2" d="M 25 75 C 5 70, 0 110, 25 125 C 35 165, 65 195, 100 195 C 135 195, 165 165, 175 125 C 200 110, 195 70, 175 75 C 170 25, 145 5, 100 5 C 55 5, 30 25, 25 75 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 60 5, 35 25, 30 70 C 40 30, 70 15, 100 15 C 120 15, 150 25, 165 50 C 150 20, 125 5, 100 5 Z" />
					<path fill="#000000" opacity="0.15" d="M 22 85 C 12 85, 12 110, 20 115 C 15 110, 15 90, 22 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 25 95 C 20 100, 20 110, 28 110 C 25 110, 22 105, 25 95 Z" />
					<path fill="#000000" opacity="0.15" d="M 178 85 C 188 85, 188 110, 180 115 C 185 110, 185 90, 178 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 175 95 C 180 100, 180 110, 172 110 C 175 110, 178 105, 175 95 Z" />
				`
			},
			{
				id: 'head_angular',
				name: 'Angular Jawline',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 20 70 C 0 65, 0 110, 20 115 L 25 150 C 30 185, 60 195, 100 195 C 140 195, 170 185, 175 150 L 180 115 C 200 110, 200 65, 180 70 C 175 20, 150 5, 100 5 C 50 5, 25 20, 20 70 Z" />
					<path fill="#FFFFFF" opacity="0.3" d="M 100 10 C 60 10, 35 25, 30 70 C 40 35, 65 25, 100 25 C 135 25, 160 35, 170 70 C 165 25, 140 10, 100 10 Z" />
					<path fill="none" stroke="#000000" stroke-width="3" opacity="0.15" stroke-linecap="round" d="M 18 80 L 12 100 L 18 110" />
					<path fill="none" stroke="#000000" stroke-width="3" opacity="0.15" stroke-linecap="round" d="M 182 80 L 188 100 L 182 110" />
				`
			},
			{
				id: 'head_pointy',
				name: 'Pointy Chin',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="blur-shadow-sle" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 30 75 C 10 70, 5 110, 30 120 C 35 150, 80 190, 100 190 C 120 190, 165 150, 170 120 C 195 110, 190 70, 170 75 C 165 20, 140 5, 100 5 C 60 5, 35 20, 30 75 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 65 5, 40 20, 35 70 C 45 25, 70 15, 100 15 C 125 15, 150 25, 160 55 C 145 20, 125 5, 100 5 Z" />
					<path fill="#000000" opacity="0.15" d="M 22 85 C 12 85, 12 110, 22 115 C 18 110, 18 90, 22 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 25 95 C 20 100, 20 110, 28 110 C 25 110, 22 105, 25 95 Z" />
					<path fill="#000000" opacity="0.15" d="M 178 85 C 188 85, 188 110, 178 115 C 182 110, 182 90, 178 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 175 95 C 180 100, 180 110, 172 110 C 175 110, 178 105, 175 95 Z" />

				`
			},
			{
				id: 'head_oval',
				name: 'Elongated Oval',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="oval-blur" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 30 85 C 10 80, 10 120, 30 125 C 35 165, 60 195, 100 195 C 140 195, 165 165, 170 125 C 190 120, 190 80, 170 85 C 160 30, 140 5, 100 5 C 60 5, 40 30, 30 85 Z" />
					<ellipse cx="100" cy="90" rx="45" ry="65" fill="#FFFFFF" opacity="0.15" filter="url(#oval-blur)" />
					<path fill="#FFFFFF" opacity="0.3" d="M 100 5 C 65 5, 45 25, 35 70 C 45 35, 65 18, 100 18 C 135 18, 155 35, 165 70 C 155 25, 135 5, 100 5 Z" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.1" stroke-linecap="round" d="M 22 95 Q 15 105 25 115" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.1" stroke-linecap="round" d="M 178 95 Q 185 105 175 115" />
				`
			},
			{
				id: 'head_chubby',
				name: 'Chubby Volume',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="chubby-soft" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="7" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 15 80 C -5 75, -5 125, 15 130 C 20 175, 55 195, 100 195 C 145 195, 180 175, 185 130 C 205 125, 205 75, 185 80 C 175 30, 150 15, 100 15 C 50 15, 25 30, 15 80 Z" />
					<path fill="#FFFFFF" opacity="0.25" d="M 100 15 C 60 15, 35 30, 25 70 C 40 35, 65 25, 100 25 C 135 25, 160 35, 175 70 C 165 30, 140 15, 100 15 Z" />
					<path fill="#000000" opacity="0.15" d="M 10 95 Q 5 105 12 115 Q 15 105 10 95 Z" />
					<path fill="#000000" opacity="0.15" d="M 190 95 Q 195 105 188 115 Q 185 105 190 95 Z" />
				`
			},
			{
				id: 'head_triangle',
				name: 'Triangle',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<path class="skin-color" fill="#FFCDB2" d="M 25 70 C 5 65, 0 105, 25 115 C 40 145, 70 195, 100 195 C 130 195, 160 145, 175 115 C 200 105, 195 65, 175 70 C 160 20, 135 5, 100 5 C 65 5, 40 20, 25 70 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 70 5, 45 20, 35 65 C 45 30, 70 15, 100 15 C 125 15, 145 25, 160 55 C 145 20, 125 5, 100 5 Z" />
					<path fill="#000000" opacity="0.15" d="M 18 80 C 5 80, 5 105, 18 110 C 12 105, 12 85, 18 80 Z" />
                    <path fill="#000000" opacity="0.1" d="M 20 90 C 15 95, 15 105, 22 105 C 18 105, 18 100, 20 90 Z" />
					<path fill="#000000" opacity="0.15" d="M 182 80 C 195 80, 195 105, 182 110 C 188 105, 188 85, 182 80 Z" />
					<path fill="#000000" opacity="0.1" d="M 180 90 C 185 95, 185 105, 178 105 C 182 105, 182 100, 180 90 Z" />
				`
			},
			{
				id: 'head_chubby',
				name: 'Chubby',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="blur-shadow-chub" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 25 80 C 5 75, 5 115, 20 125 C 5 170, 50 195, 100 195 C 150 195, 195 170, 180 125 C 195 115, 195 75, 175 80 C 165 25, 140 10, 100 10 C 60 10, 35 25, 25 80 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 10 C 65 10, 45 25, 35 75 C 45 35, 70 20, 100 20 C 120 20, 145 30, 160 60 C 145 25, 125 10, 100 10 Z" />
					<path fill="#000000" opacity="0.15" d="M 18 90 C 8 90, 8 115, 15 120 C 12 115, 12 95, 18 90 Z" />
					<path fill="#000000" opacity="0.1" d="M 20 100 C 15 105, 15 115, 22 115 C 18 115, 18 110, 20 100 Z" />
					<path fill="#000000" opacity="0.15" d="M 182 90 C 192 90, 192 115, 185 120 C 188 115, 188 95, 182 90 Z" />
					<path fill="#000000" opacity="0.1" d="M 180 100 C 185 105, 185 115, 178 115 C 182 115, 182 110, 180 100 Z" />
				`
			},
			{
				id: 'head_chiseled',
				name: 'Chiseled Face',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="chisel-edge" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="1.5" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 15 65 C -5 60, -5 100, 20 105 L 35 150 L 75 190 C 85 195, 115 195, 125 190 L 165 150 L 180 105 C 205 100, 205 60, 185 65 C 180 20, 145 5, 100 5 C 55 5, 20 20, 15 65 Z" />
					<path fill="#FFFFFF" opacity="0.3" d="M 100 5 C 60 5, 30 15, 25 50 L 40 25 C 60 15, 80 15, 100 15 C 120 15, 140 15, 160 25 L 175 50 C 170 15, 140 5, 100 5 Z" />
					<polygon points="25,100 45,115 35,95" fill="#FFFFFF" opacity="0.25" />
					<polygon points="175,100 155,115 165,95" fill="#FFFFFF" opacity="0.25" />
					<polyline points="15,80 8,95 18,100" fill="none" stroke="#000000" stroke-width="3" opacity="0.2" stroke-linejoin="miter" />
					<polyline points="185,80 192,95 182,100" fill="none" stroke="#000000" stroke-width="3" opacity="0.2" stroke-linejoin="miter" />
				`
			},
			{
				id: 'head_square',
				name: 'Square Face',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<path class="skin-color" fill="#FFCDB2" d="M 25 65 C 5 60, 5 105, 25 115 C 25 175, 50 195, 100 195 C 150 195, 175 175, 175 115 C 195 105, 195 60, 175 65 C 170 15, 140 5, 100 5 C 60 5, 30 15, 25 65 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 65 5, 40 15, 35 60 C 45 25, 70 15, 100 15 C 120 15, 150 25, 160 50 C 145 20, 125 5, 100 5 Z" />
					<path fill="#000000" opacity="0.15" d="M 18 75 C 8 75, 8 100, 18 105 C 12 100, 12 80, 18 75 Z" />
 					<path fill="#000000" opacity="0.1" d="M 20 85 C 15 90, 15 100, 22 100 C 18 100, 18 95, 20 85 Z" />
 					<path fill="#000000" opacity="0.15" d="M 182 75 C 192 75, 192 100, 182 105 C 188 100, 188 80, 182 75 Z" />
 					<path fill="#000000" opacity="0.1" d="M 180 85 C 185 90, 185 100, 178 100 C 182 100, 182 95, 180 85 Z" />
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
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<path d="M 20 100 C 60 40, 140 40, 180 90 C 140 140, 60 140, 20 100 Z" fill="#F9F9F9" />
					<path d="M 20 100 C 60 40, 140 40, 180 90 C 160 70, 80 70, 20 100 Z" fill="#000000" opacity="0.15" />
					<circle cx="25" cy="100" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow)" />
					<g clip-path="url(#eye-clip-1)">
						<circle class="eye-color" cx="100" cy="90" r="35" fill="#4CAF50" />
						<circle cx="100" cy="90" r="35" fill="none" stroke="#000000" stroke-width="10" opacity="0.3" />
						<circle cx="100" cy="90" r="15" fill="#111111" />
						<circle cx="90" cy="75" r="8" fill="#FFFFFF" opacity="0.9" />
						<circle cx="115" cy="105" r="4" fill="#FFFFFF" opacity="0.7" />
					</g>
					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 100 C 60 35, 140 35, 185 90" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 102 C 60 142, 140 142, 175 92" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 30 75 C 70 30, 130 30, 170 70" />
				`
			},
			{
				id: 'eye_sleepy',
				name: 'Sleepy / Bored',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-3">
							<path d="M 20 110 L 180 100 C 140 150, 60 150, 20 110 Z" />
						</clipPath>
					</defs>
					<path d="M 20 110 L 180 100 C 140 150, 60 150, 20 110 Z" fill="#F0F0F0" />
					<path d="M 20 110 L 180 100 C 160 115, 60 120, 20 110 Z" fill="#000000" opacity="0.15" />
					<g clip-path="url(#eye-clip-3)">
						<circle class="eye-color" cx="100" cy="100" r="35" fill="#4CAF50" />
						<circle cx="100" cy="100" r="35" fill="none" stroke="#000000" stroke-width="8" opacity="0.3" />
						<circle cx="100" cy="100" r="15" fill="#111111" />
						<circle cx="95" cy="105" r="5" fill="#FFFFFF" opacity="0.8" />
					</g>
					<path fill="none" stroke="#212121" stroke-width="10" stroke-linecap="round" d="M 15 110 L 185 100" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 20 110 C 60 155, 140 155, 180 100" />
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.4" d="M 25 85 C 70 70, 130 70, 175 80" />
				`
			},
			{
				id: 'eye_narrow',
				name: 'Tense / Narrow',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-4">
							<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 120, 70 120, 20 100 Z" />
						</clipPath>
					</defs>
					<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 120, 70 120, 20 100 Z" fill="#F9F9F9" />
					<path d="M 20 100 C 70 80, 130 80, 180 90 C 130 105, 70 105, 20 100 Z" fill="#000000" opacity="0.15" />
					<g clip-path="url(#eye-clip-4)">
						<circle class="eye-color" cx="100" cy="100" r="18" fill="#4CAF50" />
						<circle cx="100" cy="100" r="6" fill="#111111" />
						<circle cx="95" cy="95" r="3" fill="#FFFFFF" />
					</g>
					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 100 C 70 75, 130 75, 185 90" />
					<path fill="none" stroke="#212121" stroke-width="5" stroke-linecap="round" d="M 20 100 C 70 125, 130 125, 180 90" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.5" d="M 25 70 C 70 55, 130 55, 175 70" />
				`
			},
			{
				id: 'eye_sad',
				name: 'Droopy / Sad',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-6">
							<path d="M 20 80 C 80 50, 140 90, 180 140 C 120 150, 60 120, 20 80 Z" />
						</clipPath>
					</defs>
					<path d="M 20 80 C 80 50, 140 90, 180 140 C 120 150, 60 120, 20 80 Z" fill="#F9F9F9" />
					<g clip-path="url(#eye-clip-6)">
						<circle class="eye-color" cx="100" cy="85" r="30" fill="#4CAF50" />
						<circle cx="100" cy="85" r="30" fill="none" stroke="#000000" stroke-width="6" opacity="0.3" />
						<circle cx="100" cy="85" r="14" fill="#111111" />
						<circle cx="95" cy="70" r="7" fill="#FFFFFF" opacity="0.9" />
						<ellipse cx="115" cy="100" rx="8" ry="4" fill="#FFFFFF" opacity="0.6" transform="rotate(-20 115 100)" />
					</g>
					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 80 C 80 45, 140 85, 185 140" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.5" d="M 20 80 C 60 125, 120 155, 180 140" />
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.4" d="M 30 60 C 80 30, 140 60, 175 110" />
				`
			},
			{
				id: 'eye_anime',
				name: 'Sparkly Anime',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eyeClip7">
							<path d="M 20 100 C 40 20 150 30 180 120 C 140 180 60 160 20 100 Z" />
						</clipPath>
					</defs>
					<path fill="#FFFFFF" d="M 20 100 C 40 20 150 30 180 120 C 140 180 60 160 20 100 Z" />
					<g clip-path="url(#eyeClip7)">
						<ellipse cx="100" cy="100" rx="55" ry="70" class="eye-color" fill="#4A90E2" />
						<ellipse cx="100" cy="110" rx="45" ry="55" fill="#FFFFFF" opacity="0.2" />
						<ellipse cx="100" cy="90" rx="30" ry="40" fill="#000000" />
						<ellipse cx="80" cy="60" rx="15" ry="25" fill="#FFFFFF" opacity="0.95" />
						<circle cx="125" cy="120" r="12" fill="#FFFFFF" opacity="0.8" />
						<circle cx="140" cy="90" r="6" fill="#FFFFFF" opacity="0.6" />
						<path fill="#000000" opacity="0.25" d="M 0 0 L 200 0 L 200 70 C 150 90 50 90 0 70 Z" />
					</g>
					<path fill="none" stroke="#1A1A1A" stroke-width="18" stroke-linecap="round" d="M 15 100 C 35 15 155 25 185 120" />
					<path fill="none" stroke="#1A1A1A" stroke-width="10" stroke-linecap="round" d="M 25 75 L 10 50 M 55 40 L 40 10 M 100 35 L 100 5 M 150 55 L 170 30" />
				`
			},
			{
				id: 'eye_sad_droop',
				name: 'Sad / Regretful',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eyeClip6">
							<path d="M 20 80 C 80 40 160 100 180 120 C 140 160 60 140 20 80 Z" />
						</clipPath>
					</defs>
					<path fill="#FFFFFF" d="M 20 80 C 80 40 160 100 180 120 C 140 160 60 140 20 80 Z" />
					<g clip-path="url(#eyeClip6)">
						<circle cx="100" cy="110" r="45" class="eye-color" fill="#4A90E2" />
						<circle cx="100" cy="110" r="20" fill="#000000" />
						<circle cx="90" cy="90" r="10" fill="#FFFFFF" opacity="0.8" />
					</g>
					<path fill="none" stroke="#1A1A1A" stroke-width="12" stroke-linecap="round" d="M 15 80 C 75 35 165 95 185 120" />
					<path fill="none" stroke="#000000" opacity="0.25" stroke-width="6" stroke-linecap="round" d="M 25 50 C 70 20 140 70 175 90" />
				`
			},
			{
				id: 'eye_tired',
				name: 'Tired / Bloodshot',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eyeClip10">
							<path d="M 20 100 C 60 60 140 70 180 110 C 140 140 60 140 20 100 Z" />
						</clipPath>
					</defs>
					<path fill="#F9E4E4" d="M 20 100 C 60 60 140 70 180 110 C 140 140 60 140 20 100 Z" />
					<g clip-path="url(#eyeClip10)">
						<circle cx="100" cy="100" r="35" class="eye-color" fill="#4A90E2" opacity="0.7" />
						<circle cx="100" cy="100" r="15" fill="#000000" opacity="0.8" />
						<circle cx="90" cy="90" r="6" fill="#FFFFFF" opacity="0.5" />
						<path fill="none" stroke="#D9777F" stroke-width="2" d="M 20 100 Q 40 90 50 110 M 180 110 Q 160 90 150 100" opacity="0.6" />
					</g>
					<path fill="none" stroke="#1A1A1A" stroke-width="10" stroke-linecap="round" d="M 15 100 C 55 55 145 65 185 110" />
					<path fill="none" stroke="#63323A" opacity="0.4" stroke-width="12" stroke-linecap="round" d="M 25 125 C 70 180 140 160 175 125" />
					<path fill="none" stroke="#000000" opacity="0.2" stroke-width="4" stroke-linecap="round" d="M 40 145 C 80 185 130 165 160 140" />
				`
			},
			{
				id: 'eye_slanted',
				name: 'Slanted Focus',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-slanted">
							<path d="M 20 134 C 60 84, 120 64, 180 94 C 140 134, 80 154, 20 134 Z" />
						</clipPath>
						<filter id="eye-shadow-slanted" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<!-- Eye White (Sclera) -->
					<path d="M 20 134 C 60 84, 120 64, 180 94 C 140 134, 80 154, 20 134 Z" fill="#F9F9F9" />
					
					<!-- Sclera Inner Shadow -->
					<path d="M 20 134 C 60 84, 120 64, 180 94 C 120 94, 60 114, 20 134 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="134" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-slanted)" />

					<!-- Iris & Pupil Clipped to Eye Shape -->
					<g clip-path="url(#eye-clip-slanted)">
						<circle class="eye-color" cx="100" cy="114" r="35" fill="#4CAF50" />
						<circle cx="100" cy="114" r="35" fill="none" stroke="#000000" stroke-width="10" opacity="0.3" />
						<circle cx="100" cy="114" r="15" fill="#111111" />
						<circle cx="90" cy="99" r="8" fill="#FFFFFF" opacity="0.9" />
						<circle cx="115" cy="129" r="4" fill="#FFFFFF" opacity="0.7" />
					</g>

					<!-- Upper Eyelid / Lash Line -->
					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 134 C 60 79, 120 59, 185 94" />
					
					<!-- Lower Eyelid -->
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 136 C 80 156, 140 136, 175 96" />
					
					<!-- Crease Line -->
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.5" d="M 20 114 C 60 59, 120 44, 180 79" />
				`
			},
			{
				id: 'eye_wide_round',
				name: 'Wide Round Pupil',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-wide-round">
							<path d="M 20 100 C 50 10, 150 10, 180 100 C 150 190, 50 190, 20 100 Z" />
						</clipPath>
						<filter id="eye-shadow-wide-round" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 20 100 C 50 10, 150 10, 180 100 C 150 190, 50 190, 20 100 Z" fill="#F9F9F9" />
					<path d="M 20 100 C 50 10, 150 10, 180 100 C 150 50, 50 50, 20 100 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="100" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-wide-round)" />

					<g clip-path="url(#eye-clip-wide-round)">
						<circle class="eye-color" cx="100" cy="95" r="28" fill="#4CAF50" />
						<circle cx="100" cy="95" r="28" fill="none" stroke="#000000" stroke-width="8" opacity="0.3" />
						<circle cx="100" cy="95" r="12" fill="#111111" />
						<circle cx="93" cy="83" r="6" fill="#FFFFFF" opacity="0.9" />
						<circle cx="112" cy="108" r="3" fill="#FFFFFF" opacity="0.7" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 100 C 50 5, 150 5, 185 100" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 102 C 50 192, 150 192, 175 102" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 30 40 C 80 5, 120 5, 170 40" />
				`
			},
			{
				id: 'eye_flat_squint',
				name: 'Flat Squint',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-flat-squint">
							<path d="M 20 91 C 60 81, 140 81, 180 91 C 140 141, 60 141, 20 91 Z" />
						</clipPath>
						<filter id="eye-shadow-flat-squint" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 20 91 C 60 81, 140 81, 180 91 C 140 141, 60 141, 20 91 Z" fill="#F9F9F9" />
					<path d="M 20 91 C 60 81, 140 81, 180 91 C 140 89, 60 89, 20 91 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="91" r="8" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-flat-squint)" />

					<g clip-path="url(#eye-clip-flat-squint)">
						<circle class="eye-color" cx="100" cy="96" r="35" fill="#4CAF50" />
						<circle cx="100" cy="96" r="35" fill="none" stroke="#000000" stroke-width="10" opacity="0.3" />
						<circle cx="100" cy="96" r="15" fill="#111111" />
						<circle cx="90" cy="81" r="7" fill="#FFFFFF" opacity="0.8" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 91 C 60 79, 140 79, 185 91" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 93 C 60 143, 140 143, 175 93" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 30 66 C 70 56, 130 56, 170 71" />
				`
			},
			{
				id: 'eye_dramatic',
				name: 'Dramatic Sparkle',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-dramatic">
							<path d="M 30 149 C 40 39, 160 39, 170 129 C 140 169, 60 169, 30 149 Z" />
						</clipPath>
						<filter id="eye-shadow-dramatic" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 30 149 C 40 39, 160 39, 170 129 C 140 169, 60 169, 30 149 Z" fill="#F9F9F9" />
					<path d="M 30 149 C 40 39, 160 39, 170 129 C 160 89, 40 89, 30 149 Z" fill="#000000" opacity="0.1" />
					<circle cx="35" cy="149" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-dramatic)" />

					<g clip-path="url(#eye-clip-dramatic)">
						<circle class="eye-color" cx="100" cy="109" r="45" fill="#4CAF50" />
						<circle cx="100" cy="109" r="45" fill="none" stroke="#000000" stroke-width="12" opacity="0.3" />
						<circle cx="100" cy="109" r="20" fill="#111111" />
						<ellipse cx="85" cy="84" rx="12" ry="18" fill="#FFFFFF" opacity="0.9" transform="rotate(-15 85 84)" />
						<circle cx="125" cy="129" r="8" fill="#FFFFFF" opacity="0.8" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="9" stroke-linecap="round" d="M 20 149 C 35 29, 165 29, 180 129" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.5" d="M 35 151 C 60 171, 140 171, 165 131" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 40 69 C 80 29, 120 29, 160 69" />
				`
			},
			{
				id: 'eye_calm',
				name: 'Calm Steady',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-calm">
							<path d="M 20 124 C 80 84, 140 84, 180 104 C 140 124, 80 134, 20 124 Z" />
						</clipPath>
						<filter id="eye-shadow-calm" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 20 124 C 80 84, 140 84, 180 104 C 140 124, 80 134, 20 124 Z" fill="#F9F9F9" />
					<path d="M 20 124 C 80 84, 140 84, 180 104 C 140 99, 80 99, 20 124 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="124" r="8" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-calm)" />

					<g clip-path="url(#eye-clip-calm)">
						<circle class="eye-color" cx="110" cy="104" r="30" fill="#4CAF50" />
						<circle cx="110" cy="104" r="30" fill="none" stroke="#000000" stroke-width="8" opacity="0.3" />
						<circle cx="110" cy="104" r="12" fill="#111111" />
						<circle cx="102" cy="92" r="6" fill="#FFFFFF" opacity="0.9" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 124 C 80 79, 140 79, 185 104" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 126 C 80 136, 140 126, 175 106" />
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.4" d="M 30 99 C 80 64, 130 64, 175 89" />
				`
			},
			{
				id: 'eye_low_lids',
				name: 'Low Lids',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-low-lids">
							<path d="M 20 124 C 60 74, 120 74, 170 124 C 120 154, 60 154, 20 124 Z" />
						</clipPath>
						<filter id="eye-shadow-low-lids" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 20 124 C 60 74, 120 74, 170 124 C 120 154, 60 154, 20 124 Z" fill="#F9F9F9" />
					<path d="M 20 124 C 60 74, 120 74, 170 124 C 120 94, 60 94, 20 124 Z" fill="#000000" opacity="0.15" />
					<circle cx="25" cy="124" r="10" fill="#FFCDD2" opacity="0.5" filter="url(#eye-shadow-low-lids)" />

					<g clip-path="url(#eye-clip-low-lids)">
						<circle class="eye-color" cx="95" cy="114" r="33" fill="#4CAF50" />
						<circle cx="95" cy="114" r="33" fill="none" stroke="#000000" stroke-width="10" opacity="0.4" />
						<circle cx="95" cy="114" r="14" fill="#111111" />
						<circle cx="85" cy="99" r="7" fill="#FFFFFF" opacity="0.9" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 124 C 60 69, 120 69, 175 124" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.6" d="M 25 126 C 60 156, 120 156, 165 126" />
					<path fill="none" stroke="#5D4037" stroke-width="5" stroke-linecap="round" opacity="0.6" d="M 15 104 C 50 44, 130 44, 180 114" />
				`
			},
			{
				id: 'eye_angled_sharp',
				name: 'Angled Sharp',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<defs>
						<clipPath id="eye-clip-angled-sharp">
							<path d="M 20 92 C 60 57, 130 77, 180 112 C 130 122, 60 107, 20 92 Z" />
						</clipPath>
						<filter id="eye-shadow-angled-sharp" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>

					<path d="M 20 92 C 60 57, 130 77, 180 112 C 130 122, 60 107, 20 92 Z" fill="#F9F9F9" />
					<path d="M 20 92 C 60 57, 130 77, 180 112 C 130 92, 60 77, 20 92 Z" fill="#000000" opacity="0.1" />
					<circle cx="25" cy="92" r="10" fill="#FFCDD2" opacity="0.6" filter="url(#eye-shadow-angled-sharp)" />

					<g clip-path="url(#eye-clip-angled-sharp)">
						<circle class="eye-color" cx="100" cy="97" r="30" fill="#4CAF50" />
						<circle cx="100" cy="97" r="30" fill="none" stroke="#000000" stroke-width="8" opacity="0.3" />
						<circle cx="100" cy="97" r="13" fill="#111111" />
						<circle cx="92" cy="82" r="5" fill="#FFFFFF" opacity="0.7" />
					</g>

					<path fill="none" stroke="#212121" stroke-width="8" stroke-linecap="round" d="M 15 92 C 60 52, 130 72, 185 112" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.5" d="M 25 94 C 60 109, 130 124, 175 114" />
					<path fill="none" stroke="#5D4037" stroke-width="3" stroke-linecap="round" opacity="0.4" d="M 25 72 C 60 42, 120 57, 175 92" />
					
					<!-- Under-eye bag -->
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.3" d="M 25 127 C 70 147, 130 157, 175 137" />
				`
			},
			{
				id: 'eye_closed_down',
				name: 'Closed Restful',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<!-- Main Lash Line (Closed, curving downward) -->
					<path d="M 15 80 C 70 125, 130 125, 185 80 C 130 110, 70 110, 15 80 Z" fill="#212121" />
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
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<path class="eyebrow-color" fill="#5D4037" d="M 20 130 C 50 80, 120 70, 180 120 C 160 100, 100 80, 25 140 Z" filter="url(#brow-soft-1)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 20 125 C 60 85, 120 85, 180 120 C 140 105, 80 105, 20 140 Z" />
				`
			},
			{
				id: 'eyebrow_determined',
				name: 'Determined / Angular',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-2" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 15 150 C 70 120, 130 70, 185 60 C 160 75, 100 110, 20 165 Z" filter="url(#brow-soft-2)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 15 145 C 80 115, 130 75, 185 60 C 140 85, 80 125, 20 160 Z" />
					<path fill="none" stroke="#5D4037" stroke-width="4" stroke-linecap="round" opacity="0.4" d="M 25 130 C 35 110, 45 100, 50 100" />
				`
			},
			{
				id: 'eyebrow_sad',
				name: 'Sad / Worried',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-3" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 25 70 C 80 65, 130 110, 180 150 C 140 120, 90 85, 20 85 Z" filter="url(#brow-soft-3)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 25 70 C 70 65, 120 105, 180 150 C 130 120, 80 85, 20 85 Z" />
				`
			},
			{
				id: 'eyebrow_surprised',
				name: 'Surprised Arch',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-6" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 20 140 C 70 30, 140 30, 180 140 C 130 50, 80 50, 15 150 Z" filter="url(#brow-soft-6)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 20 140 C 70 30, 140 30, 180 140 C 140 55, 70 55, 15 150 Z" />
				`
			},
			{
				id: 'eyebrow_angry',
				name: 'Angry / Sharp',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-8" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 20 140 C 50 150, 120 70, 180 100 C 140 60, 60 110, 20 125 Z" filter="url(#brow-soft-8)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 20 140 C 50 150, 120 70, 180 100 C 130 65, 50 120, 20 125 Z" />
				`
			},
			{
				id: 'eyebrow_flat',
				name: 'Flat / Straight',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-9" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 20 95 L 180 95 C 185 105, 180 115, 170 115 L 20 115 C 15 105, 15 100, 20 95 Z" filter="url(#brow-soft-9)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 20 95 L 180 95 L 170 110 L 20 110 Z" />
				`
			},
			{
				id: 'eyebrow_sculpted',
				name: 'Sculpted / Elegant',
				defaultX: -30,
				defaultY: -30,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 30,
				svgContent: `
					<defs>
						<filter id="brow-soft-10" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path class="eyebrow-color" fill="#5D4037" d="M 20 130 C 60 100, 100 80, 140 80 C 160 80, 180 110, 180 110 C 160 95, 140 95, 130 105 C 90 115, 60 125, 20 145 Z" filter="url(#brow-soft-10)" />
					<path class="eyebrow-color" fill="#5D4037" d="M 20 130 C 60 95, 100 75, 140 75 C 160 75, 180 110, 180 110 C 160 95, 135 95, 130 105 C 80 120, 50 130, 20 145 Z" />
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
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<circle class="skin-color" cx="100" cy="130" r="40" fill="#FFCDB2" opacity="0.8" filter="url(#soft-nose)" />
					<path fill="#000000" opacity="0.15" d="M 60 130 C 60 160, 140 160, 140 130 C 120 145, 80 145, 60 130 Z" filter="url(#soft-nose)" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 50 120 C 40 135, 50 150, 70 140" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 150 120 C 160 135, 150 150, 130 140" />
					<ellipse cx="75" cy="135" rx="8" ry="4" fill="#000000" opacity="0.3" transform="rotate(-15 75 135)" />
					<ellipse cx="125" cy="135" rx="8" ry="4" fill="#000000" opacity="0.3" transform="rotate(15 125 135)" />
					<circle cx="100" cy="115" r="15" fill="#FFFFFF" opacity="0.5" filter="url(#soft-nose)" />
					<path fill="#FFFFFF" opacity="0.3" d="M 95 40 L 105 40 L 110 90 L 90 90 Z" filter="url(#soft-nose)" />
				`
			},
			{
				id: 'nose_angular',
				name: 'Angular Bridge',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="sharp-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="2" />
						</filter>
						<filter id="base-blur" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>
					<polygon class="skin-color" points="80,20 120,20 140,150 100,180 60,150" fill="#FFCDB2" filter="url(#base-blur)" />
					<polygon points="60,150 100,180 100,20 80,20" fill="#000000" opacity="0.1" filter="url(#sharp-shadow)" />
					<polygon points="60,150 100,180 140,150 100,160" fill="#000000" opacity="0.2" filter="url(#sharp-shadow)" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.4" stroke-linecap="round" d="M 70 145 L 85 155" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.4" stroke-linecap="round" d="M 130 145 L 115 155" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.15" stroke-linecap="round" stroke-linejoin="miter" d="M 50 120 L 45 140 L 70 145" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.15" stroke-linecap="round" stroke-linejoin="miter" d="M 150 120 L 155 140 L 130 145" />
					<polygon points="98,20 102,20 105,170 95,170" fill="#FFFFFF" opacity="0.6" filter="url(#sharp-shadow)" />
				`
			},
			{
				id: 'nose_flat',
				name: 'Flat / Wide',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="flat-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="5" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 70 20 C 130 20, 160 100, 180 140 C 180 170, 120 170, 100 170 C 80 170, 20 170, 20 140 C 40 100, 70 20, 70 20 Z" filter="url(#flat-shadow)" />
					<path fill="#000000" opacity="0.1" d="M 60 20 C 40 80, 20 130, 20 150 C 40 120, 60 100, 70 20 Z" filter="url(#flat-shadow)" />
					<path fill="#000000" opacity="0.1" d="M 140 20 C 160 80, 180 130, 180 150 C 160 120, 140 100, 130 20 Z" filter="url(#flat-shadow)" />
					<path fill="#000000" opacity="0.15" d="M 30 140 C 70 175, 130 175, 170 140 C 130 155, 70 155, 30 140 Z" filter="url(#flat-shadow)" />
					<ellipse cx="60" cy="145" rx="15" ry="6" fill="#000000" opacity="0.3" transform="rotate(-10 60 145)" />
					<ellipse cx="140" cy="145" rx="15" ry="6" fill="#000000" opacity="0.3" transform="rotate(10 140 145)" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 20 130 C 10 150, 30 165, 50 155" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 180 130 C 190 150, 170 165, 150 155" />
					<rect x="80" y="20" width="40" height="130" rx="20" fill="#FFFFFF" opacity="0.25" filter="url(#flat-shadow)" />
				`
			},
			{
				id: 'nose_hook',
				name: 'Hooked Nose',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="hook-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 70 20 L 130 20 C 140 70, 150 100, 140 140 C 130 180, 110 190, 100 190 C 90 190, 70 180, 60 140 C 50 100, 60 70, 70 20 Z" filter="url(#hook-shadow)" />
					<path fill="#000000" opacity="0.15" d="M 70 20 C 40 80, 40 110, 60 150 C 80 185, 100 190, 100 190 L 100 20 Z" filter="url(#hook-shadow)" />
					<path fill="#000000" opacity="0.25" d="M 60 140 C 80 160, 120 160, 140 140 C 120 195, 80 195, 60 140 Z" filter="url(#hook-shadow)" />
					<path fill="#FFFFFF" opacity="0.4" d="M 85 80 C 115 80, 125 120, 100 160 C 75 120, 85 80, 85 80 Z" filter="url(#hook-shadow)" />
					<path fill="none" stroke="#000000" stroke-width="5" opacity="0.3" stroke-linecap="round" d="M 50 120 C 60 115, 70 125, 65 135" />
					<path fill="none" stroke="#000000" stroke-width="5" opacity="0.3" stroke-linecap="round" d="M 150 120 C 140 115, 130 125, 135 135" />
					<path fill="none" stroke="#000000" stroke-width="5" opacity="0.15" stroke-linecap="round" d="M 40 100 C 30 115, 40 130, 55 125" />
					<path fill="none" stroke="#000000" stroke-width="5" opacity="0.15" stroke-linecap="round" d="M 160 100 C 170 115, 160 130, 145 125" />
				`
			},
			{
				id: 'nose_dot',
				name: 'Simple Dot',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="dot-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>
					<circle class="skin-color" cx="100" cy="130" r="30" fill="#FFCDB2" opacity="0.5" filter="url(#dot-shadow)" />
					<circle cx="75" cy="135" r="5" fill="#5D4037" opacity="0.7" />
					<circle cx="125" cy="135" r="5" fill="#5D4037" opacity="0.7" />
					<path fill="none" stroke="#5D4037" stroke-width="3" opacity="0.4" stroke-linecap="round" d="M 68 132 C 70 128, 75 128, 78 130" />
					<path fill="none" stroke="#5D4037" stroke-width="3" opacity="0.4" stroke-linecap="round" d="M 132 132 C 130 128, 125 128, 122 130" />
					<ellipse cx="100" cy="115" rx="8" ry="4" fill="#FFFFFF" opacity="0.6" filter="url(#dot-shadow)" />
				`
			},
			{
				id: 'nose_bulbous',
				name: 'Bulbous',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-bulbous" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>
					
					<!-- Seamless Base Shapes -->
					<g filter="url(#soft-nose-bulbous)">
						<path class="skin-color" fill="#FFCDB2" d="M 75 20 L 125 20 L 140 120 L 60 120 Z" />
						<circle class="skin-color" fill="#FFCDB2" cx="100" cy="140" r="45" />
						<circle class="skin-color" fill="#FFCDB2" cx="55" cy="145" r="30" />
						<circle class="skin-color" fill="#FFCDB2" cx="145" cy="145" r="30" />
					</g>

					<!-- Underside Shadow -->
					<path fill="#000000" opacity="0.15" d="M 25 145 C 25 200, 175 200, 175 145 C 145 175, 55 175, 25 145 Z" filter="url(#soft-nose-bulbous)" />

					<!-- Nostril C-Curves -->
					<path fill="none" stroke="#000000" stroke-width="7" opacity="0.2" stroke-linecap="round" d="M 35 125 C 20 145, 35 170, 60 170" />
					<path fill="none" stroke="#000000" stroke-width="7" opacity="0.2" stroke-linecap="round" d="M 165 125 C 180 145, 165 170, 140 170" />

					<!-- Inner Nostril Holes -->
					<ellipse cx="65" cy="160" rx="12" ry="6" fill="#000000" opacity="0.35" transform="rotate(-15 65 160)" />
					<ellipse cx="135" cy="160" rx="12" ry="6" fill="#000000" opacity="0.35" transform="rotate(15 135 160)" />

					<!-- Highlights -->
					<circle cx="100" cy="125" r="20" fill="#FFFFFF" opacity="0.5" filter="url(#soft-nose-bulbous)" />
					<path fill="#FFFFFF" opacity="0.3" d="M 90 20 L 110 20 L 115 100 L 85 100 Z" filter="url(#soft-nose-bulbous)" />
				`
			},
			{
				id: 'nose_slim',
				name: 'Slim Bridge',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-slim" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="5" />
						</filter>
					</defs>

					<!-- Seamless Base Shapes -->
					<g filter="url(#soft-nose-slim)">
						<path class="skin-color" fill="#FFCDB2" d="M 85 10 L 115 10 L 120 130 L 80 130 Z" />
						<ellipse class="skin-color" fill="#FFCDB2" cx="100" cy="150" rx="25" ry="35" />
						<circle class="skin-color" fill="#FFCDB2" cx="70" cy="155" r="18" />
						<circle class="skin-color" fill="#FFCDB2" cx="130" cy="155" r="18" />
					</g>

					<!-- Subtle Side Shadows to Slim the Bridge -->
					<path fill="#000000" opacity="0.1" d="M 70 10 L 85 10 L 80 130 L 60 130 Z" filter="url(#soft-nose-slim)" />
					<path fill="#000000" opacity="0.1" d="M 130 10 L 115 10 L 120 130 L 140 130 Z" filter="url(#soft-nose-slim)" />

					<!-- Underside Shadow -->
					<path fill="#000000" opacity="0.15" d="M 52 155 C 52 195, 148 195, 148 155 C 130 175, 70 175, 52 155 Z" filter="url(#soft-nose-slim)" />

					<!-- Nostril C-Curves -->
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 60 142 C 45 155, 55 170, 75 168" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 140 142 C 155 155, 145 170, 125 168" />

					<!-- Inner Nostril Slits -->
					<ellipse cx="80" cy="165" rx="4" ry="9" fill="#000000" opacity="0.3" transform="rotate(-30 80 165)" />
					<ellipse cx="120" cy="165" rx="4" ry="9" fill="#000000" opacity="0.3" transform="rotate(30 120 165)" />

					<!-- Highlights -->
					<ellipse cx="100" cy="140" rx="10" ry="15" fill="#FFFFFF" opacity="0.6" filter="url(#soft-nose-slim)" />
					<rect x="94" y="10" width="12" height="110" fill="#FFFFFF" opacity="0.3" filter="url(#soft-nose-slim)" />
				`
			},
			{
				id: 'nose_drooping',
				name: 'Drooping Tip',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-drooping" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>

					<!-- Seamless Base Shapes -->
					<g filter="url(#soft-nose-drooping)">
						<path class="skin-color" fill="#FFCDB2" d="M 80 10 L 120 10 L 125 60 L 75 60 Z" />
						<ellipse class="skin-color" fill="#FFCDB2" cx="100" cy="80" rx="35" ry="40" />
						<path class="skin-color" fill="#FFCDB2" d="M 70 80 L 130 80 L 125 140 L 75 140 Z" />
						<circle class="skin-color" fill="#FFCDB2" cx="100" cy="155" r="35" />
						<circle class="skin-color" fill="#FFCDB2" cx="60" cy="145" r="25" />
						<circle class="skin-color" fill="#FFCDB2" cx="140" cy="145" r="25" />
					</g>

					<!-- Deep Shadow Under Drooping Tip -->
					<path fill="#000000" opacity="0.25" d="M 35 145 C 35 210, 165 210, 165 145 C 140 175, 60 175, 35 145 Z" filter="url(#soft-nose-drooping)" />

					<!-- Nostril C-Curves -->
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 45 125 C 30 145, 45 165, 70 160" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.25" stroke-linecap="round" d="M 155 125 C 170 145, 155 165, 130 160" />

					<!-- Inner Nostril Holes -->
					<ellipse cx="70" cy="165" rx="14" ry="5" fill="#000000" opacity="0.3" transform="rotate(-20 70 165)" />
					<ellipse cx="130" cy="165" rx="14" ry="5" fill="#000000" opacity="0.3" transform="rotate(20 130 165)" />

					<!-- Prominent Highlights (Bridge Flare & Tip) -->
					<ellipse cx="100" cy="80" rx="15" ry="25" fill="#FFFFFF" opacity="0.6" filter="url(#soft-nose-drooping)" />
					<circle cx="100" cy="160" r="12" fill="#FFFFFF" opacity="0.4" filter="url(#soft-nose-drooping)" />
				`
			},
			{
				id: 'nose_wide_round',
				name: 'Wide Round',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-wide" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="8" />
						</filter>
					</defs>

					<!-- Seamless Base Shapes -->
					<g filter="url(#soft-nose-wide)">
						<path class="skin-color" fill="#FFCDB2" d="M 85 10 L 115 10 L 125 110 L 75 110 Z" />
						<circle class="skin-color" fill="#FFCDB2" cx="100" cy="150" r="50" />
						<circle class="skin-color" fill="#FFCDB2" cx="45" cy="140" r="35" />
						<circle class="skin-color" fill="#FFCDB2" cx="155" cy="140" r="35" />
					</g>

					<!-- Heavy Wrapping Lower Shadow -->
					<path fill="#000000" opacity="0.2" d="M 10 140 C 10 220, 190 220, 190 140 C 160 170, 40 170, 10 140 Z" filter="url(#soft-nose-wide)" />

					<!-- Soft Crease Lines Separating Nostrils from Tip -->
					<path d="M 65 120 Q 75 160 100 190 Q 125 160 135 120" fill="none" stroke="#000000" stroke-width="8" opacity="0.15" filter="url(#soft-nose-wide)" stroke-linecap="round" />

					<!-- Soft Nostril Outer Curves -->
					<path fill="none" stroke="#000000" stroke-width="8" opacity="0.2" stroke-linecap="round" d="M 25 115 C 5 140, 20 170, 55 165" />
					<path fill="none" stroke="#000000" stroke-width="8" opacity="0.2" stroke-linecap="round" d="M 175 115 C 195 140, 180 170, 145 165" />

					<!-- Nostril Holes -->
					<ellipse cx="60" cy="165" rx="14" ry="8" fill="#000000" opacity="0.3" transform="rotate(-15 60 165)" />
					<ellipse cx="140" cy="165" rx="14" ry="8" fill="#000000" opacity="0.3" transform="rotate(15 140 165)" />

					<!-- Dual Fleshy Highlights -->
					<circle cx="85" cy="135" r="15" fill="#FFFFFF" opacity="0.5" filter="url(#soft-nose-wide)" />
					<circle cx="115" cy="135" r="10" fill="#FFFFFF" opacity="0.4" filter="url(#soft-nose-wide)" />
					<circle cx="45" cy="120" r="12" fill="#FFFFFF" opacity="0.3" filter="url(#soft-nose-wide)" />
					<circle cx="155" cy="120" r="12" fill="#FFFFFF" opacity="0.3" filter="url(#soft-nose-wide)" />
				`
			},
			{
				id: 'nose_sharp',
				name: 'Sharp Faceted',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-sharp" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
					</defs>

					<!-- Seamless Base Shapes - Sharp Polygons & Rotated Ellipses -->
					<g filter="url(#soft-nose-sharp)">
						<path class="skin-color" fill="#FFCDB2" d="M 85 10 L 115 10 L 125 80 L 75 80 Z" />
						<polygon class="skin-color" fill="#FFCDB2" points="75,80 125,80 135,140 100,185 65,140" />
						<ellipse class="skin-color" fill="#FFCDB2" cx="50" cy="130" rx="18" ry="25" transform="rotate(-15 50 130)" />
						<ellipse class="skin-color" fill="#FFCDB2" cx="150" cy="130" rx="18" ry="25" transform="rotate(15 150 130)" />
					</g>

					<!-- Distinct Facet Shadow for Sharpness -->
					<polygon points="100,185 135,140 100,160" fill="#000000" opacity="0.2" filter="url(#soft-nose-sharp)" />
					<polygon points="65,140 100,185 100,160" fill="#000000" opacity="0.1" filter="url(#soft-nose-sharp)" />
					<path fill="#000000" opacity="0.15" d="M 40 140 L 100 195 L 160 140 C 130 160, 70 160, 40 140 Z" filter="url(#soft-nose-sharp)" />

					<!-- Nostril Hook C-Curves -->
					<path fill="none" stroke="#000000" stroke-width="7" opacity="0.25" stroke-linecap="round" stroke-linejoin="miter" d="M 45 105 C 25 125, 35 150, 60 145" />
					<path fill="none" stroke="#000000" stroke-width="7" opacity="0.25" stroke-linecap="round" stroke-linejoin="miter" d="M 155 105 C 175 125, 165 150, 140 145" />

					<!-- Slit-like Nostril Holes -->
					<ellipse cx="65" cy="150" rx="5" ry="12" fill="#000000" opacity="0.4" transform="rotate(-35 65 150)" />
					<ellipse cx="135" cy="150" rx="5" ry="12" fill="#000000" opacity="0.4" transform="rotate(35 135 150)" />

					<!-- Hard Narrow Highlight Strip -->
					<polygon points="95,10 105,10 110,130 100,170 90,130" fill="#FFFFFF" opacity="0.5" filter="url(#soft-nose-sharp)" />
				`
			},
			{
				id: 'nose_rectangular',
				name: 'Rectangular',
				defaultX: 0,
				defaultY: 5,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 25,
				svgContent: `
					<defs>
						<filter id="soft-nose-rect" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="5" />
						</filter>
					</defs>

					<!-- Seamless Base Shapes - Pure Rectangular Structure -->
					<g filter="url(#soft-nose-rect)">
						<rect class="skin-color" fill="#FFCDB2" x="75" y="10" width="50" height="130" />
						<rect class="skin-color" fill="#FFCDB2" x="75" y="140" width="50" height="30" rx="15" />
						<circle class="skin-color" fill="#FFCDB2" cx="55" cy="150" r="22" />
						<circle class="skin-color" fill="#FFCDB2" cx="145" cy="150" r="22" />
					</g>

					<!-- Clean Symmetrical Side Shadows -->
					<rect x="70" y="10" width="10" height="140" fill="#000000" opacity="0.1" filter="url(#soft-nose-rect)" />
					<rect x="120" y="10" width="10" height="140" fill="#000000" opacity="0.1" filter="url(#soft-nose-rect)" />

					<!-- Straight Underside Shadow -->
					<path fill="#000000" opacity="0.15" d="M 33 150 L 33 165 C 80 180, 120 180, 167 165 L 167 150 C 130 165, 70 165, 33 150 Z" filter="url(#soft-nose-rect)" />

					<!-- Crisp Nostril Curves -->
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 40 135 C 30 150, 40 168, 60 168" />
					<path fill="none" stroke="#000000" stroke-width="6" opacity="0.2" stroke-linecap="round" d="M 160 135 C 170 150, 160 168, 140 168" />

					<!-- Nostril Holes -->
					<ellipse cx="65" cy="162" rx="10" ry="4" fill="#000000" opacity="0.3" transform="rotate(-5 65 162)" />
					<ellipse cx="135" cy="162" rx="10" ry="4" fill="#000000" opacity="0.3" transform="rotate(5 135 162)" />

					<!-- Perfectly Straight Highlight Block -->
					<rect x="90" y="10" width="20" height="150" rx="10" fill="#FFFFFF" opacity="0.4" filter="url(#soft-nose-rect)" />
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
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 35,
				svgContent: `
					<path fill="none" stroke="#A1695A" stroke-width="6" opacity="0.4" stroke-linecap="round" d="M 25 70 C 15 80, 15 100, 25 110" />
					<path fill="none" stroke="#A1695A" stroke-width="6" opacity="0.4" stroke-linecap="round" d="M 175 70 C 185 80, 185 100, 175 110" />
					<path fill="#D84315" opacity="0.8" d="M 30 85 C 60 160, 140 160, 170 85 C 140 120, 60 120, 30 85 Z" />
					<path fill="none" stroke="#3E2723" stroke-width="8" stroke-linecap="round" d="M 30 85 C 70 130, 130 130, 170 85" />
					<path fill="#E64A19" opacity="0.7" d="M 30 85 C 60 100, 80 70, 100 80 C 120 70, 140 100, 170 85 C 130 115, 70 115, 30 85 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 70 120 C 85 130, 115 130, 130 120 C 110 125, 90 125, 70 120 Z" filter="url(#lip-glow)" />
				`
			},
			{
				id: 'mouth_teeth',
				name: 'Toothy Grin',
				defaultX: 0,
				defaultY: 35,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 35,
				svgContent: `
					<path fill="#2D130E" d="M 15 70 C 50 160, 150 160, 185 70 C 150 50, 50 50, 15 70 Z" />
					<path fill="#FFFFFF" d="M 22 75 C 60 130, 140 130, 178 75 C 140 65, 60 65, 22 75 Z" />
					<path fill="none" stroke="#BCAAA4" stroke-width="3" opacity="0.6" d="M 100 68 L 100 110 M 75 70 L 70 105 M 125 70 L 130 105 M 50 72 L 45 95 M 150 72 L 155 95" />
					<path fill="#FF8A80" opacity="0.6" d="M 22 75 C 60 85, 140 85, 178 75 C 140 65, 60 65, 22 75 Z" />
					<path fill="#E57373" d="M 15 70 C 50 175, 150 175, 185 70 C 140 160, 60 160, 15 70 Z" />
					<path fill="#EF5350" d="M 15 70 C 50 35, 150 35, 185 70 C 140 50, 60 50, 15 70 Z" />
					<path fill="#FFFFFF" opacity="0.3" d="M 50 145 C 80 160, 120 160, 150 145 C 120 152, 80 152, 50 145 Z" />
				`
			},
			{
				id: 'mouth_smirk',
				name: 'Asymmetric Smirk',
				defaultX: 0,
				defaultY: 35,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 35,
				svgContent: `
					<defs>
						<filter id="smirk-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="3" />
						</filter>
					</defs>
					<path fill="none" stroke="#A1695A" stroke-width="6" opacity="0.6" stroke-linecap="round" d="M 180 30 C 170 50, 175 80, 190 90" />
					<path fill="#A1695A" opacity="0.3" d="M 160 40 C 180 60, 170 90, 160 40 Z" filter="url(#smirk-shadow)" />
					<path fill="#D84315" opacity="0.8" d="M 20 120 C 70 140, 130 110, 180 50 C 130 90, 70 110, 20 120 Z" />
					<path fill="none" stroke="#3E2723" stroke-width="8" stroke-linecap="round" d="M 20 120 C 70 115, 130 90, 180 50" />
					<path fill="#E64A19" opacity="0.7" d="M 20 120 C 60 100, 90 85, 110 80 C 130 75, 150 65, 180 50 C 130 80, 70 100, 20 120 Z" />
					<path fill="none" stroke="#3E2723" stroke-width="4" stroke-linecap="round" d="M 180 50 C 185 45, 188 48, 185 55" />
					<path fill="#FFFFFF" opacity="0.3" d="M 60 120 C 90 125, 120 110, 140 90 C 110 110, 90 115, 60 120 Z" />
				`
			},
			{
				id: 'mouth_laugh',
				name: 'Laughing Open',
				defaultX: 0,
				defaultY: 35,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 35,
				svgContent: `
					<path fill="none" stroke="#A1695A" stroke-width="8" opacity="0.5" stroke-linecap="round" d="M 15 50 C 5 70, 5 100, 20 120" />
					<path fill="none" stroke="#A1695A" stroke-width="8" opacity="0.5" stroke-linecap="round" d="M 185 50 C 195 70, 195 100, 180 120" />
					<path fill="#2D130E" d="M 20 70 C 60 40, 140 40, 180 70 C 190 150, 150 180, 100 180 C 50 180, 10 150, 20 70 Z" />
					<path fill="#FFFFFF" d="M 23 70 C 60 55, 140 55, 177 70 C 160 95, 130 100, 100 100 C 70 100, 40 95, 23 70 Z" />
					<path fill="none" stroke="#BCAAA4" stroke-width="3" opacity="0.5" d="M 100 62 L 100 100 M 75 64 L 70 95 M 125 64 L 130 95 M 50 67 L 45 85 M 150 67 L 155 85" />
					<path fill="#FF5252" d="M 40 130 C 60 90, 140 90, 160 130 C 150 165, 130 175, 100 175 C 70 175, 50 165, 40 130 Z" />
					<path fill="#D32F2F" d="M 100 100 C 110 120, 130 130, 160 130 C 150 165, 130 175, 100 175 Z" opacity="0.4" />
					<path fill="none" stroke="#B71C1C" stroke-width="5" stroke-linecap="round" d="M 100 110 C 100 130, 95 150, 95 160" />
					<path fill="#E57373" d="M 20 70 C 10 160, 50 195, 100 195 C 150 195, 190 160, 180 70 C 160 170, 140 180, 100 180 C 60 180, 40 170, 20 70 Z" />
					<path fill="#EF5350" d="M 20 70 C 60 30, 140 30, 180 70 C 140 45, 60 45, 20 70 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 60 180 C 80 190, 120 190, 140 180 C 120 185, 80 185, 60 180 Z" />
				`
			},
			{
				id: 'mouth_cute_fangs',
				name: 'Cute / Fangs',
				defaultX: 0,
				defaultY: 35,
				defaultScaleX: 0.25,
				defaultScaleY: 0.25,
				zIndex: 35,
				svgContent: `
					<path fill="#FF8A80" d="M 70 100 C 70 150, 130 150, 130 100 Z" />
					<path fill="#D32F2F" d="M 80 120 C 80 150, 120 150, 120 120 Z" />
					<polygon points="75,100 85,100 80,120" fill="#FFFFFF" />
					<polygon points="125,100 115,100 120,120" fill="#FFFFFF" />
					<path fill="none" stroke="#3E2723" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" d="M 20 80 C 40 130, 80 130, 100 100 C 120 130, 160 130, 180 80" />
					<path fill="none" stroke="#E57373" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" d="M 23 80 C 40 124, 80 124, 100 95 C 120 124, 160 124, 177 80" />
					<ellipse cx="30" cy="110" rx="20" ry="10" fill="#FF5252" opacity="0.4" />
					<ellipse cx="170" cy="110" rx="20" ry="10" fill="#FF5252" opacity="0.4" />
					<path fill="none" stroke="#D32F2F" stroke-width="3" opacity="0.5" stroke-linecap="round" d="M 20 105 L 30 115 M 30 105 L 40 115 M 40 105 L 50 115" />
					<path fill="none" stroke="#D32F2F" stroke-width="3" opacity="0.5" stroke-linecap="round" d="M 160 105 L 170 115 M 170 105 L 180 115 M 180 105 L 190 115" />
				`
			}
		]
	},
	{
		id: 'hair_front',
		name: 'Hair (Front)',
		features: [
			{
				id: 'hair_front_long_sidepart',
				name: 'Long Sidepart',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(30.52, 0)">
					<path d="M31.124,131.827L31.139,131.833C31.377,131.928 31.504,132.189 31.433,132.436C31.362,132.682 31.115,132.835 30.863,132.789L30.768,132.756L30.766,132.761L30.688,132.728L30.657,132.717L30.647,132.71C28.992,131.97 26.846,129.495 24.932,126.296C23.302,123.57 21.83,120.328 20.935,117.254C20.911,124.132 21.257,135.122 23.368,143.039C24.062,145.639 24.943,147.903 26.075,149.563C26.919,150.802 27.898,151.699 29.051,152.109C29.679,152.271 30.031,152.334 30.031,152.334C30.297,152.382 30.477,152.632 30.437,152.899C30.398,153.166 30.154,153.354 29.885,153.323L29.855,153.319C29.477,153.273 29.112,153.188 28.76,153.067C25.249,152.153 14.07,148.434 6.724,136.741C0.886,127.449 -2.548,113.099 2.317,91.066C7.631,66.995 9.145,53.131 11.355,43.107C13.585,32.99 16.515,26.749 24.685,17.956C31.087,11.065 49.503,2.133 67.124,0.327C78.948,-0.885 90.401,1.117 97.68,8.981C97.798,9.109 97.841,9.288 97.794,9.456L93.152,26.005C93.11,26.156 93,26.278 92.854,26.335C92.854,26.335 76.273,32.889 43.583,45.112C34.237,48.607 29.368,58.678 27.094,70.73C23.641,89.031 26.22,111.921 28.744,123.933C29.472,127.399 30.191,129.951 30.762,131.207C30.892,131.493 31.081,131.766 31.124,131.827Z" class="hair-color"/>
					<path d="M89.715,26.356L97.122,9.357C97.205,9.166 97.398,9.046 97.606,9.057C121.937,10.302 132.424,31.87 132.664,32.376C134.962,37.227 136.043,46.037 136.671,56.549C137.606,72.19 137.567,91.624 139.223,107.28C141.502,128.827 129.908,141.601 122.062,147.063C119.677,148.723 117.63,149.711 116.408,150.077C115.743,150.276 115.265,150.279 115.032,150.189C114.871,150.127 114.753,149.986 114.72,149.816C114.688,149.646 114.746,149.472 114.873,149.355C123.088,141.788 124.053,132.788 124.011,128.69C123.819,129.047 123.596,129.425 123.343,129.82C121.282,133.042 117.251,137.449 112.591,139.824C112.351,139.947 112.057,139.857 111.927,139.621C111.796,139.385 111.877,139.088 112.108,138.95C114.671,137.42 116.664,134.98 118.204,131.871C120.561,127.116 121.856,120.81 122.457,113.75C123.973,95.956 121.07,73.395 119.336,58.536C118.986,55.533 117.998,51.095 117.114,49.076C110.7,34.428 90.004,27.026 90.004,27.026C89.874,26.98 89.769,26.881 89.714,26.754C89.66,26.627 89.66,26.483 89.715,26.356Z" class="hair-color"/>
					<path d="M91.342,26.328C91.313,26.386 97.025,18.968 98.076,9.556C98.076,9.556 97.754,12.992 99.803,13.206C99.803,13.206 95.715,14.757 98.044,18.299C96.656,18.294 93.122,22.728 95.221,25.266C95.221,25.266 93.828,24.209 91.342,26.328Z" class="hair-shadow"/>
					<path d="M20.335,115.802C20.335,115.802 18.785,100.486 22.862,86.293C22.862,86.293 20.371,115.744 24.598,124.468L20.335,115.802Z" class="hair-shadow"/>
					<path d="M118.278,134.8C118.278,134.8 127.741,123.293 127.087,95.11C127.318,94.818 128.838,111.448 127.087,118.713C125.186,126.594 118.527,135.908 118.278,134.8Z" class="hair-shadow"/>
					<path d="M43.78,12.62C43.78,12.62 18.763,16.493 13.147,57.221C13.147,57.221 18.38,41.173 29.74,33.537C41.099,25.9 43.525,11.845 43.78,12.62" class="hair-light"/>
					</g>
				`
			},
			{
				id: 'hair_front_short_spiky',
				name: 'Short Spiky',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(47.28, 0)">
					<path d="M0.01,70.662C0.005,60.523 0.237,52.593 1.316,46.397C2.418,40.073 4.408,35.534 7.883,32.279C10.663,29.675 14.399,27.888 19.426,26.687C26.841,24.915 37.102,24.415 51.281,24.37C62.991,24.333 72.054,24.576 79.099,25.612C86.241,26.663 91.332,28.537 95.02,31.725C98.72,34.923 101.023,39.447 102.538,45.842C104.03,52.135 104.764,60.26 105.366,70.736C105.432,71.884 105.146,72.644 104.696,73.139C104.023,73.877 102.924,74.051 101.798,73.919C100.127,73.723 98.418,72.892 98.418,72.892C98.364,72.865 98.315,72.829 98.273,72.785C97.775,72.256 97.392,71.214 97.082,69.799C96.653,67.847 96.315,65.146 95.756,62.195C94.392,54.996 91.736,46.237 82.937,43.619C69.705,39.68 42.452,39.546 23.775,43.091C14.364,44.877 10.462,51.904 8.897,58.47C7.315,65.11 8.11,71.298 8.11,71.298C8.134,71.481 8.055,71.662 7.904,71.769C5.925,73.18 4.336,73.4 3.132,73.164C1.407,72.825 0.433,71.523 0.161,71.131C0.115,71.086 0.077,71.031 0.05,70.969L0.005,70.823L0,70.707L0.01,70.662Z" style="fill:url(#hair_front_short_spiky_grad_1);"/>
					<path d="M36.836,1.743C36.958,1.679 37.105,1.666 37.243,1.718L37.434,1.837L37.521,1.95L37.572,2.074L37.588,2.185L37.579,2.299L37.54,2.419L37.458,2.54L37.446,2.551C35.542,6.587 38.524,9.316 40.693,10.554C40.92,10.683 41.159,10.798 41.384,10.897C40.873,9.891 40.698,8.963 40.771,8.114C40.923,6.361 42.151,4.906 43.875,3.756C47.912,1.061 54.658,0.006 54.658,0.006C54.868,-0.027 55.077,0.078 55.176,0.266C55.276,0.455 55.245,0.686 55.1,0.841C53.969,2.052 53.437,3.228 53.348,4.354C53.213,6.051 54.075,7.609 55.264,8.95C57.27,11.212 60.23,12.858 61.459,13.472C64.683,12.981 66.341,11.736 67.145,10.37C68.337,8.347 67.645,6.129 67.645,6.129C67.593,5.962 67.632,5.779 67.748,5.648C67.865,5.517 68.041,5.457 68.214,5.489C72.967,6.374 75.839,7.78 77.678,9.48C79.484,11.149 80.311,13.108 80.911,15.194C82.678,16.108 84.052,16.196 85.119,15.825C86.132,15.472 86.852,14.717 87.359,13.947C88.151,12.746 88.431,11.493 88.431,11.493C88.471,11.315 88.604,11.172 88.779,11.121C88.954,11.07 89.143,11.118 89.273,11.247C94.186,16.156 94.116,20.752 93.256,23.227C93.074,23.751 92.854,24.185 92.634,24.515C93.764,24.504 94.596,23.802 95.208,22.909C96.474,21.064 96.856,18.414 96.856,18.414C96.89,18.177 97.089,17.997 97.329,17.987C97.569,17.977 97.783,18.139 97.837,18.373C99.39,25.015 98.571,29.948 96.687,33.601C92.278,42.15 81.968,43.713 81.968,43.713C81.943,43.716 81.918,43.718 81.893,43.718L20.626,43.718C20.599,43.718 20.571,43.716 20.543,43.711C14.164,42.634 10.023,40.171 7.342,37.268C1.056,30.461 2.795,21.181 2.795,21.181C2.844,20.916 3.095,20.738 3.362,20.779C3.628,20.819 3.814,21.064 3.783,21.332C3.713,21.924 3.99,22.434 4.455,22.862C4.998,23.361 5.788,23.746 6.677,24.01C8.325,24.501 10.317,24.571 11.819,24.077C12.537,23.84 13.142,23.477 13.502,22.946C7.216,20.316 9.302,14.284 10.103,11.092C10.168,10.832 10.426,10.669 10.689,10.724C10.951,10.778 11.124,11.029 11.081,11.294C10.68,13.753 12.456,14.936 14.661,15.53C17.104,16.188 20.094,16.128 21.781,16.019C19.929,14.519 19.061,12.803 18.888,11.111C18.583,8.114 20.489,5.144 23.195,3.472C23.404,3.343 23.675,3.384 23.835,3.569C23.996,3.754 23.999,4.028 23.843,4.217C23.076,5.141 22.773,5.956 22.817,6.684C22.882,7.777 23.708,8.629 24.673,9.297C25.71,10.013 26.929,10.51 27.753,10.796C27.082,8.794 27.185,7.24 27.721,6.036C28.307,4.717 29.424,3.798 30.709,3.168C32.536,2.272 34.699,1.963 35.975,1.831L36.836,1.743Z" class="hair-color"/>
					<path d="M41.43,11.215C41.43,11.215 33.803,13.157 36.537,5.459C37.462,7.849 38.777,9.978 41.43,11.215" class="hair-shadow"/>
					<path d="M72.79,27.625C72.79,27.625 81.731,23.979 80.868,15.129C80.868,15.129 82.017,15.85 83.196,15.997C83.196,15.997 88.485,24.555 72.79,27.625Z" class="hair-shadow"/>
					<path d="M92.606,24.509C92.606,24.509 90.577,27.69 85.604,28.538C85.604,28.538 93.662,28.944 95.257,22.878C95.257,22.878 94.215,24.624 92.606,24.509Z" class="hair-shadow"/>
					<path d="M29.997,32.612C29.997,32.612 19.742,35.358 17.033,19.463C17.623,20.597 20.717,24.763 25.472,24.207C25.472,24.207 23.683,28.014 29.997,32.612Z" class="hair-light"/>
					<path d="M31.281,22.444C31.281,22.444 26.444,17.676 30.401,9.494C30.592,10.758 30.848,13.896 33.612,16.38C33.804,16.39 31.077,18.011 31.281,22.444Z" class="hair-light"/>
					<path d="M48.634,32.392C47.136,32.284 42.107,29.01 42.462,28.503C42.462,28.503 38.278,20.522 45.166,9.821C43.963,13.093 44.046,19.651 50.612,20.02C50.612,20.02 46.427,22.633 48.634,32.392Z" class="hair-light"/>
					<path d="M24.551,40.498C23.837,40.052 10.119,42.482 6.299,28.731C7.337,29.856 16.696,35.637 21.307,34.033C20.721,35.113 19.65,37.226 24.551,40.498Z" class="hair-light"/>
					<defs>
						<linearGradient id="hair_front_short_spiky_grad_1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,26.530273,-26.530273,0,100.317163,58.235623)">
							<stop offset="0" class="hair-shadow" style="stop-opacity:1"/>
							<stop offset="1" class="hair-shadow" style="stop-opacity:0"/>
						</linearGradient>
					</defs>
					</g>
				`
			},
			{
				id: 'hair_front_short_sidepart',
				name: 'Short Sidepart',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(44.57, 0)">
					<path d="M5.529,60.501C5.523,50.362 5.756,42.432 6.835,36.237C7.937,29.912 9.927,25.374 13.402,22.118C16.182,19.514 19.918,17.727 24.945,16.526C32.36,14.755 42.621,14.255 56.8,14.21C68.51,14.173 77.573,14.415 84.618,15.452C91.76,16.502 96.851,18.376 100.539,21.564C104.239,24.762 106.542,29.287 108.057,35.681C109.549,41.974 110.283,50.1 110.885,60.576C110.951,61.724 110.665,62.483 110.215,62.978C109.542,63.716 108.443,63.89 107.317,63.758C105.646,63.562 103.937,62.731 103.937,62.731C103.883,62.704 103.834,62.668 103.792,62.624C103.294,62.095 102.911,61.053 102.601,59.638C102.172,57.686 101.834,54.985 101.275,52.034C99.911,44.835 97.255,36.076 88.456,33.458C75.224,29.52 47.971,29.385 29.294,32.93C19.883,34.716 15.981,41.743 14.416,48.309C12.834,54.949 13.629,61.138 13.629,61.138C13.653,61.32 13.574,61.502 13.423,61.609C11.444,63.019 9.855,63.239 8.651,63.003C6.926,62.664 5.952,61.362 5.68,60.97C5.634,60.925 5.596,60.871 5.569,60.808L5.524,60.662L5.519,60.547L5.529,60.501Z" style="fill:url(#hair_front_short_sidepart_grad_1);"/>
					<path d="M4.614,37.787C4.377,37.929 4.17,38.132 3.988,38.375C3.632,38.85 3.367,39.465 3.17,40.108C2.814,41.272 2.685,42.529 2.712,43.273C2.718,43.445 2.753,43.647 2.761,43.692L2.771,43.711C2.896,43.941 2.822,44.229 2.602,44.37C2.381,44.512 2.089,44.459 1.932,44.25C1.919,44.233 1.906,44.212 1.893,44.188C-1.218,38.463 -0.228,33.048 2.929,27.673C21.226,-3.475 55.911,-3.271 74.472,4.056C79.295,5.959 83.033,8.349 85.142,10.787C86.624,12.5 87.313,14.253 87.098,15.893L86.677,31.745C86.672,31.926 86.57,32.09 86.411,32.174C86.251,32.258 86.058,32.25 85.906,32.152C83.731,30.745 80.521,30.294 76.85,30.299C71.192,30.307 64.459,31.425 58.611,32.078C42.063,33.925 32.25,36.589 26.516,39.282C22.801,41.027 20.835,42.763 19.878,44.294C18.854,45.933 19.045,47.289 19.395,48.033C19.505,48.267 19.608,48.434 19.689,48.482C19.871,48.592 19.964,48.804 19.921,49.012C19.878,49.22 19.709,49.378 19.498,49.407C9.557,50.746 4.984,44.653 4.333,40.566C4.156,39.452 4.27,38.474 4.614,37.787Z" class="hair-color"/>
					<path d="M86.601,15.197L86.603,15.197C86.809,15.183 100.49,14.28 107.383,23.893C110.35,28.032 112.078,34.126 110.89,43.101C110.857,43.353 110.639,43.54 110.385,43.535C110.131,43.53 109.92,43.335 109.897,43.081C109.897,43.081 109.497,38.707 108.458,36.276C108.269,35.836 108.064,35.463 107.828,35.213C108.265,37.679 108.135,39.552 107.603,41.029C106.901,42.978 105.503,44.263 103.697,45.3C101.985,46.283 99.899,47.044 97.735,47.993C97.58,48.06 97.402,48.046 97.261,47.954C97.12,47.862 97.034,47.705 97.034,47.536C97.034,47.536 97.017,40.768 94.704,36.117C93.823,34.345 92.609,32.878 90.891,32.292C89.754,31.904 88.402,31.909 86.795,32.444C86.642,32.494 86.475,32.468 86.344,32.374C86.214,32.28 86.137,32.13 86.137,31.969L86.137,15.696C86.137,15.434 86.34,15.216 86.601,15.197Z" class="hair-color"/>
					<path d="M87.278,15.984L86.637,31.271C86.637,31.271 87.609,26.998 89.23,28.213C87.882,26.64 85.805,17.417 93.666,16.345C90.964,15.335 88.284,14.962 87.278,15.984Z" class="hair-shadow"/>
					<path d="M14.929,47.535C14.929,47.535 5.402,46.255 5.23,37.505C5.064,29.121 10.854,23.022 29.262,18.947C28.135,18.384 2.496,35.421 14.929,47.535Z" class="hair-light"/>
					<path d="M60.253,3.961C60.253,3.961 48.055,-0.854 35.688,4.852C21.362,11.462 19.598,15.378 19.598,15.378C20.567,13.531 42.224,1.089 60.253,3.961Z" class="hair-light"/>
					<defs>
						<linearGradient id="hair_front_short_sidepart_grad_1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,26.530273,-26.530273,0,105.836152,48.074838)">
							<stop offset="0" class="hair-shadow" style="stop-opacity:1"/>
							<stop offset="1" class="hair-shadow" style="stop-opacity:0"/>
						</linearGradient>
					</defs>
					</g>
				`
			},
			{
				id: 'hair_front_buzzcut',
				name: 'Buzzcut',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(47.28, 0)">
					<path d="M0.01,46.295C0.005,36.156 0.237,28.226 1.316,22.03C2.418,15.706 4.408,11.167 7.883,7.912C10.663,5.308 14.399,3.521 19.426,2.32C26.841,0.549 37.102,0.048 51.281,0.004C62.991,-0.034 72.054,0.209 79.099,1.245C86.241,2.296 91.332,4.17 95.02,7.358C98.72,10.556 101.023,15.08 102.538,21.475C104.03,27.768 104.764,35.894 105.366,46.369C105.432,47.517 105.146,48.277 104.696,48.772C104.023,49.51 102.924,49.684 101.798,49.552C100.127,49.356 98.418,48.525 98.418,48.525C98.364,48.498 98.315,48.462 98.273,48.418C97.775,47.889 97.392,46.847 97.082,45.432C96.653,43.48 96.315,40.779 95.756,37.828C94.392,30.629 91.736,21.87 82.937,19.252C69.705,15.313 42.452,15.179 23.775,18.724C14.364,20.51 10.462,27.537 8.897,34.103C7.315,40.743 8.11,46.931 8.11,46.931C8.134,47.114 8.055,47.295 7.904,47.402C5.925,48.813 4.336,49.033 3.132,48.797C1.407,48.458 0.433,47.156 0.161,46.764C0.115,46.719 0.077,46.664 0.05,46.602L0.005,46.456L0,46.34L0.01,46.295Z" style="fill:url(#hair_front_buzzcut_grad_1);"/>
					<defs>
						<linearGradient id="hair_front_buzzcut_grad_1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,26.530273,-26.530273,0,100.317163,33.868684)">
							<stop offset="0" class="hair-color" style="stop-opacity:1"/>
							<stop offset="1" class="hair-color" style="stop-opacity:0"/>
						</linearGradient>
					</defs>
					</g>
				`
			},
			{
				id: 'hair_front_long_middlepart',
				name: 'Long Middlepart',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(37.39, 0)">
					<path d="M102.971,150.164C102.346,150.879 101.701,151.361 101.049,151.592C100.808,151.677 100.542,151.567 100.431,151.337C100.321,151.107 100.402,150.83 100.619,150.695C100.619,150.695 101.271,150.289 102.359,149.371C102.945,148.66 103.509,147.697 104.058,146.52C105.722,142.954 107.154,137.463 108.252,130.773C110.827,115.074 111.543,92.804 108.968,73.22C107.258,60.213 104.102,48.391 99.054,40.492C88.375,23.781 77.076,18.707 70.688,18.646C69.135,18.631 67.889,18.912 67.045,19.409C66.555,19.698 66.209,20.055 66.052,20.472C66.004,20.601 65.904,20.704 65.777,20.758C65.65,20.811 65.507,20.809 65.381,20.753L65.186,20.626L64.999,20.395C64.87,20.175 64.764,19.796 64.703,19.283C64.416,16.859 64.938,10.927 65.084,6.741C65.119,5.757 65.651,4.88 66.635,4.168C67.948,3.218 70.115,2.554 72.867,2.307C83.249,1.378 102.155,6.297 113.735,22.518C120.922,32.585 123.886,48.554 124.722,64.531C125.97,88.409 122.492,112.291 121.488,116.317C116.303,137.117 106.918,146.848 102.971,150.164Z" class="hair-color"/>
					<path d="M23.344,149.374C24.429,150.29 25.081,150.695 25.081,150.695C25.298,150.83 25.379,151.107 25.269,151.337C25.158,151.567 24.892,151.677 24.651,151.592C23.97,151.351 23.292,150.846 22.636,150.085C18.672,146.724 9.367,136.996 4.212,116.317C3.208,112.292 -0.744,87.623 0.124,63.115C0.704,46.713 3.459,30.389 10.646,20.321C22.214,4.118 44.215,-0.82 56.461,0.107C59.678,0.351 62.233,1.005 63.781,1.946C64.956,2.66 65.581,3.554 65.615,4.541C65.761,8.72 66.285,16.185 65.998,19.222C65.941,19.832 65.842,20.284 65.719,20.535C65.695,20.584 65.67,20.629 65.644,20.668L65.538,20.799L65.442,20.882L65.319,20.953C65.193,21.009 65.05,21.011 64.923,20.958C64.796,20.904 64.696,20.801 64.648,20.672C64.49,20.254 64.051,19.902 63.417,19.595C62.3,19.055 60.607,18.712 58.512,18.667C50.121,18.489 35.459,23.141 24.77,39.867C16.411,52.948 13.627,76.9 14.08,99.225C15.891,113.129 19.277,128.226 25.495,138.925C25.606,139.118 25.578,139.361 25.424,139.522C25.27,139.683 25.028,139.723 24.831,139.62C23.192,138.764 20.145,135.269 16.872,129.692C18.539,139.147 20.797,146.36 23.344,149.374Z" class="hair-color"/>
					<path d="M65.116,19.271C64.347,19.922 65.011,7.787 65.584,6.02C66.21,4.089 70.262,4.493 69.41,4.428C68.246,5.01 65.694,10.606 69.39,10.808C69.39,10.808 66.621,9.415 65.116,19.271Z" class="hair-shadow"/>
					<path d="M17.271,130.962C17.137,131.029 11.97,113.716 13.365,100.91C15.23,112.893 17.326,123.672 17.271,130.962Z" class="hair-shadow"/>
					<path d="M55.038,7.837C64.13,6.109 12.049,-3.62 6.96,42.384C6.96,42.384 14.806,15.483 55.038,7.837Z" class="hair-light"/>
					<path d="M47.88,8.658C53.836,7.182 8.345,-0.331 10.796,49.56C10.796,49.56 10.091,18.02 47.88,8.658Z" class="hair-light"/>
					</g>
				`
			},
			{
				id: 'hair_front_middlepart_bangs',
				name: 'Middlepart Bangs',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(42.87, 0)">
					<path d="M21.193,128.21C22.093,128.992 22.663,129.431 22.749,129.497L22.76,129.505C22.978,129.67 23.023,129.979 22.861,130.2C22.699,130.42 22.39,130.469 22.168,130.311L22.156,130.302C21.596,129.901 21.06,129.457 20.548,128.973C16.855,125.763 7.759,116.94 3.537,104.675C-0.092,94.132 0.146,64.099 1.719,51.919C2,49.738 2.33,48.117 2.681,47.26C2.895,46.735 3.166,46.446 3.393,46.345C3.461,46.315 3.536,46.3 3.611,46.302L14.493,46.632C14.638,46.636 14.774,46.703 14.865,46.815C14.957,46.927 14.995,47.073 14.971,47.216C14.971,47.216 9.229,80.789 12.533,105.75C13.801,115.33 16.378,123.642 21.193,128.21Z" class="hair-color"/>
					<path d="M90.834,125.622C90.92,125.556 91.49,125.117 92.39,124.335C97.205,119.767 99.782,111.455 101.05,101.875C104.354,76.914 98.612,43.341 98.612,43.341C98.588,43.198 98.626,43.052 98.718,42.94C98.81,42.828 98.945,42.761 99.09,42.757L109.973,42.427C110.047,42.425 110.122,42.44 110.19,42.47C110.418,42.571 110.688,42.86 110.902,43.385C111.253,44.242 111.583,45.863 111.865,48.044C113.438,60.224 113.675,90.257 110.046,100.8C105.824,113.065 96.728,121.888 93.035,125.098C92.523,125.582 91.987,126.027 91.427,126.427L91.416,126.436C91.193,126.594 90.884,126.545 90.722,126.325C90.56,126.105 90.605,125.795 90.823,125.63L90.834,125.622Z" class="hair-color"/>
					<path d="M111.802,45.885C111.802,45.885 113.098,44.943 112.831,63.407C111.087,55.637 106.503,60.141 101.555,68.815C100.99,58.519 100.884,60.709 100.18,52.213L111.802,45.885Z" class="hair-shadow"/>
					<path d="M1.939,48.021C2.175,47.923 1.502,39.193 1.125,57.925C5.411,61.929 10.224,61.25 12.744,65.104C13.674,54.662 13.203,62.472 13.708,54.055L1.939,48.021Z" class="hair-shadow"/>
					<path d="M28.157,32.458C28.105,32.485 28.053,32.515 28.005,32.548C27.886,32.629 27.76,32.726 27.627,32.838C27.453,32.984 27.268,33.154 27.075,33.347C24.663,35.75 20.947,41.52 19.652,47.406C18.807,51.248 18.99,55.147 21.34,58.15C21.455,58.297 21.478,58.495 21.401,58.665C21.324,58.835 21.16,58.948 20.973,58.958C20.11,59.005 16.281,59.772 12.151,59.344C9.324,59.051 6.365,58.199 4.075,56.225C0.299,52.969 -1.729,46.609 1.912,34.44C7.673,15.185 22.108,3.874 35.362,0.836C44.302,-1.213 52.707,0.503 57.649,6.01C57.725,6.095 57.77,6.204 57.776,6.318L58.57,21.628C58.581,21.84 58.457,22.037 58.26,22.117C58.063,22.197 57.837,22.144 57.696,21.985C57.696,21.985 56.743,20.907 55.339,20.252C53.99,19.622 52.206,19.4 50.466,21.028C49.676,21.766 48.596,23.492 47.445,25.777C44.702,31.221 41.616,39.811 41.33,46.182C41.245,48.074 41.406,49.765 41.916,51.103C42.392,52.355 43.178,53.287 44.374,53.741L44.614,53.868L44.72,53.965L44.791,54.065L44.848,54.209L44.863,54.381L44.826,54.543L44.759,54.668L44.675,54.763L44.559,54.85C44.495,54.889 44.407,54.93 44.294,54.965C44.016,55.051 43.511,55.122 42.839,55.137C39.762,55.203 32.978,54.13 29.356,48.84C27.022,45.431 25.973,40.253 28.157,32.458Z" class="hair-color"/>
					<path d="M28.133,32.256C30.316,25.483 34.744,20.004 41.47,15.589C40.592,16.162 29.793,19.345 20.385,44.559C20.715,45.268 20.413,40.027 28.133,32.256" class="hair-shadow"/>
					<path d="M87.919,35.025C84.405,53.565 74.06,55.485 69.239,54.452C67.858,54.157 66.9,53.591 66.552,53.099C66.354,52.819 66.303,52.538 66.36,52.285C66.415,52.041 66.577,51.798 66.907,51.612C68.004,50.997 68.806,49.912 69.386,48.526C70.305,46.329 70.658,43.393 70.631,40.251C70.583,34.683 69.334,28.474 67.798,24.512C67.168,22.886 66.503,21.646 65.842,21.028C64.782,20.036 63.854,19.575 63.015,19.477C62.071,19.366 61.261,19.726 60.543,20.218C59.742,20.767 59.048,21.483 58.42,22.018C58.272,22.144 58.064,22.172 57.887,22.091C57.71,22.009 57.596,21.832 57.596,21.638L57.571,6.344C57.571,6.205 57.628,6.072 57.731,5.977C63.572,0.551 72.297,-1.131 81.29,0.905C94.662,3.932 108.634,15.183 114.396,34.44C114.545,34.939 114.727,35.42 114.812,35.91C115.991,42.712 114.642,47.563 112.14,51.023C106.319,59.071 94.134,59.565 92.459,59.473C92.304,59.465 92.162,59.385 92.075,59.257C91.987,59.13 91.963,58.968 92.011,58.821C94.664,50.577 90.83,38.942 88.472,35.645C88.314,35.424 88.164,35.243 88.023,35.11C87.992,35.08 87.955,35.051 87.919,35.025Z" class="hair-color"/>
					<path d="M87.908,34.874C87.908,34.874 87.828,19.114 80.788,16.794C80.788,16.794 96.948,19.024 92.468,58.951C92.344,59.616 95.144,44.677 87.908,34.874" class="hair-shadow"/>
					<path d="M58.071,19.525C58.071,19.525 61.772,16.015 64.652,17.449C67.532,18.884 70.649,24.862 70.248,34.224C70.248,34.224 67.956,12.98 58.071,22.196C57.499,22.678 51.601,11.59 44.382,33.284C46.266,18.01 51.162,13.172 58.071,19.525Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'hair_front_short_middlepart',
				name: 'Short Middlepart',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(42.87, 0)">
					<path d="M28.157,32.458C28.105,32.485 28.053,32.515 28.005,32.548C27.886,32.629 27.76,32.726 27.627,32.838C27.453,32.984 27.268,33.154 27.075,33.347C24.663,35.75 20.947,41.52 19.652,47.406C18.807,51.248 18.99,55.147 21.34,58.15C21.455,58.297 21.478,58.495 21.401,58.665C21.324,58.835 21.16,58.948 20.973,58.958C20.11,59.005 16.281,59.772 12.151,59.344C9.324,59.051 6.365,58.199 4.075,56.225C0.299,52.969 -1.729,46.609 1.912,34.44C7.673,15.185 22.108,3.874 35.362,0.836C44.302,-1.213 52.707,0.503 57.649,6.01C57.725,6.095 57.77,6.204 57.776,6.318L58.57,21.628C58.581,21.84 58.457,22.037 58.26,22.117C58.063,22.197 57.837,22.144 57.696,21.985C57.696,21.985 56.743,20.907 55.339,20.252C53.99,19.622 52.206,19.4 50.466,21.028C49.676,21.766 48.596,23.492 47.445,25.777C44.702,31.221 41.616,39.811 41.33,46.182C41.245,48.074 41.406,49.765 41.916,51.103C42.392,52.355 43.178,53.287 44.374,53.741L44.614,53.868L44.72,53.965L44.791,54.065L44.848,54.209L44.863,54.381L44.826,54.543L44.759,54.668L44.675,54.763L44.559,54.85C44.495,54.889 44.407,54.93 44.294,54.965C44.016,55.051 43.511,55.122 42.839,55.137C39.762,55.203 32.978,54.13 29.356,48.84C27.022,45.431 25.973,40.253 28.157,32.458Z" class="hair-color"/>
					<path d="M28.133,32.256C30.316,25.483 34.744,20.004 41.47,15.589C40.592,16.162 29.793,19.345 20.385,44.559C20.715,45.268 20.413,40.027 28.133,32.256" class="hair-shadow"/>
					<path d="M87.919,35.025C84.405,53.565 74.06,55.485 69.239,54.452C67.858,54.157 66.9,53.591 66.552,53.099C66.354,52.819 66.303,52.538 66.36,52.285C66.415,52.041 66.577,51.798 66.907,51.612C68.004,50.997 68.806,49.912 69.386,48.526C70.305,46.329 70.658,43.393 70.631,40.251C70.583,34.683 69.334,28.474 67.798,24.512C67.168,22.886 66.503,21.646 65.842,21.028C64.782,20.036 63.854,19.575 63.015,19.477C62.071,19.366 61.261,19.726 60.543,20.218C59.742,20.767 59.048,21.483 58.42,22.018C58.272,22.144 58.064,22.172 57.887,22.091C57.71,22.009 57.596,21.832 57.596,21.638L57.571,6.344C57.571,6.205 57.628,6.072 57.731,5.977C63.572,0.551 72.297,-1.131 81.29,0.905C94.662,3.932 108.634,15.183 114.396,34.44C114.545,34.939 114.727,35.42 114.812,35.91C115.991,42.712 114.642,47.563 112.14,51.023C106.319,59.071 94.134,59.565 92.459,59.473C92.304,59.465 92.162,59.385 92.075,59.257C91.987,59.13 91.963,58.968 92.011,58.821C94.664,50.577 90.83,38.942 88.472,35.645C88.314,35.424 88.164,35.243 88.023,35.11C87.992,35.08 87.955,35.051 87.919,35.025Z" class="hair-color"/>
					<path d="M87.908,34.874C87.908,34.874 87.828,19.114 80.788,16.794C80.788,16.794 96.948,19.024 92.468,58.951C92.344,59.616 95.144,44.677 87.908,34.874" class="hair-shadow"/>
					<path d="M58.071,19.525C58.071,19.525 61.772,16.015 64.652,17.449C67.532,18.884 70.649,24.862 70.248,34.224C70.248,34.224 67.956,12.98 58.071,22.196C57.499,22.678 51.601,11.59 44.382,33.284C46.266,18.01 51.162,13.172 58.071,19.525Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'hair_front_bowlcut',
				name: 'Bowlcut',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(47.2, 0)">
					<path d="M52.889,0.56L52.891,0.56C68.901,-0.403 80.103,3.397 87.947,9.169C106.296,22.672 106.278,47.032 106.278,47.032C106.278,47.166 106.224,47.294 106.128,47.388C106.033,47.482 105.903,47.534 105.769,47.531L83.144,47.156C82.932,47.153 82.745,47.016 82.678,46.814L79.38,36.92L75.747,46.829C75.675,47.024 75.489,47.155 75.281,47.156L52.868,47.281C52.62,47.283 52.409,47.102 52.371,46.858L50.969,37.766L48.509,46.541C48.449,46.757 48.253,46.906 48.029,46.906L27.934,46.965C27.67,46.965 27.452,46.762 27.433,46.499L26.892,38.654L24.117,46.98C24.05,47.182 23.863,47.319 23.65,47.322L0.594,47.679C0.324,47.684 0.099,47.472 0.087,47.203C-0.687,30.434 3.784,19.538 10.389,12.491C25.38,-3.507 51.484,0.34 52.889,0.56Z" style="fill:url(#hair_front_bowlcut_grad_1);"/>
					<defs>
						<linearGradient id="hair_front_bowlcut_grad_1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0,100.428573,-100.428573,0,51.111307,19.803288)">
							<stop offset="0" class="hair-color" style="stop-opacity:1"/>
							<stop offset="1" class="hair-color" style="stop-opacity:0"/>
						</linearGradient>
					</defs>
					</g>
				`
			},
			{
				id: 'hair_front_short_fluffy',
				name: 'Short Fluffy',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(30.34, 0)">
					<path d="M97.102,17.913L88.207,35.978C88.063,37.018 87.391,38.145 86.276,39.301C84.672,40.965 82.14,42.729 79.122,44.475C67.537,51.176 48.742,57.68 48.742,57.68C48.61,57.725 48.465,57.714 48.342,57.647C48.219,57.581 48.129,57.466 48.094,57.331L46.905,52.692C45.615,55.626 42.811,58.265 39.507,60.455C33.742,64.275 26.49,66.746 23.535,67.181C22.938,67.269 22.493,67.27 22.235,67.209C22.183,67.196 22.136,67.182 22.093,67.165L21.945,67.091L21.844,67.014L21.75,66.907L21.67,66.755L21.635,66.586L21.642,66.427L21.679,66.291C21.732,66.148 21.862,65.955 22.112,65.741C23.345,64.688 23.533,62.698 23.385,60.708C23.263,59.068 22.889,57.418 22.556,56.207C21.952,58.593 20.422,62.811 16.611,67.337C14.167,70.239 10.996,70.326 8.064,69.354C3.844,67.956 0.15,64.333 0.15,64.333C0.002,64.189 -0.041,63.968 0.041,63.778C0.123,63.588 0.314,63.469 0.52,63.477C0.52,63.477 5.01,63.663 7.545,60.133C9.282,57.714 10.071,53.596 8.062,46.599C6.466,41.038 6.192,37.522 7.232,34.74C7.934,32.858 9.235,31.298 11.171,29.679C15.817,25.792 24.216,21.504 36.636,10.871C54.209,-4.173 71.513,-0.386 83.104,3.375C87.964,4.952 91.792,6.535 94.177,6.641C95.952,6.72 97.118,7.257 97.863,8.027C98.98,9.181 99.168,10.904 98.917,12.619C98.54,15.195 97.202,17.728 97.102,17.913Z" class="hair-color"/>
					<path d="M97.202,16.473C97.186,16.465 97.171,16.457 97.156,16.447C96.922,16.3 96.853,15.99 97.001,15.757C97.001,15.757 98.671,12.997 103.723,13.973C106.55,14.519 112.385,17.271 117.34,20.804C120.668,23.177 123.594,25.904 124.982,28.533C127.359,33.038 130.868,47.762 134.532,54.933C135.28,56.396 136.024,57.536 136.776,58.173C137.362,58.668 137.94,58.819 138.515,58.411C138.713,58.27 138.984,58.292 139.156,58.463C139.329,58.634 139.354,58.904 139.216,59.103C139.216,59.103 138.04,60.802 136.277,62.022C134.686,63.121 132.641,63.829 130.531,62.732L130.795,64.054C130.831,64.234 130.765,64.42 130.623,64.537C130.482,64.655 130.287,64.684 130.117,64.615C130.117,64.615 115.136,58.511 108.45,48.583C108.455,49.274 108.593,50.207 109.091,51.274L109.157,51.458L109.177,51.607L109.168,51.75L109.12,51.903L109.05,52.021L108.959,52.021L108.762,52.235C108.633,52.286 108.436,52.313 108.175,52.279C107.798,52.229 107.207,52.047 106.46,51.747C102.447,50.135 93.591,45.052 89.376,40.804C88.237,39.657 87.433,38.56 87.11,37.605C86.855,36.855 86.88,36.176 87.2,35.594C87.329,35.359 87.621,35.269 87.859,35.387L97.202,16.473Z" class="hair-color"/>
					<path d="M89.305,34.955L98.518,16.152C98.518,16.152 98.305,13.775 100.305,14.464C102.305,15.152 106.971,18.652 106.471,18.652C105.971,18.652 98.805,18.152 101.305,20.985C103.805,23.819 103.805,24.152 103.805,24.152C103.805,24.152 98.564,22.485 98.518,25.485C98.471,28.485 100.394,29.058 100.394,29.058C100.394,29.058 94.294,27.658 95.594,30.258C96.894,32.858 96.694,32.458 96.694,32.458C96.694,32.458 92.416,31.152 89.305,34.955Z" class="hair-shadow"/>
					<path d="M22.437,51.084C22.437,51.084 21.489,47.191 25.06,39.209C28.632,31.227 28.203,30.37 28.203,30.37C28.203,30.37 20.632,33.826 18.632,37.955C17.55,40.188 16.917,44.227 16.489,54.227C16.06,64.227 10.775,69.407 10.775,69.407C10.775,69.407 14.917,69.791 18.917,64.152C22.917,58.513 22.385,56.227 22.437,53.941C22.489,51.656 22.437,51.084 22.437,51.084Z" class="hair-shadow"/>
					<path d="M91.012,9.975C91.012,9.975 74.723,2.084 65.866,5.37C57.009,8.656 48.447,13.773 46.029,17.941C41.886,25.084 39.58,34.955 39.58,34.955C39.58,34.955 59.122,16.656 68.066,15.941C68.066,15.941 59.152,16.478 55.009,30.37C55.009,30.37 64.269,21.071 69.669,21.69C80.598,22.942 91.012,9.975 91.012,9.975Z" class="hair-light"/>
					</g>
				`
			},
			{
				id: 'hair_front_straight_bangs',
				name: 'Straight Bangs',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 40,
				svgContent: `
					<g transform="translate(42.57, 0)">
					<path d="M58.498,1.857L58.498,15.669C58.498,15.787 58.457,15.9 58.382,15.99C58.241,16.159 57.773,16.44 57.09,16.736C54.761,17.749 49.707,19.36 49.707,19.36L49.67,19.37C28.691,24.298 21.772,43.57 21.913,52.018C22.056,60.637 19.765,75.722 11.433,92.817C3.308,109.488 13.075,120.697 13.075,120.697C13.231,120.876 13.24,121.141 13.095,121.33C12.951,121.519 12.693,121.58 12.479,121.476C9.339,119.942 5.522,115.613 2.948,110.483C0.365,105.336 -0.957,99.397 0.802,94.708C4.217,85.601 3.627,47.605 3.627,47.605L3.628,47.565C5.186,23.555 14.244,11.381 24.504,5.392C39.917,-3.605 58.13,1.375 58.13,1.375C58.347,1.434 58.498,1.632 58.498,1.857Z" class="hair-color" fill="currentColor"/>
					<path d="M58.749,1.375C58.749,1.375 76.626,-3.607 91.771,5.394C101.848,11.383 110.754,23.557 112.312,47.565C112.313,47.586 112.314,47.606 112.312,47.627C112.312,47.627 111.334,64.468 111.921,77.704C112.17,83.32 112.693,88.282 113.71,90.994C115.816,96.611 114.878,103.071 112.424,108.003C110.772,111.325 108.431,113.949 105.89,115.19C105.654,115.305 105.369,115.218 105.238,114.991C105.106,114.764 105.172,114.474 105.389,114.327C105.389,114.327 112.558,109.336 104.507,92.817C96.175,75.722 93.884,60.637 94.028,52.018C94.168,43.57 87.249,24.298 66.27,19.37C66.25,19.366 66.23,19.36 66.211,19.352C66.211,19.352 62.963,18.151 60.807,17.184C59.79,16.727 59.011,16.29 58.812,16.052C58.74,15.965 58.699,15.856 58.696,15.743L58.384,1.868C58.379,1.64 58.529,1.437 58.749,1.375Z" class="hair-color" fill="currentColor"/>
					<path d="M58.884,1.857C63.821,0.678 68.397,0.496 72.651,1.195C66.703,3.026 63.774,3.566 63.627,4.203C68.818,3.848 74.843,3.832 76.107,5.355C73.909,4.866 68.437,4.606 64.395,7.403C84.46,3.065 93.892,29.564 95.56,48.711C92.362,40.639 88.647,29.347 72.011,20.523C68.798,19.4 61.585,16.932 58.884,15.467L58.884,1.857Z" class="hair-shadow"/>
					<path d="M57.278,1.857C52.34,0.678 47.765,0.496 43.51,1.195C49.459,3.026 52.388,3.566 52.534,4.203C47.344,3.848 41.319,3.832 40.054,5.355C42.252,4.866 47.725,4.606 51.766,7.403C31.702,3.065 22.269,29.564 20.602,48.711C23.8,40.639 27.515,29.347 44.15,20.523C47.364,19.4 54.577,16.932 57.278,15.467L57.278,1.857Z" class="hair-shadow"/>
					<path d="M57.993,7.683L57.998,7.683C79.668,5.51 86.046,21.239 87.062,22.976C87.374,23.51 87.749,25.388 88.087,27.763C88.847,33.099 89.54,41.014 89.54,41.014C89.554,41.171 89.493,41.326 89.375,41.431C89.257,41.536 89.097,41.579 88.943,41.548C83.922,40.532 78.765,39.992 73.406,40.162C73.196,40.168 73.004,40.043 72.926,39.848C71.538,36.38 70.067,34.145 68.07,32.244L67.517,40.005C67.507,40.143 67.441,40.27 67.334,40.357C67.227,40.445 67.089,40.484 66.952,40.466C60.516,39.611 54.26,39.75 48.162,40.758C48.023,40.781 47.88,40.744 47.769,40.656C47.659,40.568 47.59,40.437 47.581,40.296L47.053,31.888C44.87,34.399 43.778,36.88 42.235,40.316C42.144,40.52 41.927,40.639 41.706,40.606C38.282,40.098 32.553,41.013 27.237,42.011C27.095,42.037 26.949,42.001 26.836,41.912C26.722,41.823 26.653,41.69 26.645,41.546C26.645,41.546 26.17,32.782 30.443,20.893C32.675,14.684 37.559,11.317 42.629,9.525C49.772,6.999 57.268,7.616 57.993,7.683Z" style="fill:url(#hair_front_straight_bangs_grad_1);"/>
					<defs>
						<linearGradient id="hair_front_straight_bangs_grad_1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.697945,72.656242,-72.656242,1.697945,57.99799,28.231643)">
							<stop offset="0" class="hair-color" style="stop-opacity:1"/>
							<stop offset="1" class="hair-color" style="stop-opacity:0"/>
						</linearGradient>
					</defs>
					</g>
				`
			}
		]
	},
	{
		id: 'hair_back',
		name: 'Hair (Back)',
		features: [
			{
				id: 'long_flared',
				name: 'Long Flared',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(26.84, 0)">
					<path d="M77.329,0.531L77.331,0.531C115.219,-3.61 135.83,17.26 139.573,36.222C143.306,55.134 144.712,94.23 139.425,110.973C134.239,127.395 146.173,140.878 146.173,140.878C146.297,141.018 146.333,141.215 146.266,141.389C146.198,141.563 146.04,141.686 145.854,141.706C139.354,142.428 135.443,141.24 133.084,139.592C130.905,138.069 130.012,136.139 129.646,134.818C128.573,137.429 129.229,140.259 130.463,142.802C132.689,147.386 136.822,151.067 136.822,151.067C136.969,151.198 137.026,151.404 136.966,151.591C136.907,151.779 136.743,151.915 136.547,151.937C104.576,155.659 76.648,146.999 74.453,146.296C32.003,157.018 16.466,150.719 16.466,150.719C16.299,150.651 16.18,150.498 16.157,150.319C16.134,150.14 16.21,149.962 16.355,149.854C18.713,148.102 19.834,145.182 20.356,142.322C20.904,139.319 20.784,136.368 20.653,134.804C11.741,144.954 0.323,140.608 0.323,140.608C0.158,140.545 0.038,140.401 0.008,140.227C-0.023,140.053 0.04,139.876 0.174,139.761C10.582,130.793 12.833,122.619 11.597,113.018C6.026,69.765 4.475,45.694 25.808,17.552C32.48,8.751 42.081,4.259 51.207,2.049C64.268,-1.114 76.341,0.398 77.329,0.531Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'long_layered',
				name: 'Long Layered',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(36.11, 0)">
					<path d="M63.961,0.475L63.963,0.475C66.246,0.178 117.204,-5.85 125.865,46.44C132.864,88.693 123.238,103.736 120.908,110.571C120.824,110.816 120.568,110.957 120.317,110.896C120.065,110.835 119.902,110.592 119.94,110.336C120.529,106.38 120.225,100.63 119.978,97.413C108.207,134.322 120.736,147.984 123.896,150.226C124.07,150.349 124.147,150.568 124.087,150.773C124.028,150.977 123.846,151.122 123.633,151.133C85.375,153.121 66.16,147.427 64,146.738C59.47,149.058 52.287,150.187 44.423,150.606C25.973,151.59 3.759,148.723 3.759,148.723C3.509,148.691 3.323,148.478 3.323,148.226C3.324,147.974 3.512,147.762 3.762,147.731C7.029,147.325 9.104,145.104 10.371,141.838C11.692,138.434 12.139,133.916 12.084,129.039C11.951,117.198 8.844,103.262 7.735,97.776C7.646,97.334 7.569,96.946 7.508,96.617L7.477,96.703C7.149,97.653 6.937,99.077 6.799,100.741C6.251,107.378 6.938,117.74 6.938,117.74C6.955,118.003 6.765,118.234 6.504,118.269C6.243,118.303 6,118.129 5.948,117.871C4.672,111.489 -5.081,86.829 3.49,46.418C6.956,30.08 13.795,19.418 21.656,12.489C39.416,-3.164 62.441,0.231 63.961,0.475Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'pigtails',
				name: 'Pigtails',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(8.06, 0)">
					<path d="M47.19,23.64C47.23,23.661 47.27,23.684 47.309,23.709C47.419,23.781 47.518,23.873 47.592,23.98L47.671,24.118L47.725,24.281L47.744,24.43L47.737,24.581C47.725,24.67 47.699,24.767 47.651,24.87C47.532,25.127 47.239,25.479 46.595,25.899C45.791,26.423 44.37,27.12 41.944,28.03C41.098,28.347 40.451,29.173 39.911,30.364C39.018,32.333 38.466,35.266 38.099,38.79C36.639,52.789 38.137,75.958 34.222,86.222C28.624,100.901 14.543,100.639 14.543,100.639C14.362,100.636 14.196,100.535 14.111,100.375C14.025,100.214 14.033,100.021 14.132,99.868C16.855,95.647 17.233,93.134 17.167,91.901C15.207,94.335 12.338,95.286 9.502,95.503C4.86,95.859 0.332,94.243 0.332,94.243C0.13,94.171 -0.004,93.978 0,93.763C0.004,93.549 0.144,93.361 0.348,93.296C0.348,93.296 15.066,88.605 11.867,73.677C9.887,64.435 5.851,49.504 5.312,35.427C4.949,25.951 6.178,16.862 10.621,10.108C15.108,3.287 21.829,0.737 28.285,0.144C37.878,-0.738 46.87,2.722 46.87,2.722C47.063,2.796 47.19,2.981 47.19,3.188L47.19,23.64Z" class="hair-shadow"/>
    				<path d="M136.682,23.64L136.682,3.188C136.682,2.981 136.81,2.796 137.003,2.722C137.003,2.722 145.994,-0.738 155.588,0.144C162.044,0.737 168.764,3.287 173.251,10.108C177.695,16.862 178.923,25.951 178.561,35.427C178.022,49.504 173.986,64.435 172.005,73.677C168.806,88.605 183.524,93.296 183.524,93.296C183.729,93.361 183.869,93.549 183.873,93.763C183.876,93.978 183.743,94.171 183.541,94.243C183.541,94.243 179.012,95.859 174.371,95.503C171.535,95.286 168.666,94.335 166.705,91.899C166.64,93.134 167.017,95.646 169.741,99.868C169.839,100.021 169.847,100.214 169.762,100.375C169.676,100.535 169.511,100.636 169.329,100.639C169.329,100.639 155.249,100.901 149.65,86.222C145.736,75.958 147.233,52.789 145.774,38.79C145.406,35.266 144.854,32.333 143.962,30.364C143.422,29.173 142.774,28.347 141.929,28.03C139.503,27.12 138.081,26.423 137.278,25.899C136.633,25.479 136.34,25.127 136.222,24.87C136.174,24.767 136.148,24.67 136.136,24.581L136.128,24.43L136.148,24.281L136.202,24.118L136.28,23.98C136.355,23.873 136.454,23.781 136.563,23.709C136.602,23.684 136.642,23.661 136.682,23.64Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'ponytail',
				name: 'Ponytail',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(76.13, 0)">
					<path d="M47.19,23.64C47.23,23.661 47.27,23.684 47.309,23.709C47.419,23.781 47.518,23.873 47.592,23.98L47.671,24.118L47.725,24.281L47.744,24.43L47.737,24.581C47.725,24.67 47.699,24.767 47.651,24.87C47.532,25.127 47.239,25.479 46.595,25.899C45.791,26.423 44.37,27.12 41.944,28.03C41.098,28.347 40.451,29.173 39.911,30.364C39.018,32.333 38.466,35.266 38.099,38.79C36.639,52.789 38.137,75.958 34.222,86.222C28.624,100.901 14.543,100.639 14.543,100.639C14.362,100.636 14.196,100.535 14.111,100.375C14.025,100.214 14.033,100.021 14.132,99.868C16.855,95.647 17.233,93.134 17.167,91.901C15.207,94.335 12.338,95.286 9.502,95.503C4.86,95.859 0.332,94.243 0.332,94.243C0.13,94.171 -0.004,93.978 0,93.763C0.004,93.549 0.144,93.361 0.348,93.296C0.348,93.296 15.066,88.605 11.867,73.677C9.887,64.435 5.851,49.504 5.312,35.427C4.949,25.951 6.178,16.862 10.621,10.108C15.108,3.287 21.829,0.737 28.285,0.144C37.878,-0.738 46.87,2.722 46.87,2.722C47.063,2.796 47.19,2.981 47.19,3.188L47.19,23.64Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'spiky_short',
				name: 'Spiky Short',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(38.93, 0)">
					<<path d="M8.956,66.767C8.402,65.072 8.493,61.123 9.007,56.234C10.212,44.778 13.634,28.082 15.59,23.66C19.672,14.43 37.817,-0.124 63.071,0.001C78.179,0.075 88.483,4.17 95.467,9.198C105.984,16.768 108.992,26.471 109.491,27.914C112.16,35.624 115.511,70.755 114.494,76.744C114.103,79.047 115.238,82.228 116.704,85.227C118.958,89.84 122.047,94.012 122.047,94.012C122.149,94.149 122.173,94.33 122.111,94.49C122.049,94.65 121.909,94.767 121.741,94.8C114.351,96.239 110.593,93.539 109.481,92.522C108.094,93.793 107.394,95.103 107.189,96.403C106.853,98.528 107.823,100.601 109.133,102.373C111.399,105.435 114.724,107.605 114.724,107.605C114.898,107.719 114.984,107.93 114.938,108.133C114.893,108.337 114.725,108.491 114.519,108.519C106.616,109.607 102.437,108.923 100.232,107.993C98.79,107.384 98.117,106.651 97.806,106.145C96.476,106.953 95.655,107.928 95.21,108.992C94.46,110.788 94.773,112.813 95.431,114.645C96.567,117.809 98.758,120.411 98.758,120.411C98.877,120.554 98.908,120.751 98.838,120.923C98.767,121.095 98.607,121.214 98.421,121.231C76.617,123.264 68.008,116.222 65.52,113.468C65.363,114.04 65.061,114.591 64.627,115.116C63.574,116.396 61.711,117.54 59.385,118.517C52.364,121.466 41.076,122.97 36.145,122.857C35.234,122.836 34.529,122.757 34.089,122.631C33.824,122.554 33.634,122.453 33.513,122.35C33.403,122.255 33.339,122.118 33.338,121.974C33.337,121.829 33.399,121.691 33.507,121.595C35.781,119.583 35.65,117.007 34.714,114.647C33.5,111.59 30.95,108.869 30.068,107.986C22.609,113.839 15.387,112.431 13.553,111.599C13.288,111.479 13.112,111.357 13.02,111.266L12.898,111.105L12.833,110.915L12.844,110.693L12.946,110.487L13.05,110.387L13.194,110.307L13.278,110.29C20.748,104.707 17.902,97.029 16.911,94.905C14.645,96.801 11.64,97.063 8.785,96.63C4.319,95.954 0.249,93.596 0.249,93.596C0.067,93.491 -0.03,93.281 0.008,93.074C0.046,92.866 0.211,92.704 0.419,92.67C5.395,91.857 7.837,88.212 8.968,83.947C10.718,77.349 9.365,69.263 9.027,67.241C8.991,67.021 8.967,66.861 8.956,66.767ZM9.449,66.705L8.992,66.871C9.052,67.037 9.159,67.085 9.185,67.101C9.299,67.172 9.409,67.184 9.505,67.174C9.511,67.173 9.517,67.172 9.523,67.171C9.482,66.926 9.455,66.767 9.449,66.705Z" class="hair-shadow"/>
					</g>
				`
			},
			{
				id: 'long_straight',
				name: 'Long Straight',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.9,
				defaultScaleY: 0.9,
				zIndex: 5,
				svgContent: `
					<g transform="translate(36.37, 0)">
					<path d="M67.074,0.531L67.075,0.531C104.963,-3.61 125.574,17.26 129.317,36.222C133.048,55.123 132.909,93.782 129.182,110.928C124.814,131.022 130.058,153.082 130.058,153.082C130.091,153.221 130.063,153.367 129.981,153.484C129.899,153.601 129.771,153.677 129.629,153.694C97.624,157.419 70.8,151.01 68.767,150.507C26.345,161.22 2.437,154.248 2.437,154.248C2.299,154.208 2.185,154.111 2.124,153.981C2.063,153.851 2.061,153.701 2.118,153.569C6.131,144.322 6.102,123.764 4.854,114.072C-0.716,70.821 -5.78,45.693 15.552,17.552C22.224,8.751 31.825,4.259 40.951,2.049C54.013,-1.114 66.085,0.398 67.074,0.531Z" class="hair-shadow"/>
					</g>
				`
			}
		]
	},
	{
		id: 'glasses',
		name: 'Glasses',
		features: [
			{
				id: 'glasses_round_wireframe',
				name: 'Round Wireframe',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g fill="none" stroke="#222222" stroke-linecap="round">
						<!-- Bridge -->
						<path d="M 87 95 Q 100 88 113 95" stroke-width="2.5" />
						<!-- Lenses -->
						<circle cx="65" cy="95" r="22" stroke-width="3" />
						<circle cx="135" cy="95" r="22" stroke-width="3" />
					</g>
				`
			},
			{
				id: 'glasses_round_thick',
				name: 'Round Thick',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Endpieces -->
						<path d="M 45 92 L 36 92" fill="none" stroke="#3E2723" stroke-width="6" stroke-linecap="round" />
						<path d="M 155 92 L 164 92" fill="none" stroke="#3E2723" stroke-width="6" stroke-linecap="round" />
						<!-- Bridge -->
						<path d="M 85 92 Q 100 85 115 92" fill="none" stroke="#3E2723" stroke-width="5" stroke-linecap="round" />
						<!-- Lenses -->
						<circle cx="65" cy="95" r="20" fill="#000000" fill-opacity="0.1" stroke="#3E2723" stroke-width="5.5" />
						<circle cx="135" cy="95" r="20" fill="#000000" fill-opacity="0.1" stroke="#3E2723" stroke-width="5.5" />
						<!-- Rivets -->
						<circle cx="39" cy="92" r="1.5" fill="#E0E0E0" />
						<circle cx="161" cy="92" r="1.5" fill="#E0E0E0" />
					</g>
				`
			},
			{
				id: 'glasses_round_halfrim',
				name: 'Round Halfrim',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Gold Lower Rims -->
						<path d="M 43 95 A 22 22 0 0 0 87 95" fill="none" stroke="#D4AF37" stroke-width="2" />
						<path d="M 113 95 A 22 22 0 0 0 157 95" fill="none" stroke="#D4AF37" stroke-width="2" />
						<!-- Gold Bridge -->
						<path d="M 87 93 Q 100 88 113 93" fill="none" stroke="#D4AF37" stroke-width="2" />
						<!-- Black Upper Rims / Browlines -->
						<path d="M 43 95 A 22 22 0 0 1 87 95" fill="none" stroke="#111111" stroke-width="5" />
						<path d="M 113 95 A 22 22 0 0 1 157 95" fill="none" stroke="#111111" stroke-width="5" />
						<!-- Black Endpieces -->
						<path d="M 43 95 L 36 93" fill="none" stroke="#111111" stroke-width="5" stroke-linecap="round" />
						<path d="M 157 95 L 164 93" fill="none" stroke="#111111" stroke-width="5" stroke-linecap="round" />
					</g>
				`
			},
			{
				id: 'glasses_square_thick',
				name: 'Square Thick',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Arms -->
						<path d="M 36 85 L 28 85" fill="none" stroke="#1A1A1A" stroke-width="4" stroke-linecap="round" />
						<path d="M 164 85 L 172 85" fill="none" stroke="#1A1A1A" stroke-width="4" stroke-linecap="round" />
						<!-- Endpieces -->
						<path d="M 40 85 L 34 85" fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round" />
						<path d="M 160 85 L 166 85" fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round" />
						<!-- Bridge -->
						<path d="M 86 88 Q 100 85 114 88" fill="none" stroke="#1A1A1A" stroke-width="5" />
						<!-- Frames -->
						<rect x="40" y="80" width="46" height="32" rx="4" fill="none" stroke="#1A1A1A" stroke-width="5" />
						<rect x="114" y="80" width="46" height="32" rx="4" fill="none" stroke="#1A1A1A" stroke-width="5" />
						<!-- Side Rivets -->
						<rect x="35" y="83" width="2" height="4" fill="#DDDDDD" />
						<rect x="163" y="83" width="2" height="4" fill="#DDDDDD" />
					</g>
				`
			},
			{
				id: 'glasses_square_oversized',
				name: 'Square Oversized',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Arms -->
						<path d="M 32 85 L 28 85" fill="none" stroke="#D35400" stroke-width="4" stroke-linecap="round" />
						<path d="M 168 85 L 172 85" fill="none" stroke="#D35400" stroke-width="4" stroke-linecap="round" />
						<!-- Endpieces -->
						<path d="M 35 85 L 30 85" fill="none" stroke="#D35400" stroke-width="5" stroke-linecap="round" />
						<path d="M 165 85 L 170 85" fill="none" stroke="#D35400" stroke-width="5" stroke-linecap="round" />
						<!-- Bridge -->
						<path d="M 91 88 Q 100 85 109 88" fill="none" stroke="#D35400" stroke-width="4" />
						<!-- Frames (Amber Tint) -->
						<rect x="35" y="68" width="56" height="56" rx="10" fill="#E67E22" fill-opacity="0.3" stroke="#D35400" stroke-width="4" />
						<rect x="109" y="68" width="56" height="56" rx="10" fill="#E67E22" fill-opacity="0.3" stroke="#D35400" stroke-width="4" />
						<!-- Retro Lens Glare -->
						<path d="M 45 74 L 60 118 M 119 74 L 134 118" stroke="#FFFFFF" stroke-width="4" opacity="0.3" stroke-linecap="round" />
					</g>
				`
			},
			{
				id: 'sunglasses_aviator',
				name: 'Aviators',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Arms -->
						<path d="M 43 85 L 28 85" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" />
						<path d="M 157 85 L 172 85" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" />
						
						<!-- Double Bridge -->
						<path d="M 87 81 L 113 81" fill="none" stroke="#D4AF37" stroke-width="2.5" />
						<path d="M 85 87 Q 100 83 115 87" fill="none" stroke="#D4AF37" stroke-width="2.5" />
						
						<!-- Lenses (Dark with Teardrop Shape) -->
						<path d="M 43 85 C 43 70, 87 70, 87 85 C 87 110, 75 120, 65 120 C 50 120, 43 105, 43 85 Z" fill="#1A1A1A" fill-opacity="0.9" stroke="#D4AF37" stroke-width="2.5" />
						<path d="M 157 85 C 157 70, 113 70, 113 85 C 113 110, 125 120, 135 120 C 150 120, 157 105, 157 85 Z" fill="#1A1A1A" fill-opacity="0.9" stroke="#D4AF37" stroke-width="2.5" />
						
						<!-- Diagonal Glare -->
						<path d="M 48 76 L 43 95 M 55 74 L 48 110" stroke="#FFFFFF" stroke-width="2.5" opacity="0.25" stroke-linecap="round" />
						<path d="M 120 76 L 115 95 M 127 74 L 120 110" stroke="#FFFFFF" stroke-width="2.5" opacity="0.25" stroke-linecap="round" />
					</g>
				`
			},
			{
				id: 'sunglasses_wayfarer',
				name: 'Wayfarers',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<g>
						<!-- Bridge -->
						<path d="M 85 82 Q 100 79 115 82" fill="none" stroke="#111111" stroke-width="6" />
						
						<!-- Frames & Lenses -->
						<!-- We use polygons with rounded linejoins to get that distinct trapezoid shape -->
						<polygon points="32,76 86,80 78,104 40,100" fill="#0A0A0A" stroke="#111111" stroke-width="6" stroke-linejoin="round" />
						<polygon points="168,76 114,80 122,104 160,100" fill="#0A0A0A" stroke="#111111" stroke-width="6" stroke-linejoin="round" />
						
						<!-- Subtle Lens Highlight -->
						<polygon points="36,80 60,82 55,90 38,88" fill="#FFFFFF" opacity="0.1" />
						<polygon points="164,80 140,82 145,90 162,88" fill="#FFFFFF" opacity="0.1" />

						<!-- Silver Corner Rivets -->
						<path d="M 37 81 L 41 81 M 163 81 L 159 81" stroke="#DDDDDD" stroke-width="2" stroke-linecap="round" />
					</g>
				`
			},
			{
				id: 'sunglasses_square_normal',
				name: 'Classic Sunglasses',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<defs>
						<linearGradient id="lens_dark_grad_" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#1A1A1A" />
							<stop offset="100%" stop-color="#4A4A4A" />
						</linearGradient>
					</defs>

					<g>
						<!-- Arms -->
						<path d="M 38 85 L 28 85" fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round" />
						<path d="M 162 85 L 172 85" fill="none" stroke="#222222" stroke-width="4" stroke-linecap="round" />
						
						<!-- Bridge -->
						<path d="M 84 82 Q 100 80 116 82" fill="none" stroke="#222222" stroke-width="4" />
						
						<!-- Frames -->
						<rect x="36" y="74" width="48" height="36" rx="6" fill="url(#lens_dark_grad_)" stroke="#222222" stroke-width="4" />
						<rect x="116" y="74" width="48" height="36" rx="6" fill="url(#lens_dark_grad_)" stroke="#222222" stroke-width="4" />
						
						<!-- Clean Diagonal Lens Glare -->
						<path d="M 42 78 L 52 106 M 122 78 L 132 106" stroke="#FFFFFF" stroke-width="2.5" opacity="0.15" stroke-linecap="round" />
					</g>
				`
			},
			{
				id: 'sunglasses_semicircle',
				name: 'Semicircle Retro',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 37,
				svgContent: `
					<defs>
						<linearGradient id="lens_amber_grad_" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#8D4004" />
							<stop offset="100%" stop-color="#D35400" />
						</linearGradient>
					</defs>

					<g>
						<!-- Gold Bridge -->
						<path d="M 86 82 Q 100 78 114 82" fill="none" stroke="#D4AF37" stroke-width="3" />
						
						<!-- Semicircle Lenses -->
						<path d="M 42 82 L 86 82 C 86 112, 42 112, 42 82 Z" fill="url(#lens_amber_grad_)" stroke="#D4AF37" stroke-width="3" stroke-linejoin="round" />
						<path d="M 114 82 L 158 82 C 158 112, 114 112, 114 82 Z" fill="url(#lens_amber_grad_)" stroke="#D4AF37" stroke-width="3" stroke-linejoin="round" />
						
						<!-- Pronounced Flat Top Bars with slight endpiece overhang -->
						<path d="M 40 82 L 88 82 M 112 82 L 160 82" stroke="#D4AF37" stroke-width="3" stroke-linecap="round" />
						
						<!-- Warm Lens Highlight -->
						<path d="M 48 85 L 56 102 M 120 85 L 128 102" stroke="#FFFFFF" stroke-width="2" opacity="0.3" stroke-linecap="round" />
					</g>
				`
			}
		]
	}
];

export const HAIR_PRESETS: { base: string; light: string; shadow: string; name: string }[] = [
	{ base: '#ECD2B5', light: '#FDE5CB', shadow: '#C5A785', name: 'Super blond' },
	{ base: '#E6B989', light: '#FCD0A0', shadow: '#C89F71', name: 'Gulaktig blond' },
	{ base: '#B97C4B', light: '#D79759', shadow: '#925E33', name: 'Blondbrun' },
	{ base: '#925B33', light: '#B9794B', shadow: '#6E4320', name: 'Ljusbrun' },
	{ base: '#6F3719', light: '#8D4B27', shadow: '#54240A', name: 'Hazelnut' },
	{ base: '#411F0B', light: '#562E14', shadow: '#2A1202', name: 'Superdark brown' },
	{ base: '#D89368', light: '#F1AA7E', shadow: '#B0734E', name: 'Strawberry blonde' },
	{ base: '#D47C46', light: '#F69960', shadow: '#B16334', name: 'Ginger' },
];

export function getHairShades(hairColor: string): { shadow: string; light: string } {
	// First check the curated preset table for an exact match
	const normalized = hairColor.toUpperCase().replace(/^#/, '');
	const preset = HAIR_PRESETS.find(p => p.base.toUpperCase().replace(/^#/, '') === normalized);
	if (preset) {
		return { shadow: preset.shadow, light: preset.light };
	}

	// Fallback: compute shades algorithmically for custom colors
	const hex = hairColor.replace(/^#/, '');
	let r = parseInt(hex.substring(0, 2), 16) || 0;
	let g = parseInt(hex.substring(2, 4), 16) || 0;
	let b = parseInt(hex.substring(4, 6), 16) || 0;

	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	const hDeg = Math.round(h * 360);
	const sPct = Math.round(s * 100);
	const lPct = Math.round(l * 100);

	const shadowL = Math.max(0, lPct - 12);
	const lightL = Math.min(100, lPct + 12);

	const toHex = (h: number, s: number, l: number) => {
		s /= 100;
		l /= 100;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = l - c / 2;
		let r = 0, g = 0, b = 0;

		if (0 <= h && h < 60) { r = c; g = x; b = 0; }
		else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
		else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
		else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
		else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
		else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

		const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
		const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
		const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');

		return `#${rHex}${gHex}${bHex}`.toUpperCase();
	};

	return {
		shadow: toHex(hDeg, sPct, shadowL),
		light: toHex(hDeg, sPct, lightL)
	};
}

export function namespaceSvgGradients(svgContent: string, namespace: string): string {
	return svgContent.replaceAll('_grad_', `_grad_${namespace}_`);
}
