import gsap from "gsap";
import * as THREE from "three";
import { block, outline, palette, toon } from "./toon";

export interface CookOptions {
	apron: number;
	skin: number;
	/** The chef wears a tall toque and a red scarf: the one who checks. */
	chef?: boolean;
}

/** A small toy cook, built from primitives and animated procedurally. */
export class Cook {
	readonly root = new THREE.Group();
	private readonly body = new THREE.Group();
	private readonly legs: THREE.Object3D[] = [];
	private readonly arms: THREE.Object3D[] = [];
	private readonly carried: THREE.Group;
	private walking = false;
	private stirring = false;
	private waving = 0;
	private phase = Math.random() * Math.PI * 2;
	private readonly eyes: THREE.Mesh[] = [];
	private nextBlink = 1 + Math.random() * 3;

	constructor(options: CookOptions) {
		const { apron, skin, chef = false } = options;
		this.root.add(this.body);

		for (const side of [-1, 1]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * 0.13, 0.5, 0);
			const leg = outline(
				new THREE.Mesh(
					new THREE.CapsuleGeometry(0.1, 0.32, 4, 10),
					toon(palette.trousers),
				),
				0.02,
			);
			leg.position.y = -0.25;
			pivot.add(leg);
			this.body.add(pivot);
			this.legs.push(pivot);
		}

		const jacket = outline(
			new THREE.Mesh(
				new THREE.CapsuleGeometry(0.3, 0.42, 6, 16),
				toon(palette.whites),
			),
			0.03,
		);
		jacket.position.y = 0.92;
		this.body.add(jacket);
		const apronMesh = block(0.46, 0.5, 0.06, apron, 0, 0.27, 0.62);
		this.body.add(apronMesh);
		for (const y of [1.02, 1.14]) {
			const button = new THREE.Mesh(
				new THREE.SphereGeometry(0.03, 8, 8),
				toon(palette.ink),
			);
			button.position.set(0.08, y, 0.29);
			this.body.add(button);
		}

		for (const side of [-1, 1]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * 0.36, 1.16, 0);
			const arm = outline(
				new THREE.Mesh(
					new THREE.CapsuleGeometry(0.08, 0.34, 4, 10),
					toon(palette.whites),
				),
				0.02,
			);
			arm.position.y = -0.24;
			const hand = new THREE.Mesh(
				new THREE.SphereGeometry(0.08, 10, 10),
				toon(skin),
			);
			hand.position.y = -0.46;
			pivot.add(arm, hand);
			this.body.add(pivot);
			this.arms.push(pivot);
		}

		const head = outline(
			new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 16), toon(skin)),
			0.025,
		);
		head.position.y = 1.58;
		this.body.add(head);
		for (const side of [-1, 1]) {
			const eye = new THREE.Mesh(
				new THREE.SphereGeometry(0.035, 8, 8),
				toon(palette.ink),
			);
			eye.position.set(side * 0.09, 1.62, 0.22);
			this.body.add(eye);
			this.eyes.push(eye);
		}

		const toqueHeight = chef ? 0.5 : 0.22;
		const toque = outline(
			new THREE.Mesh(
				new THREE.CylinderGeometry(0.23, 0.2, toqueHeight, 20),
				toon(palette.whites),
			),
			0.025,
		);
		toque.position.y = 1.78 + toqueHeight / 2;
		this.body.add(toque);
		if (chef) {
			const puff = outline(
				new THREE.Mesh(
					new THREE.SphereGeometry(0.28, 16, 12),
					toon(palette.whites),
				),
				0.025,
			);
			puff.position.y = 1.78 + toqueHeight;
			puff.scale.y = 0.6;
			this.body.add(puff);
			const scarf = outline(
				new THREE.Mesh(
					new THREE.TorusGeometry(0.2, 0.06, 8, 20),
					toon(palette.check),
				),
				0.02,
			);
			scarf.rotation.x = Math.PI / 2;
			scarf.position.y = 1.36;
			this.body.add(scarf);
		}

		this.carried = new THREE.Group();
		this.carried.position.set(0, 0.95, 0.45);
		this.carried.visible = false;
		this.body.add(this.carried);

		this.root.traverse((o) => {
			o.castShadow = true;
		});
	}

	/** Shows an object in the cook's hands. */
	carry(object: THREE.Object3D | null) {
		this.carried.clear();
		if (object) this.carried.add(object);
		this.carried.visible = object !== null;
		for (const arm of this.arms) arm.rotation.x = object ? -1.1 : 0;
	}

	faceTowards(point: THREE.Vector3) {
		const dx = point.x - this.root.position.x;
		const dz = point.z - this.root.position.z;
		if (Math.abs(dx) + Math.abs(dz) < 1e-3) return;
		const target = Math.atan2(dx, dz);
		let delta = target - this.root.rotation.y;
		delta = Math.atan2(Math.sin(delta), Math.cos(delta));
		gsap.to(this.root.rotation, {
			y: this.root.rotation.y + delta,
			duration: 0.25,
			ease: "power2.out",
		});
	}

	/** Walks through waypoints at a steady pace. Resolves on arrival. */
	walk(points: THREE.Vector3[], speed = 3.2): gsap.core.Timeline {
		const tl = gsap.timeline({
			onStart: () => {
				this.walking = true;
			},
			onComplete: () => {
				this.walking = false;
			},
		});
		let from = this.root.position.clone();
		for (const point of points) {
			const distance = from.distanceTo(point);
			const target = point.clone();
			tl.call(() => this.faceTowards(target));
			tl.to(this.root.position, {
				x: point.x,
				z: point.z,
				duration: distance / speed,
				ease: "none",
			});
			from = point.clone();
		}
		return tl;
	}

	/** A small hop, used for "Oui chef !" and for celebrating. */
	hop() {
		gsap.fromTo(
			this.body.position,
			{ y: 0 },
			{ y: 0.25, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out" },
		);
	}

	/** The chef leans over the plate to inspect it. */
	inspect(): gsap.core.Timeline {
		return gsap
			.timeline()
			.to(this.body.rotation, { x: 0.35, duration: 0.3, ease: "power2.out" })
			.to(this.body.rotation, {
				z: 0.12,
				duration: 0.25,
				yoyo: true,
				repeat: 1,
			})
			.to(this.body.rotation, { x: 0, duration: 0.3, ease: "power2.inOut" });
	}

	/** Waves hello with the left arm, for a few seconds. */
	wave(seconds = 1.8) {
		this.waving = seconds;
	}

	/** Stirs a pot with the right arm while standing still. */
	setStirring(on: boolean) {
		this.stirring = on;
	}

	update(delta: number) {
		this.phase += delta * (this.walking ? 11 : 2.2);
		// Blink every few seconds: the smallest sign of life.
		this.nextBlink -= delta;
		const closed = this.nextBlink < 0.12;
		for (const eye of this.eyes) eye.scale.y = closed ? 0.15 : 1;
		if (this.nextBlink < 0) this.nextBlink = 2 + Math.random() * 4;
		if (this.walking) {
			const swing = Math.sin(this.phase) * 0.6;
			this.legs[0].rotation.x = swing;
			this.legs[1].rotation.x = -swing;
			if (!this.carried.visible) {
				this.arms[0].rotation.x = -swing * 0.7;
				this.arms[1].rotation.x = swing * 0.7;
			}
			this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
		} else {
			if (this.waving > 0) {
				this.waving -= delta;
				this.arms[0].rotation.z = -2.5 + Math.sin(this.phase * 4) * 0.35;
			} else {
				this.arms[0].rotation.z *= 0.85;
			}
			for (const leg of this.legs) leg.rotation.x *= 0.8;
			if (!this.carried.visible)
				for (const arm of this.arms) arm.rotation.x *= 0.85;
			this.body.scale.y = 1 + Math.sin(this.phase) * 0.012;
			if (this.stirring && !this.carried.visible) {
				this.arms[1].rotation.x = -0.9 + Math.sin(this.phase * 3) * 0.25;
				this.arms[1].rotation.z = Math.cos(this.phase * 3) * 0.2;
			} else {
				this.arms[1].rotation.z *= 0.85;
			}
		}
	}
}

/** A crate of ingredients, carried from the pantry to the stove. */
export function crate(colors: number[]): THREE.Group {
	const g = new THREE.Group();
	g.add(block(0.55, 0.25, 0.38, palette.wood, 0, 0, -0.12));
	colors.slice(0, 6).forEach((color, i) => {
		const item = new THREE.Mesh(
			new THREE.SphereGeometry(0.07, 10, 10),
			toon(color),
		);
		item.position.set(
			-0.18 + (i % 3) * 0.18,
			0.3,
			-0.2 + Math.floor(i / 3) * 0.16,
		);
		g.add(outline(item, 0.015));
	});
	return g;
}
