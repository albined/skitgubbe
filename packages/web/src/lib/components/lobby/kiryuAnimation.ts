import { Bone, Object3D, Quaternion, Vector3 } from 'three';

const smooth = (value: number) => {
	const t = Math.max(0, Math.min(1, value));
	return t * t * (3 - 2 * t);
};
const envelope = (time: number, start: number, rise: number, hold: number, fall: number) =>
	smooth((time - start) / rise) * (1 - smooth((time - start - rise - hold) / fall));

export function kiryuGestures(seconds: number) {
	const phase = ((seconds % 120) + 120) % 120;
	return {
		stretch: envelope(phase, 10, 3, 3, 4),
		scratch: envelope(phase, 28, 2, 4, 2),
		scratchStroke: Math.sin((phase - 30) * Math.PI * 2 * 1.3),
		lounge: envelope(phase, 44, 7, 33, 7),
		neck: envelope(phase, 63, 2, 5, 2) + envelope(phase, 101, 2, 5, 2),
		neckPhase: ((phase >= 90 ? phase - 101 : phase - 63) / 9) * Math.PI * 2
	};
}

/** Two-bone IK keeps wrists and ankles on their contacts while the torso moves. */
export function createKiryuAnimation(character: Object3D) {
	const bones = new Map<string, Bone>();
	character.traverse((o) => {
		if (o instanceof Bone) bones.set(o.name, o);
	});
	const bone = (name: string) => {
		const b = bones.get(name);
		if (!b) throw new Error(`Missing cameo bone: ${name}`);
		return b;
	};
	character.updateWorldMatrix(true, true);
	const rest = [...bones.values()].map((b) => ({
		bone: b,
		rotation: b.quaternion.clone(),
		position: b.position.clone()
	}));
	const point = (b: Bone) => character.worldToLocal(b.getWorldPosition(new Vector3()));
	const worldRotation = (b: Bone) => b.getWorldQuaternion(new Quaternion());
	const chain = (upper: string, lower: string, end: string) => {
		const a = bone(upper),
			b = bone(lower),
			c = bone(end);
		const start = point(a),
			joint = point(b),
			tip = point(c);
		return {
			a,
			b,
			c,
			lengthA: start.distanceTo(joint),
			lengthB: joint.distanceTo(tip),
			joint,
			tip,
			rotation: worldRotation(c)
		};
	};
	const leftArm = chain('arml', 'forearml', 'handl'),
		rightArm = chain('armr', 'forearmr', 'handr');
	const leftLeg = chain('thighl', 'legl', 'footl'),
		rightLeg = chain('thighr', 'legr', 'footr');
	const x = new Vector3(1, 0, 0),
		y = new Vector3(0, 1, 0),
		z = new Vector3(0, 0, 1);
	const rotation = new Quaternion();
	const offset = (name: string, axis: Vector3, angle: number) =>
		bone(name).quaternion.multiply(rotation.setFromAxisAngle(axis, angle));
	const aim = (b: Bone, child: Bone, target: Vector3) => {
		const origin = b.getWorldPosition(new Vector3());
		const direction = child.getWorldPosition(new Vector3()).sub(origin).normalize();
		const desired = character.localToWorld(target.clone()).sub(origin).normalize();
		const q = new Quaternion().setFromUnitVectors(direction, desired).multiply(worldRotation(b));
		b.quaternion.copy(b.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q));
		b.updateWorldMatrix(false, true);
	};
	const solve = (
		limb: ReturnType<typeof chain>,
		target: Vector3,
		pole: Vector3,
		endRotation = limb.rotation
	) => {
		const start = point(limb.a),
			direction = target.clone().sub(start);
		const distance = Math.max(
			0.001,
			Math.min(direction.length(), limb.lengthA + limb.lengthB - 0.001)
		);
		direction.normalize();
		const bend = pole.clone().sub(start);
		bend.addScaledVector(direction, -bend.dot(direction)).normalize();
		const along = (limb.lengthA ** 2 - limb.lengthB ** 2 + distance ** 2) / (2 * distance);
		const height = Math.sqrt(Math.max(0, limb.lengthA ** 2 - along ** 2));
		const joint = start.clone().addScaledVector(direction, along).addScaledVector(bend, height);
		aim(limb.a, limb.b, joint);
		// Rotate the thigh to keep the knee hinge in the new bend plane. Arms
		// retain their shoulder roll to avoid twisting the jacket's shoulder seam.
		if (limb === leftLeg || limb === rightLeg) {
			const origin = limb.a.getWorldPosition(new Vector3());
			const pivot = limb.b.getWorldPosition(new Vector3());
			const axis = pivot.clone().sub(origin).normalize();
			const currentBend = limb.c.getWorldPosition(new Vector3()).sub(pivot);
			const desiredBend = character.localToWorld(target.clone()).sub(pivot);
			currentBend.addScaledVector(axis, -currentBend.dot(axis)).normalize();
			desiredBend.addScaledVector(axis, -desiredBend.dot(axis)).normalize();
			const twist = Math.atan2(
				axis.dot(currentBend.clone().cross(desiredBend)),
				currentBend.dot(desiredBend)
			);
			const aligned = new Quaternion()
				.setFromAxisAngle(axis, twist)
				.multiply(worldRotation(limb.a));
			limb.a.quaternion.copy(
				limb.a.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(aligned)
			);
			limb.a.updateWorldMatrix(false, true);
		}
		aim(limb.b, limb.c, target);
		limb.c.quaternion.copy(
			limb.c.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(endRotation)
		);
		limb.c.updateWorldMatrix(false, true);
	};
	const endTurn = (restRotation: Quaternion, axis: Vector3, angle: number) => {
		const worldAxis = axis.clone().applyQuaternion(character.getWorldQuaternion(new Quaternion()));
		return new Quaternion().setFromAxisAngle(worldAxis, angle).multiply(restRotation);
	};
	return (
		seconds: number,
		idle: { breath: number; rise: number; settle: number; glance: number; nod: number }
	) => {
		for (const entry of rest) {
			entry.bone.quaternion.copy(entry.rotation);
			entry.bone.position.copy(entry.position);
		}
		const pose = kiryuGestures(seconds);
		offset('spine_01x', x, -pose.lounge * 0.055 + pose.scratch * 0.045);
		offset('spine_01x', z, idle.settle + pose.lounge * 0.035);
		offset('spine_02x', x, idle.breath - pose.stretch * 0.06);
		bone('spine_02x').position.y += idle.rise;
		offset('headx', y, idle.glance * (1 - pose.neck));
		offset(
			'headx',
			x,
			idle.nod -
				pose.stretch * 0.1 +
				pose.scratch * 0.14 +
				pose.neck * (0.1 + 0.09 * Math.cos(pose.neckPhase))
		);
		offset('neckx', z, pose.neck * Math.sin(pose.neckPhase) * 0.16);
		character.updateWorldMatrix(true, true);
		const leftFoot = leftLeg.tip.clone().lerp(new Vector3(-0.15, 0.72, 0.43), pose.lounge);
		leftFoot.y += Math.sin(pose.lounge * Math.PI) * 0.14;
		leftFoot.z += Math.sin(pose.lounge * Math.PI) * 0.1;
		solve(
			leftLeg,
			leftFoot,
			leftLeg.joint.clone().lerp(new Vector3(0.85, 0.65, 0.5), pose.lounge),
			endTurn(leftLeg.rotation, y, (-Math.PI / 2) * pose.lounge)
		);
		solve(rightLeg, rightLeg.tip, rightLeg.joint);
		const leftHand = leftArm.tip
			.clone()
			.lerp(new Vector3(0.4, 1.61, -0.02), pose.stretch)
			.lerp(point(leftLeg.b).add(new Vector3(-0.03, 0.08, -0.08)), pose.lounge);
		const rightHand = rightArm.tip
			.clone()
			.lerp(new Vector3(-0.4, 1.61, -0.02), pose.stretch)
			.lerp(new Vector3(-0.15, 0.68, 0.28 + pose.scratchStroke * 0.018), pose.scratch)
			.lerp(new Vector3(-0.7, 1.05, -0.2), pose.lounge);
		const leftPole = leftArm.joint.clone().lerp(new Vector3(0.75, 1.3, 0.05), pose.stretch);
		const rightPole = rightArm.joint
			.clone()
			.lerp(new Vector3(-0.75, 1.3, 0.05), pose.stretch)
			.lerp(new Vector3(-0.48, 1.02, 0.25), pose.lounge);
		solve(leftArm, leftHand, leftPole, endTurn(leftArm.rotation, x, -1.5 * pose.stretch));
		solve(
			rightArm,
			rightHand,
			rightPole,
			endTurn(endTurn(rightArm.rotation, x, -1.5 * pose.stretch), y, (-Math.PI / 2) * pose.lounge)
		);
	};
}
