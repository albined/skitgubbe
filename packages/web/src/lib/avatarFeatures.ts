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
					<path fill="#000000" opacity="0.12" d="M 25 125 C 35 165, 65 195, 100 195 C 135 195, 165 165, 175 125 C 160 170, 130 185, 100 185 C 70 185, 40 170, 25 125 Z" />
					<path fill="#FFFFFF" opacity="0.4" d="M 100 5 C 60 5, 35 25, 30 70 C 40 30, 70 15, 100 15 C 120 15, 150 25, 165 50 C 150 20, 125 5, 100 5 Z" />
					<path fill="#000000" opacity="0.15" d="M 22 85 C 12 85, 12 110, 20 115 C 15 110, 15 90, 22 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 25 95 C 20 100, 20 110, 28 110 C 25 110, 22 105, 25 95 Z" />
					<path fill="#000000" opacity="0.15" d="M 178 85 C 188 85, 188 110, 180 115 C 185 110, 185 90, 178 85 Z" />
					<path fill="#000000" opacity="0.1" d="M 175 95 C 180 100, 180 110, 172 110 C 175 110, 178 105, 175 95 Z" />
					<ellipse cx="50" cy="130" rx="15" ry="10" fill="#FF0000" opacity="0.08" filter="url(#blur-shadow)" />
					<ellipse cx="150" cy="130" rx="15" ry="10" fill="#FF0000" opacity="0.08" filter="url(#blur-shadow)" />
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
					<path fill="#000000" opacity="0.12" d="M 25 150 C 30 185, 60 195, 100 195 C 140 195, 170 185, 175 150 L 165 145 C 160 175, 135 185, 100 185 C 65 185, 40 175, 35 145 Z" />
					<path fill="#FFFFFF" opacity="0.25" d="M 25 120 L 50 140 L 40 120 Z" filter="url(#soft-glow)" />
					<path fill="#FFFFFF" opacity="0.25" d="M 175 120 L 150 140 L 160 120 Z" filter="url(#soft-glow)" />
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
						<filter id="smooth-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="5" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 15 65 C -5 60, -5 105, 18 110 C 35 150, 75 195, 100 195 C 125 195, 165 150, 182 110 C 205 105, 205 60, 185 65 C 180 15, 155 5, 100 5 C 45 5, 20 15, 15 65 Z" />
					<path fill="#000000" opacity="0.15" d="M 18 110 C 35 150, 75 195, 100 195 C 125 195, 165 150, 182 110 C 165 145, 120 180, 100 180 C 80 180, 35 145, 18 110 Z" />
					<path fill="#000000" opacity="0.08" d="M 25 110 Q 50 130 50 150 Q 30 130 25 110" filter="url(#smooth-shadow)" />
					<path fill="#000000" opacity="0.08" d="M 175 110 Q 150 130 150 150 Q 170 130 175 110" filter="url(#smooth-shadow)" />
					<path fill="#FFFFFF" opacity="0.35" d="M 100 5 C 55 5, 25 20, 20 65 C 30 30, 60 15, 100 15 C 140 15, 170 30, 180 65 C 175 20, 145 5, 100 5 Z" />
					<circle cx="100" cy="182" r="6" fill="#FFFFFF" opacity="0.4" filter="url(#smooth-shadow)" />
					<path fill="#000000" opacity="0.1" d="M 12 75 Q 5 95 15 105 Q 10 90 12 75 Z" />
					<path fill="#000000" opacity="0.1" d="M 188 75 Q 195 95 185 105 Q 190 90 188 75 Z" />
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
					<path fill="#000000" opacity="0.12" d="M 30 125 C 35 165, 60 195, 100 195 C 140 195, 165 165, 170 125 C 160 160, 135 185, 100 185 C 65 185, 40 160, 30 125 Z" />
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
					<path fill="#000000" opacity="0.1" d="M 15 130 C 20 175, 55 195, 100 195 C 145 195, 180 175, 185 130 C 170 170, 135 185, 100 185 C 65 185, 30 170, 15 130 Z" />
					<path fill="#000000" opacity="0.08" d="M 40 165 C 65 185, 135 185, 160 165 C 135 175, 65 175, 40 165 Z" filter="url(#chubby-soft)" />
					<circle cx="45" cy="125" r="25" fill="#FF5555" opacity="0.12" filter="url(#chubby-soft)" />
					<circle cx="155" cy="125" r="25" fill="#FF5555" opacity="0.12" filter="url(#chubby-soft)" />
					<path fill="#FFFFFF" opacity="0.25" d="M 100 15 C 60 15, 35 30, 25 70 C 40 35, 65 25, 100 25 C 135 25, 160 35, 175 70 C 165 30, 140 15, 100 15 Z" />
					<path fill="#000000" opacity="0.15" d="M 10 95 Q 5 105 12 115 Q 15 105 10 95 Z" />
					<path fill="#000000" opacity="0.15" d="M 190 95 Q 195 105 188 115 Q 185 105 190 95 Z" />
				`
			},
			{
				id: 'head_narrow',
				name: 'Narrow / Hollow',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<path class="skin-color" fill="#FFCDB2" d="M 40 90 C 25 85, 25 125, 40 130 C 45 175, 70 195, 100 195 C 130 195, 155 175, 160 130 C 175 125, 175 85, 160 90 C 150 20, 130 5, 100 5 C 70 5, 50 20, 40 90 Z" />
					<path fill="#000000" opacity="0.12" d="M 40 130 C 45 175, 70 195, 100 195 C 130 195, 155 175, 160 130 C 145 170, 125 185, 100 185 C 75 185, 55 170, 40 130 Z" />
					<path fill="#000000" opacity="0.08" d="M 45 110 L 60 140 L 45 140 Z" />
					<path fill="#000000" opacity="0.08" d="M 155 110 L 140 140 L 155 140 Z" />
					<path fill="#FFFFFF" opacity="0.25" d="M 100 5 C 75 5, 55 25, 45 80 C 60 30, 75 15, 100 15 C 125 15, 140 30, 155 80 C 145 25, 125 5, 100 5 Z" />
					<path fill="none" stroke="#000000" stroke-width="2.5" opacity="0.15" d="M 33 100 L 30 115" />
					<path fill="none" stroke="#000000" stroke-width="2.5" opacity="0.15" d="M 167 100 L 170 115" />
				`
			},
			{
				id: 'head_square',
				name: 'Square / Rect',
				defaultX: 0,
				defaultY: 0,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 10,
				svgContent: `
					<defs>
						<filter id="rect-blur" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="4" />
						</filter>
					</defs>
					<path class="skin-color" fill="#FFCDB2" d="M 20 70 C 0 65, 0 115, 20 120 L 25 155 C 25 185, 50 195, 100 195 C 150 195, 175 185, 175 155 L 180 120 C 200 115, 200 65, 180 70 L 175 35 C 175 15, 150 5, 100 5 C 50 5, 25 15, 25 35 Z" />
					<path fill="#000000" opacity="0.12" d="M 20 120 L 25 155 C 25 185, 50 195, 100 195 C 150 195, 175 185, 175 155 L 180 120 L 170 120 L 165 155 C 165 175, 140 185, 100 185 C 60 185, 35 175, 35 155 L 30 120 Z" />
					<path fill="#FFFFFF" opacity="0.25" d="M 100 5 C 55 5, 35 15, 35 40 L 35 60 C 45 25, 65 15, 100 15 C 135 15, 155 25, 165 60 L 165 40 C 165 15, 145 5, 100 5 Z" />
					<rect x="35" y="110" width="20" height="40" rx="10" fill="#FF0000" opacity="0.05" filter="url(#rect-blur)" />
					<rect x="145" y="110" width="20" height="40" rx="10" fill="#FF0000" opacity="0.05" filter="url(#rect-blur)" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.1" stroke-linecap="round" d="M 15 85 L 15 105" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.1" stroke-linecap="round" d="M 185 85 L 185 105" />
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
					<path fill="#000000" opacity="0.18" d="M 20 105 L 35 150 L 75 190 C 85 195, 115 195, 125 190 L 165 150 L 180 105 L 165 105 L 150 145 L 120 180 C 110 185, 90 185, 80 180 L 50 145 L 35 105 Z" />
					<polygon points="35,150 75,190 60,150" fill="#000000" opacity="0.1" filter="url(#chisel-edge)" />
					<polygon points="165,150 125,190 140,150" fill="#000000" opacity="0.1" filter="url(#chisel-edge)" />
					<path fill="#FFFFFF" opacity="0.3" d="M 100 5 C 60 5, 30 15, 25 50 L 40 25 C 60 15, 80 15, 100 15 C 120 15, 140 15, 160 25 L 175 50 C 170 15, 140 5, 100 5 Z" />
					<polygon points="25,100 45,115 35,95" fill="#FFFFFF" opacity="0.25" />
					<polygon points="175,100 155,115 165,95" fill="#FFFFFF" opacity="0.25" />
					<polyline points="15,80 8,95 18,100" fill="none" stroke="#000000" stroke-width="3" opacity="0.2" stroke-linejoin="miter" />
					<polyline points="185,80 192,95 182,100" fill="none" stroke="#000000" stroke-width="3" opacity="0.2" stroke-linejoin="miter" />
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
				id: 'eye_happy',
				name: 'Happy Closed',
				defaultX: -30,
				defaultY: -10,
				defaultScaleX: 0.225,
				defaultScaleY: 0.225,
				zIndex: 20,
				svgContent: `
					<path fill="none" stroke="#1A1A1A" stroke-width="16" stroke-linecap="round" d="M 20 120 C 60 40 140 40 180 120" />
					<path fill="none" stroke="#1A1A1A" stroke-width="8" stroke-linecap="round" d="M 25 110 L 10 90 M 45 75 L 30 50 M 155 75 L 170 50" />
					<path fill="none" stroke="#000000" opacity="0.2" stroke-width="6" stroke-linecap="round" d="M 30 135 C 70 150 130 150 170 135" />
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
				id: 'hair_front_wavy',
				name: 'Flowing Front Wavy',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 40,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 100 10 C 60 10, 30 25, 20 90 C 15 140, 25 180, 10 195 C 40 195, 55 150, 55 100 C 65 70, 80 50, 100 50 Z" />
					<path class="hair-color" fill="#3E2723" d="M 100 10 C 140 10, 170 25, 180 90 C 185 140, 175 180, 190 195 C 160 195, 145 150, 145 100 C 135 70, 120 50, 100 50 Z" />
					<path fill="#000000" opacity="0.3" d="M 100 50 C 80 50, 65 70, 55 100 C 45 150, 35 180, 10 195 C 25 170, 35 140, 30 100 C 35 50, 60 25, 100 10 Z" />
					<path fill="#000000" opacity="0.3" d="M 100 50 C 120 50, 135 70, 145 100 C 155 150, 165 180, 190 195 C 175 170, 165 140, 170 100 C 165 50, 140 25, 100 10 Z" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.2" stroke-linecap="round" d="M 40 50 C 30 90, 45 140, 25 180 M 160 50 C 170 90, 155 140, 175 180" />
					<path fill="#FFFFFF" opacity="0.12" d="M 60 30 C 45 60, 40 110, 20 150 C 30 110, 50 60, 80 35 Z" />
					<path fill="#FFFFFF" opacity="0.12" d="M 140 30 C 155 60, 160 110, 180 150 C 170 110, 150 60, 120 35 Z" />
				`
			},
			{
				id: 'hair_front_buzz',
				name: 'Short Buzzcut',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 40,
				svgContent: `
					<defs>
						<filter id="buzz-texture" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur stdDeviation="1.5" />
						</filter>
					</defs>
					<path class="hair-color" fill="#3E2723" d="M 25 80 C 25 30, 60 10, 100 10 C 140 10, 175 30, 175 80 C 170 55, 165 45, 140 40 C 130 38, 110 45, 100 50 C 90 45, 70 38, 60 40 C 35 45, 30 55, 25 80 Z" />
					<path fill="#000000" opacity="0.3" d="M 25 80 C 25 30, 60 10, 100 10 C 140 10, 175 30, 175 80 C 170 65, 150 45, 100 45 C 50 45, 30 65, 25 80 Z" filter="url(#buzz-texture)" />
					<path fill="#000000" opacity="0.2" d="M 60 40 L 65 45 L 70 39 L 75 46 L 80 40 L 85 47 L 90 42 L 95 48 L 100 50 L 105 48 L 110 42 L 115 47 L 120 40 L 125 46 L 130 39 L 135 45 L 140 40 L 130 30 L 70 30 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 60 15 C 80 8, 120 8, 140 15 C 130 25, 70 25, 60 15 Z" filter="url(#buzz-texture)" />
				`
			},
			{
				id: 'hair_front_long_parted',
				name: 'Long Parted',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 40,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 100 15 C 70 15, 30 30, 15 110 C 10 140, 15 190, 20 190 C 35 190, 50 150, 60 110 C 70 70, 90 40, 100 40 Z" />
					<path class="hair-color" fill="#3E2723" d="M 100 15 C 130 15, 170 30, 185 110 C 190 140, 185 190, 180 190 C 165 190, 150 150, 140 110 C 130 70, 110 40, 100 40 Z" />
					<path fill="#000000" opacity="0.3" d="M 100 40 C 90 40, 70 70, 60 110 C 50 150, 35 190, 20 190 C 25 170, 40 130, 45 100 C 55 50, 90 25, 100 15 Z" />
					<path fill="#000000" opacity="0.3" d="M 100 40 C 110 40, 130 70, 140 110 C 150 150, 165 190, 180 190 C 175 170, 160 130, 155 100 C 145 50, 110 25, 100 15 Z" />
					<path fill="none" stroke="#000000" stroke-width="3" opacity="0.25" stroke-linecap="round" d="M 85 25 C 65 50, 50 90, 40 160 M 115 25 C 135 50, 150 90, 160 160 M 70 30 C 45 70, 30 120, 25 180 M 130 30 C 155 70, 170 120, 175 180" />
					<path fill="#FFFFFF" opacity="0.15" d="M 85 45 C 65 60, 40 85, 30 110 C 25 90, 45 50, 80 30 Z" />
					<path fill="#FFFFFF" opacity="0.15" d="M 115 45 C 135 60, 160 85, 170 110 C 175 90, 155 50, 120 30 Z" />
				`
			},
			{
				id: 'hair_front_swoop',
				name: 'Side Swoop',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 40,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 60 15 C 100 5, 150 20, 175 60 C 185 75, 190 100, 185 120 C 160 100, 140 60, 60 40 Z" />
					<path class="hair-color" fill="#3E2723" d="M 60 15 C 40 20, 20 40, 15 80 C 10 100, 10 115, 20 120 C 25 100, 35 70, 60 40 Z" />
					<path fill="#000000" opacity="0.25" d="M 60 40 C 140 60, 160 100, 185 120 C 175 90, 150 40, 80 20 Z" />
					<path fill="#000000" opacity="0.25" d="M 60 40 C 35 70, 25 100, 20 120 C 15 90, 25 40, 50 20 Z" />
					<path class="hair-color" fill="#3E2723" d="M 60 20 C 100 15, 140 30, 165 70 C 140 50, 100 40, 60 30 Z" />
					<path fill="#000000" opacity="0.3" d="M 60 20 C 100 15, 140 30, 165 70 C 140 50, 100 40, 60 30 Z" />
					<path fill="none" stroke="#FFFFFF" stroke-width="4" opacity="0.1" stroke-linecap="round" d="M 70 25 C 100 20, 130 35, 155 70 M 65 35 C 95 30, 130 50, 150 90 M 50 25 C 35 40, 25 60, 20 90" />
					<path fill="#FFFFFF" opacity="0.15" d="M 80 25 C 110 20, 140 35, 150 50 C 120 30, 90 35, 70 35 Z" />
				`
			},
			{
				id: 'hair_front_bangs',
				name: 'Straight Bangs',
				defaultX: 0,
				defaultY: -5,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 40,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 25 80 C 25 30, 60 10, 100 10 C 140 10, 175 30, 175 80 C 175 100, 170 150, 180 170 C 160 170, 150 110, 150 85 L 150 75 C 130 80, 70 80, 50 75 L 50 85 C 50 110, 40 170, 20 170 C 30 150, 25 100, 25 80 Z" />
					<path fill="#000000" opacity="0.3" d="M 25 80 C 25 40, 60 20, 100 20 C 140 20, 175 40, 175 80 C 175 90, 170 120, 175 150 C 165 140, 160 110, 160 85 L 150 75 C 130 85, 70 85, 50 75 L 40 85 C 40 110, 35 140, 25 150 C 30 120, 25 90, 25 80 Z" />
					<path fill="none" stroke="#000000" stroke-width="2" opacity="0.4" d="M 60 40 L 60 78 M 80 30 L 80 80 M 100 25 L 100 80 M 120 30 L 120 80 M 140 40 L 140 78" />
					<path fill="#FFFFFF" opacity="0.15" d="M 40 50 C 70 40, 130 40, 160 50 C 140 60, 60 60, 40 50 Z" />
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
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 35 70 C 30 110, 20 160, 10 180 C 40 170, 60 150, 70 140 C 80 145, 120 145, 130 140 C 140 150, 160 170, 190 180 C 180 160, 170 110, 165 70 Z" />
					<path fill="#000000" opacity="0.5" d="M 60 120 C 80 140, 120 140, 140 120 L 130 140 C 120 145, 80 145, 70 140 Z" />
					<path fill="#000000" opacity="0.25" d="M 10 180 C 30 175, 40 160, 50 140 C 30 150, 20 165, 10 180 Z" />
					<path fill="#000000" opacity="0.25" d="M 190 180 C 170 175, 160 160, 150 140 C 170 150, 180 165, 190 180 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 25 150 C 40 160, 55 145, 65 130 C 50 145, 35 140, 25 150 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 175 150 C 160 160, 145 145, 135 130 C 150 145, 165 140, 175 150 Z" />
				`
			},
			{
				id: 'hair_back_straight_long',
				name: 'Straight Long',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 30 50 C 10 100, 10 160, 20 200 L 180 200 C 190 160, 190 100, 170 50 C 150 10, 50 10, 30 50 Z" />
					<path fill="#000000" opacity="0.25" d="M 50 50 C 40 100, 40 160, 45 200 L 35 200 C 25 160, 25 100, 40 50 Z" />
					<path fill="#000000" opacity="0.25" d="M 150 50 C 160 100, 160 160, 155 200 L 165 200 C 175 160, 175 100, 160 50 Z" />
					<path fill="#000000" opacity="0.4" d="M 70 100 L 130 100 L 140 200 L 60 200 Z" />
					<path fill="#FFFFFF" opacity="0.08" d="M 160 80 C 170 120, 165 170, 170 200 L 155 200 C 150 150, 150 100, 140 70 Z" />
					<path fill="#FFFFFF" opacity="0.08" d="M 40 80 C 30 120, 35 170, 30 200 L 45 200 C 50 150, 50 100, 60 70 Z" />
				`
			},
			{
				id: 'hair_back_wavy_long',
				name: 'Wavy Long',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 40 50 C 10 70, 20 120, 5 150 C -5 180, 20 200, 20 200 L 180 200 C 180 200, 205 180, 195 150 C 180 120, 190 70, 160 50 C 140 20, 60 20, 40 50 Z" />
					<path fill="#000000" opacity="0.3" d="M 40 50 C 20 80, 35 110, 15 140 C 0 170, 30 200, 30 200 L 15 200 C 0 170, -10 140, 10 110 C 30 80, 15 50, 40 50 Z" />
					<path fill="#000000" opacity="0.3" d="M 160 50 C 180 80, 165 110, 185 140 C 200 170, 170 200, 170 200 L 185 200 C 200 170, 210 140, 190 110 C 170 80, 185 50, 160 50 Z" />
					<path fill="#000000" opacity="0.4" d="M 65 110 C 80 130, 120 130, 135 110 L 150 200 L 50 200 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 30 90 C 50 120, 20 160, 40 200 L 25 200 C 5 160, 35 120, 15 90 Z" />
					<path fill="#FFFFFF" opacity="0.1" d="M 170 90 C 150 120, 180 160, 160 200 L 175 200 C 195 160, 165 120, 185 90 Z" />
				`
			},
			{
				id: 'hair_back_twin_tails',
				name: 'Twin Tails',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 50 80 C 50 120, 70 140, 100 140 C 130 140, 150 120, 150 80 Z" />
					<path class="hair-color" fill="#3E2723" d="M 40 60 C -10 60, -20 140, 15 180 C 10 160, 30 160, 20 190 C 50 160, 30 100, 40 60 Z" />
					<path class="hair-color" fill="#3E2723" d="M 160 60 C 210 60, 220 140, 185 180 C 190 160, 170 160, 180 190 C 150 160, 170 100, 160 60 Z" />
					<path fill="#000000" opacity="0.25" d="M 40 60 C -5 70, -10 120, 15 150 C 0 120, 20 80, 40 60 Z" />
					<path fill="#000000" opacity="0.25" d="M 160 60 C 205 70, 210 120, 185 150 C 200 120, 180 80, 160 60 Z" />
					<rect x="35" y="60" width="15" height="10" rx="5" fill="#111111" transform="rotate(-30 42 65)" />
					<rect x="150" y="60" width="15" height="10" rx="5" fill="#111111" transform="rotate(30 157 65)" />
					<path fill="#FFFFFF" opacity="0.15" d="M 10 110 C 20 140, 15 160, 20 170 C 15 150, 10 120, 0 100 Z" />
					<path fill="#FFFFFF" opacity="0.15" d="M 190 110 C 180 140, 185 160, 180 170 C 185 150, 190 120, 200 100 Z" />
				`
			},
			{
				id: 'hair_back_ponytail',
				name: 'Ponytail',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 50 50 C 50 110, 70 130, 100 130 C 130 130, 150 110, 150 50 Z" />
					<path class="hair-color" fill="#3E2723" d="M 100 30 C 180 20, 220 100, 170 180 C 160 160, 180 150, 160 190 C 130 130, 120 70, 100 30 Z" />
					<path fill="#000000" opacity="0.25" d="M 100 30 C 160 30, 180 80, 150 140 C 170 100, 140 60, 100 30 Z" />
					<rect x="90" y="25" width="20" height="10" rx="5" fill="#111111" />
					<path fill="none" stroke="#000000" stroke-width="4" opacity="0.15" stroke-linecap="round" d="M 110 35 C 150 40, 180 90, 160 160 M 115 35 C 165 50, 195 100, 165 170" />
					<path fill="#FFFFFF" opacity="0.15" d="M 120 40 C 160 50, 190 100, 175 140 C 190 100, 160 60, 110 40 Z" />
				`
			},
			{
				id: 'hair_back_short_taper',
				name: 'Short Tapered',
				defaultX: 0,
				defaultY: 10,
				defaultScaleX: 0.7,
				defaultScaleY: 0.7,
				zIndex: 5,
				svgContent: `
					<path class="hair-color" fill="#3E2723" d="M 40 60 C 35 100, 60 140, 100 140 C 140 140, 165 100, 160 60 C 150 30, 50 30, 40 60 Z" />
					<path fill="#000000" opacity="0.3" d="M 45 100 C 65 140, 135 140, 155 100 C 145 125, 120 140, 100 140 C 80 140, 55 125, 45 100 Z" />
					<path fill="#000000" opacity="0.15" d="M 40 60 C 45 90, 65 110, 80 115 L 60 130 C 40 110, 35 80, 40 60 Z" />
					<path fill="#000000" opacity="0.15" d="M 160 60 C 155 90, 135 110, 120 115 L 140 130 C 160 110, 165 80, 160 60 Z" />
				`
			}
		]
	}
];
