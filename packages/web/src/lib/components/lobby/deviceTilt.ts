import { Euler, Quaternion } from 'three';

/** Relative device rotation avoids the discontinuities in beta/gamma Euler angles. */
export class DeviceTilt {
	private baseline: Quaternion | null = null;
	private screenAngle: number | null = null;
	private readonly orientation = new Quaternion();
	private readonly relative = new Quaternion();
	private readonly angles = new Euler(0, 0, 0, 'ZXY');

	reset() {
		this.baseline = null;
		this.screenAngle = null;
	}

	update(alpha: number | null, beta: number | null, gamma: number | null, screenAngle: number) {
		if (
			beta === null ||
			gamma === null ||
			!Number.isFinite(beta) ||
			!Number.isFinite(gamma) ||
			(alpha !== null && !Number.isFinite(alpha))
		)
			return null;
		const radians = Math.PI / 180;
		this.orientation.setFromEuler(
			this.angles.set(beta * radians, gamma * radians, (alpha ?? 0) * radians, 'ZXY')
		);
		if (!this.baseline || this.screenAngle !== screenAngle) {
			this.baseline = this.orientation.clone().invert();
			this.screenAngle = screenAngle;
		}
		this.relative.copy(this.baseline).multiply(this.orientation);
		// q and -q describe the same rotation; choose the shorter arc.
		const sign = this.relative.w < 0 ? -1 : 1;
		const vertical = (2 * Math.atan2(sign * this.relative.x, sign * this.relative.w)) / radians;
		const horizontal = (2 * Math.atan2(sign * this.relative.y, sign * this.relative.w)) / radians;
		const angle = screenAngle * radians;
		return {
			horizontal: horizontal * Math.cos(angle) + vertical * Math.sin(angle),
			vertical: vertical * Math.cos(angle) - horizontal * Math.sin(angle)
		};
	}
}
