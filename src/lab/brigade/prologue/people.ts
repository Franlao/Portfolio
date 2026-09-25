import gsap from "gsap";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { outline, palette, toon } from "../toon";

/**
 * The people of the street: passers-by, the maître d' and the visitor. They share the
 * cooks' toy proportions (about 1.9 units tall), toon shading and inked outlines.
 * Geometries and materials are cached and shared, so a crowd costs draw calls only.
 */

export type Look = "passerby" | "host" | "recruiter";
export type HairStyle = "bald" | "crop" | "long" | "bun" | "ponytail" | "curly";
export type HatStyle = "felt" | "beret";

export interface Outfit {
	look: Look;
	/** Coat or jacket; the maître d's waistcoat. */
	coat: number;
	trousers: number;
	/** Take it from palette.skins. */
	skin: number;
	hair: number;
	/** Scarf colour: a scarf is worn when it is set. */
	accent?: number;
	hat?: boolean;
	/** A handbag, or the visitor's satchel, in the left hand. */
	bag?: boolean;
	/** A furled umbrella in the left hand (not with a bag: one hand, one thing). */
	umbrella?: boolean;
	/** A short crop when omitted. */
	hairStyle?: HairStyle;
	/** A felt hat when omitted. */
	hatStyle?: HatStyle;
	/** A coat down to the knees. The visitor always wears one; the maître d' never does. */
	longCoat?: boolean;
}

/** Mulberry32: a tiny seeded generator, so outfits and crowds replay identically. */
export function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** About the most a character may cost, outlines included, on an integrated GPU. */
export const MESH_BUDGET = 25;

// Muted street colours. Red and blue are left out on purpose: on this site, red means
// a check and blue means a model, so neither may be worn for decoration.
const COATS = [
	0x3f4442, 0x6b6b45, 0x8a7f72, 0x3f5a4a, 0x5a4636, 0x7c8284, 0x5e4a5a,
	0xa89f8a, 0x55635d, 0x9c8340, 0x7a5236,
] as const;
const TROUSERS = [
	0x2b2f2d, 0x3b3a36, 0x4a4540, 0x5c5a52, 0x6e675c, 0x33302c,
] as const;
const HAIR = [
	0x1b1a18, 0x2e231b, 0x3a2a1e, 0x5b3d26, 0x7a5230, 0xb89a64, 0xd8c08a,
	0x9a9a96, 0xdedbd2,
] as const;
const ACCENTS = [
	0xc9a13b, 0xe8dcc0, 0x7d8f6a, 0x4a4a48, 0x6a4c63, 0xb07d4a, 0x8c8a55,
] as const;
const LEATHER = [0x6b4128, 0x242220, 0x9b6b3d, 0x4a3426] as const;
const UMBRELLAS = [0x2a2826, 0x3f5a4a, 0x5a4636, 0x6b6b45] as const;
const FELT = [0x2a2826, 0x4a3f36, 0x5f5a52, 0x3f4442] as const;
const HAIR_STYLES: readonly HairStyle[] = [
	"crop",
	"crop",
	"crop",
	"long",
	"long",
	"bun",
	"ponytail",
	"curly",
	"curly",
	"bald",
];
/** Hairstyles a hat can sit on without the hair poking through it. */
const UNDER_A_HAT = new Set<HairStyle>(["bald", "crop", "long", "ponytail"]);
const SHIRT = palette.whites;
const SCREEN = 0xdff3ea;

// Body layout, the same as a Cook's.
const HIP = 0.5;
const SHOULDER = { x: 0.35, y: 1.16 };
const NECK = 1.36;
/** From the shoulder to the centre of the hand. */
const ARM = 0.46;
/** Leg cycle, in radians per unit walked: the feet do not slide. */
const CADENCE = 6;
const SIT_LEGS = -1.35;
/** Seated, the thighs rest this high above the root: put the root this far below the seat. */
export const SEAT_HEIGHT = 0.41;
const SIP_TIME = 1.8;
const NOD_TIME = 0.9;

/** An arm pose, as Euler angles of the shoulder, written for the right arm (the left mirrors z). */
interface Pose {
	x: number;
	z: number;
}
const POSES = {
	rest: { x: 0, z: -0.06 },
	carry: { x: 0, z: -0.12 },
	phone: { x: -1.23, z: 0.64 },
	belly: { x: -0.87, z: 0.64 },
	back: { x: 0.78, z: 0.57 },
	lap: { x: -0.3, z: 0.15 },
	seatedCup: { x: -0.86, z: 0.47 },
	cup: { x: -0.95, z: 0.3 },
	sip: { x: -2.45, z: 0.78 },
	napkin: { x: -0.5, z: 0.25 },
} satisfies Record<string, Pose>;

// Shared resources: one material per colour, one geometry per shape.
const materials = new Map<string, THREE.MeshToonMaterial>();
function paint(color: number, doubleSided = false): THREE.MeshToonMaterial {
	const key = `${color}${doubleSided ? "/2" : ""}`;
	let material = materials.get(key);
	if (!material) {
		material = toon(
			color,
			doubleSided ? { side: THREE.DoubleSide } : ({} as const),
		);
		materials.set(key, material);
	}
	return material;
}
const geometries = new Map<string, THREE.BufferGeometry>();
function shape(
	key: string,
	make: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
	let geometry = geometries.get(key);
	if (!geometry) {
		geometry = make();
		geometries.set(key, geometry);
	}
	return geometry;
}
const ink = new THREE.MeshBasicMaterial({
	color: palette.ink,
	side: THREE.BackSide,
});
const screen = new THREE.MeshBasicMaterial({ color: SCREEN });

/** A toon mesh, outlined unless thickness is null. Only the big pieces cast shadows. */
function part(
	geometry: THREE.BufferGeometry,
	color: number,
	thickness: number | null,
	shadow = false,
): THREE.Mesh {
	const mesh = new THREE.Mesh(geometry, paint(color));
	if (thickness !== null) outline(mesh, thickness);
	mesh.castShadow = shadow;
	return mesh;
}

/**
 * The outline for open shapes (hair caps, the waistcoat, the apron): toon's outline
 * scales around the bounding box, which is uneven for a cap, so this shell grows evenly
 * from the shape's own centre.
 */
function capOutline(
	mesh: THREE.Mesh,
	radius: number,
	thickness = 0.022,
): THREE.Mesh {
	const shell = new THREE.Mesh(mesh.geometry, ink);
	shell.scale.setScalar((radius + thickness) / radius);
	shell.raycast = () => {};
	mesh.add(shell);
	mesh.receiveShadow = true;
	return mesh;
}

/** A stable pick for colours the outfit does not name (hat, bag, umbrella). */
function toneFor(list: readonly number[], ...keys: number[]): number {
	let h = 2166136261;
	for (const key of keys) h = Math.imul(h ^ key, 16777619);
	return list[(h >>> 0) % list.length];
}

/** How many meshes a Person in this outfit is built with (phone and cup come on top, when held). */
export function meshCount(outfit: Outfit): number {
	const host = outfit.look === "host";
	const recruiter = outfit.look === "recruiter";
	// Legs, chest, arms (each with its outline), hands, head and its outline, eyes.
	let n = 4 + 2 + 4 + 2 + 2 + 1;
	const hair = outfit.hairStyle ?? "crop";
	if (hair === "crop" || hair === "curly") n += 2;
	else if (hair !== "bald") n += 4;
	// Waistcoat, bow tie, apron, moustache, napkin.
	if (host) n += 2 + 1 + 2 + 1 + 2;
	else if (outfit.longCoat || recruiter) n += 2;
	if (outfit.accent !== undefined) n += recruiter ? 3 : 2;
	if (outfit.hat) n += 2;
	if (outfit.bag) n += recruiter ? 2 : 3;
	else if (outfit.umbrella) n += 2;
	return n;
}

/** A pseudo-random, deterministic outfit for a passer-by. */
export function passerbyOutfit(seed: number): Outfit {
	const random = seeded(seed ^ 0x51f15e);
	const pick = <T>(list: readonly T[]): T =>
		list[Math.floor(random() * list.length)];
	const hairStyle = pick(HAIR_STYLES);
	const outfit: Outfit = {
		look: "passerby",
		coat: pick(COATS),
		trousers: pick(TROUSERS),
		skin: pick(palette.skins),
		hair: pick(HAIR),
		hairStyle,
	};
	// Every roll is drawn up front, so one accessory's luck never shifts another's.
	const rolls = {
		longCoat: random(),
		accent: random(),
		accentColor: pick(ACCENTS),
		hat: random(),
		beret: random(),
		bag: random(),
		umbrella: random(),
		first: random(),
	};
	const wishes: ((o: Outfit) => Partial<Outfit> | null)[] = [
		() => (rolls.longCoat < 0.5 ? { longCoat: true } : null),
		() => (rolls.accent < 0.35 ? { accent: rolls.accentColor } : null),
		() =>
			rolls.hat < 0.28 && UNDER_A_HAT.has(hairStyle)
				? { hat: true, hatStyle: rolls.beret < 0.4 ? "beret" : "felt" }
				: null,
		(o) => (rolls.bag < 0.3 && !o.umbrella ? { bag: true } : null),
		(o) => (rolls.umbrella < 0.18 && !o.bag ? { umbrella: true } : null),
	];
	// Starting from a random wish keeps any accessory from always winning the budget.
	// One mesh stays free for a phone.
	const start = Math.floor(rolls.first * wishes.length);
	for (let k = 0; k < wishes.length; k++) {
		const wish = wishes[(start + k) % wishes.length](outfit);
		if (wish && meshCount({ ...outfit, ...wish }) <= MESH_BUDGET - 1)
			Object.assign(outfit, wish);
	}
	return outfit;
}

/** Something held in a hand, kept upright against the swing of the arm. */
interface Held {
	group: THREE.Group;
	arm: THREE.Object3D;
	/** 1: stays upright; below 1, it swings a little with the arm. */
	upright: number;
}

let created = 0;
const scratch = {
	quaternion: new THREE.Quaternion(),
	tilt: new THREE.Quaternion(),
	euler: new THREE.Euler(),
	identity: new THREE.Quaternion(),
};

/** A toy person of the street, built from primitives and animated procedurally. */
export class Person {
	readonly root = new THREE.Group();
	/** Height above the feet where a speech bubble hangs, just over the head. */
	readonly bubbleHeight: number;
	private readonly look: Look;
	private readonly body = new THREE.Group();
	/** Pivots at the hips, so a bow bends at the waist. */
	private readonly torso = new THREE.Group();
	/** Pivots at the neck, for nods and glances. */
	private readonly head = new THREE.Group();
	private readonly legs: THREE.Group[] = [];
	private readonly arms: THREE.Group[] = [];
	private readonly hands: THREE.Mesh[] = [];
	private readonly eyes: THREE.Mesh;
	private readonly skirt: THREE.Mesh | null = null;
	private readonly held: Held[] = [];
	private readonly carrying: boolean;
	private phone: THREE.Group | null = null;
	private cup: THREE.Group | null = null;
	private readonly random: () => number;
	private phase: number;
	private nextBlink: number;
	private pace = 0;
	private turnTo: number | null = null;
	private waving = 0;
	private waveArm = 0;
	private gesturing = 0;
	private gestureArm = 0;
	private readonly gestureTarget = new THREE.Vector3();
	private posing = false;
	private sitting = false;
	private phoning = false;
	private sipping = 0;
	private nodding = 0;
	private glancing: THREE.Vector3 | null = null;

	constructor(outfit: Outfit, seed = 0x5eed + 7919 * created++) {
		this.look = outfit.look;
		this.random = seeded(seed);
		this.phase = this.random() * Math.PI * 2;
		this.nextBlink = 1 + this.random() * 3;
		const host = outfit.look === "host";
		const recruiter = outfit.look === "recruiter";
		this.root.add(this.body);

		for (const side of [-1, 1]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * 0.13, HIP, 0);
			const leg = part(
				shape("leg", () => new THREE.CapsuleGeometry(0.1, 0.32, 4, 10)),
				outfit.trousers,
				0.02,
				true,
			);
			leg.position.y = -0.25;
			pivot.add(leg);
			this.body.add(pivot);
			this.legs.push(pivot);
		}

		this.torso.position.y = HIP;
		this.body.add(this.torso);
		const chest = part(
			shape("chest", () => new THREE.CapsuleGeometry(0.29, 0.42, 6, 16)),
			host ? SHIRT : outfit.coat,
			0.03,
			true,
		);
		chest.position.y = 0.92 - HIP;
		this.torso.add(chest);

		for (const side of [-1, 1]) {
			const pivot = new THREE.Group();
			pivot.position.set(side * SHOULDER.x, SHOULDER.y - HIP, 0);
			const arm = part(
				shape("arm", () => new THREE.CapsuleGeometry(0.08, 0.34, 4, 10)),
				host ? SHIRT : outfit.coat,
				0.02,
			);
			arm.position.y = -0.24;
			const hand = part(
				shape("hand", () => new THREE.SphereGeometry(0.08, 10, 10)),
				outfit.skin,
				null,
			);
			hand.position.y = -ARM;
			pivot.add(arm, hand);
			this.torso.add(pivot);
			this.arms.push(pivot);
			this.hands.push(hand);
		}

		this.head.position.y = NECK - HIP;
		this.torso.add(this.head);
		const skull = part(
			shape("head", () => new THREE.SphereGeometry(0.25, 20, 16)),
			outfit.skin,
			0.025,
			true,
		);
		skull.position.y = 0.22;
		this.head.add(skull);
		// Both eyes in one mesh: one draw call, and they still blink together.
		this.eyes = part(shape("eyes", eyesGeometry), palette.ink, null);
		this.eyes.position.set(0, 0.26, 0.22);
		this.head.add(this.eyes);
		const hairStyle = outfit.hairStyle ?? "crop";
		addHair(this.head, hairStyle, outfit.hair);
		if (outfit.hat) {
			addHat(
				this.head,
				outfit.hatStyle ?? "felt",
				toneFor(FELT, outfit.coat, outfit.hair),
			);
		}
		const top = outfit.hat
			? 2.0
			: hairStyle === "bun" || hairStyle === "curly"
				? 1.95
				: 1.87;
		this.bubbleHeight = top + 0.5;

		if (host) {
			this.dressHost(outfit);
		} else if (outfit.longCoat || recruiter) {
			// The skirt of the coat hangs from the body, not the torso: it stays put in a bow.
			this.skirt = part(
				shape("skirt", () => new THREE.CylinderGeometry(0.29, 0.34, 0.46, 18)),
				outfit.coat,
				0.025,
				true,
			);
			this.skirt.position.y = 0.53;
			this.body.add(this.skirt);
		}
		if (outfit.accent !== undefined) {
			const scarf = part(
				shape("scarf", () => new THREE.TorusGeometry(0.2, 0.065, 8, 20)),
				outfit.accent,
				0.02,
			);
			scarf.rotation.x = Math.PI / 2;
			scarf.position.y = NECK - HIP;
			this.torso.add(scarf);
			if (recruiter) {
				const tail = part(
					shape("scarf-tail", () => new THREE.BoxGeometry(0.1, 0.26, 0.04)),
					outfit.accent,
					null,
				);
				tail.position.set(0.1, 1.2 - HIP, 0.275);
				tail.rotation.set(-0.12, 0, 0.12);
				this.torso.add(tail);
			}
		}

		// The left hand carries the bag or the umbrella; the right one stays free for a phone.
		this.carrying = Boolean(outfit.bag || outfit.umbrella);
		if (outfit.bag) {
			const group = this.hold(1, 0.85);
			const leather = toneFor(LEATHER, outfit.trousers, outfit.skin);
			if (recruiter) {
				const satchel = part(
					shape("satchel", () => new THREE.BoxGeometry(0.1, 0.26, 0.34)),
					leather,
					0.02,
					true,
				);
				satchel.position.y = -0.2;
				group.add(satchel);
			} else {
				const bag = part(
					shape("handbag", () => new THREE.BoxGeometry(0.09, 0.2, 0.24)),
					leather,
					0.018,
					true,
				);
				bag.position.y = -0.16;
				const handle = part(
					shape("handle", () => {
						const arc = new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI);
						arc.rotateY(Math.PI / 2);
						return arc;
					}),
					leather,
					null,
				);
				handle.position.y = -0.06;
				group.add(bag, handle);
			}
		} else if (outfit.umbrella) {
			const group = this.hold(1, 0.8);
			const umbrella = part(
				shape("umbrella", () => {
					const cone = new THREE.ConeGeometry(0.075, 0.72, 8);
					cone.rotateX(Math.PI);
					return cone;
				}),
				toneFor(UMBRELLAS, outfit.coat, outfit.skin),
				0.015,
				true,
			);
			umbrella.position.y = -0.32;
			group.add(umbrella);
		}
	}

	/** Waistcoat over a white shirt, bow tie, long café apron, and a cloth over the arm. */
	private dressHost(outfit: Outfit) {
		const waistcoat = capOutline(
			new THREE.Mesh(
				shape(
					"waistcoat",
					() =>
						new THREE.CylinderGeometry(
							0.305,
							0.315,
							0.52,
							20,
							1,
							true,
							0.35,
							Math.PI * 2 - 0.7,
						),
				),
				paint(outfit.coat, true),
			),
			0.315,
			0.02,
		);
		waistcoat.position.y = 0.98 - HIP;
		this.torso.add(waistcoat);
		const bow = part(shape("bow-tie", bowTieGeometry), palette.ink, null);
		bow.position.set(0, 1.37 - HIP, 0.2);
		this.torso.add(bow);
		const apron = capOutline(
			new THREE.Mesh(
				shape(
					"apron",
					() =>
						new THREE.CylinderGeometry(
							0.315,
							0.39,
							0.86,
							20,
							1,
							true,
							-1.95,
							3.9,
						),
				),
				paint(SHIRT, true),
			),
			0.39,
			0.02,
		);
		apron.castShadow = true;
		apron.position.y = 0.52;
		this.body.add(apron);
		const moustache = part(
			shape("moustache", () => {
				const bar = new THREE.CapsuleGeometry(0.028, 0.1, 3, 6);
				bar.rotateZ(Math.PI / 2);
				return bar;
			}),
			outfit.hair,
			null,
		);
		moustache.position.set(0, 0.15, 0.245);
		this.head.add(moustache);
		const napkin = part(
			shape("napkin", () => new THREE.BoxGeometry(0.035, 0.3, 0.15)),
			SHIRT,
			0.012,
		);
		napkin.position.set(0.095, -0.3, 0.02);
		this.arms[1].add(napkin);
	}

	/** A group at the centre of a hand, for something held. */
	private hold(arm: number, upright: number): THREE.Group {
		const group = new THREE.Group();
		group.position.y = -ARM;
		this.arms[arm].add(group);
		this.held.push({ group, arm: this.arms[arm], upright });
		return group;
	}

	faceTowards(point: THREE.Vector3) {
		const dx = point.x - this.root.position.x;
		const dz = point.z - this.root.position.z;
		if (Math.abs(dx) + Math.abs(dz) < 1e-3) return;
		this.turnTo = Math.atan2(dx, dz);
	}

	/** Walks through waypoints at a steady pace, like Cook.walk. Resolves on arrival. */
	walk(points: THREE.Vector3[], speed = 2): gsap.core.Timeline {
		const tl = gsap.timeline({
			onStart: () => {
				this.pace = speed;
			},
			onComplete: () => {
				this.pace = 0;
			},
		});
		let from = this.root.position.clone();
		for (const point of points) {
			const distance = Math.hypot(point.x - from.x, point.z - from.z);
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

	/**
	 * Moves the legs as if walking at this speed, without moving the root: for callers
	 * that move the person themselves, like the crowd. 0 stands still.
	 */
	setPace(speed: number) {
		this.pace = Math.max(0, speed);
	}

	/** Waves hello for a few seconds, with the free hand. */
	wave(seconds = 1.8) {
		this.waving = seconds;
		this.waveArm = this.phoning || this.cup?.visible ? 1 : 0;
	}

	/** The maître d's greeting: a small bow, one hand on the stomach, the other behind the back. */
	bow(): gsap.core.Timeline {
		const [right, left] = this.arms;
		return gsap
			.timeline({
				onStart: () => {
					this.posing = true;
				},
				onComplete: () => {
					this.posing = false;
				},
			})
			.to(
				right.rotation,
				{ x: POSES.belly.x, y: 0, z: POSES.belly.z, duration: 0.3 },
				0,
			)
			.to(
				left.rotation,
				{ x: POSES.back.x, y: 0, z: -POSES.back.z, duration: 0.3 },
				0,
			)
			.to(
				this.torso.rotation,
				{ x: 0.42, duration: 0.4, ease: "power2.out" },
				0.1,
			)
			.to(this.head.rotation, { x: 0.15, y: 0, duration: 0.3 }, 0.15)
			.to(
				this.torso.rotation,
				{ x: 0, duration: 0.45, ease: "power2.inOut" },
				0.95,
			)
			.to(this.head.rotation, { x: 0, duration: 0.4 }, 0.95);
	}

	/** Holds an arm out towards a point, palm open (« par ici »), for a few seconds. */
	gesture(towards: THREE.Vector3, seconds = 1.6) {
		this.gestureTarget.copy(towards);
		this.gesturing = seconds;
		// Pick the arm on the target's side, as the person will stand once turned.
		const local = this.toLocal(towards, this.turnTo ?? this.root.rotation.y);
		this.gestureArm = local.x >= 0 ? 1 : 0;
	}

	/** Seated posture (café terrace). The caller places the root SEAT_HEIGHT below the top of the seat. */
	sit(on: boolean) {
		this.sitting = on;
		if (on) this.pace = 0;
		if (this.skirt) this.skirt.visible = !on;
	}

	/** Holds a lit phone in the right hand, head bent over it. */
	holdPhone(on: boolean) {
		this.phoning = on;
		if (on && !this.phone) {
			this.phone = this.hold(0, 1);
			const dark = paint(palette.ink);
			const phone = new THREE.Mesh(
				shape("phone", () => new THREE.BoxGeometry(0.1, 0.18, 0.02)),
				// The screen is the back face (-z): it looks at the face, not at the street.
				[dark, dark, dark, dark, dark, screen],
			);
			phone.position.set(0, 0.07, 0.03);
			phone.rotation.x = 0.6;
			this.phone.add(phone);
		}
		if (this.phone) this.phone.visible = on;
	}

	/** Holds a coffee cup in the right hand (café terrace). */
	holdCup(on: boolean) {
		if (on && !this.cup) {
			this.cup = this.hold(0, 1);
			const cup = part(
				shape("cup", () => new THREE.CylinderGeometry(0.055, 0.045, 0.09, 12)),
				SHIRT,
				0.012,
			);
			cup.position.set(0.02, 0.02, 0.06);
			this.cup.add(cup);
		}
		if (this.cup) this.cup.visible = on;
		if (!on) this.sipping = 0;
	}

	/** Brings the cup to the lips, once. */
	sip() {
		if (this.cup?.visible && this.sipping <= 0) this.sipping = SIP_TIME;
	}

	/** Two small nods, as in a conversation. */
	nod() {
		if (this.nodding <= 0) this.nodding = NOD_TIME;
	}

	/** Turns the head towards a point, or back to the front with null. */
	glance(point: THREE.Vector3 | null) {
		this.glancing = point ? point.clone() : null;
	}

	update(delta: number) {
		const dt = Math.min(delta, 0.1);
		const walking = this.pace > 0.05 && !this.sitting;
		this.phase += dt * (walking ? this.pace * CADENCE : 2.2);
		const ease = 1 - Math.exp(-dt * 12);
		const quick = 1 - Math.exp(-dt * 25);

		// Blink every few seconds: the smallest sign of life.
		this.nextBlink -= dt;
		this.eyes.scale.y = this.nextBlink < 0.12 ? 0.15 : 1;
		if (this.nextBlink < 0) this.nextBlink = 2 + this.random() * 4;

		if (this.turnTo !== null) {
			const r = this.root.rotation;
			const d = Math.atan2(
				Math.sin(this.turnTo - r.y),
				Math.cos(this.turnTo - r.y),
			);
			if (Math.abs(d) < 0.01) {
				r.y = this.turnTo;
				this.turnTo = null;
			} else r.y += d * (1 - Math.exp(-dt * 14));
		}

		if (walking) {
			const swing =
				Math.sin(this.phase) * Math.min(0.62, 0.3 + this.pace * 0.14);
			this.legs[0].rotation.x = swing;
			this.legs[1].rotation.x = -swing;
			this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.05;
			this.body.scale.y = 1;
		} else {
			const rest = this.sitting ? SIT_LEGS : 0;
			for (const leg of this.legs)
				leg.rotation.x += (rest - leg.rotation.x) * ease;
			this.body.position.y *= 1 - ease;
			this.body.scale.y = 1 + Math.sin(this.phase) * 0.01;
		}

		const sip = this.sipEnvelope(dt);
		if (!this.posing) {
			const lean = this.sitting ? 0.08 : 0;
			this.torso.rotation.x += (lean - this.torso.rotation.x) * ease;
			const swing = walking
				? Math.sin(this.phase) * Math.min(0.5, 0.2 + this.pace * 0.12)
				: 0;
			for (let i = 0; i < 2; i++) {
				const target = this.armTarget(i, walking, swing, sip);
				const k = target.quick ? quick : ease;
				const r = this.arms[i].rotation;
				r.x += (target.x - r.x) * k;
				r.y += (0 - r.y) * k;
				r.z += (target.z - r.z) * k;
			}
			let pitch = this.phoning ? 0.3 : 0;
			pitch -= 0.15 * sip;
			if (this.nodding > 0) {
				const t = 1 - this.nodding / NOD_TIME;
				pitch += 0.16 * Math.max(0, Math.sin(t * Math.PI * 4));
			}
			const look =
				this.glancing ?? (this.gesturing > 0 ? this.gestureTarget : null);
			let yaw = 0;
			if (look) {
				const local = this.toLocal(look, this.root.rotation.y);
				yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
			}
			this.head.rotation.x += (pitch - this.head.rotation.x) * quick;
			this.head.rotation.y += (yaw - this.head.rotation.y) * ease;
		}

		// An open palm while showing the way.
		for (const [i, hand] of this.hands.entries()) {
			const open = this.gesturing > 0 && this.gestureArm === i ? 1 : 0;
			hand.scale.x += (1 + 0.1 * open - hand.scale.x) * ease;
			hand.scale.y += (1 + 0.25 * open - hand.scale.y) * ease;
			hand.scale.z += (1 - 0.45 * open - hand.scale.z) * ease;
		}

		// Held things hang straight, whatever the arm does; the cup tips towards the lips.
		for (const held of this.held) {
			scratch.quaternion.copy(held.arm.quaternion).invert();
			held.group.quaternion
				.copy(scratch.identity)
				.slerp(scratch.quaternion, held.upright);
			if (held.group === this.cup && sip > 0) {
				scratch.tilt.setFromEuler(scratch.euler.set(-0.7 * sip, 0, 0));
				held.group.quaternion.multiply(scratch.tilt);
			}
		}

		this.waving = Math.max(0, this.waving - dt);
		this.gesturing = Math.max(0, this.gesturing - dt);
		this.nodding = Math.max(0, this.nodding - dt);
	}

	/** 0 at rest, 1 with the cup at the lips. */
	private sipEnvelope(dt: number): number {
		if (this.sipping <= 0) return 0;
		this.sipping = Math.max(0, this.sipping - dt);
		const t = SIP_TIME - this.sipping;
		const rise = THREE.MathUtils.smoothstep(t, 0, 0.45);
		const fall = 1 - THREE.MathUtils.smoothstep(t, SIP_TIME - 0.5, SIP_TIME);
		return Math.min(rise, fall);
	}

	/** Where each arm should be, by priority: showing the way, waving, the phone, the cup… */
	private armTarget(
		i: number,
		walking: boolean,
		swing: number,
		sip: number,
	): { x: number; z: number; quick: boolean } {
		const mirror = i === 1 ? -1 : 1;
		const pose = (p: Pose, quick = false) => ({
			x: p.x,
			z: p.z * mirror,
			quick,
		});
		if (this.gesturing > 0 && this.gestureArm === i)
			return { ...this.gesturePose(i), quick: false };
		if (this.waving > 0 && this.waveArm === i)
			return {
				x: 0,
				z: -mirror * (2.5 - Math.sin(this.phase * 4) * 0.35),
				quick: true,
			};
		if (i === 0 && this.phoning) return pose(POSES.phone);
		if (i === 0 && this.cup?.visible) {
			const from = this.sitting ? POSES.seatedCup : POSES.cup;
			return pose({
				x: THREE.MathUtils.lerp(from.x, POSES.sip.x, sip),
				z: THREE.MathUtils.lerp(from.z, POSES.sip.z, sip),
			});
		}
		if (this.sitting) return pose(POSES.lap);
		const hanging = this.carrying && i === 1 ? POSES.carry : POSES.rest;
		if (walking)
			return { x: -swing * mirror, z: hanging.z * mirror, quick: true };
		if (this.look === "host" && i === 1) return pose(POSES.napkin);
		return pose(hanging);
	}

	/** The arm pointing at the gesture target, a little below the horizontal. */
	private gesturePose(i: number): { x: number; z: number } {
		const side = i === 1 ? 1 : -1;
		const local = this.toLocal(this.gestureTarget, this.root.rotation.y);
		const lx = local.x - side * SHOULDER.x;
		// Never behind the back: a target back there is shown sideways.
		const lz = Math.max(local.z, 0.25 * Math.hypot(lx, local.z));
		const flat = Math.hypot(lx, lz) || 1;
		const drop = 0.3;
		const dx = (lx / flat) * Math.cos(drop);
		const dy = -Math.sin(drop);
		const dz = (lz / flat) * Math.cos(drop);
		// Euler XYZ with y = 0 turns the hanging arm (0, -1, 0) into (dx, dy, dz).
		return { x: Math.atan2(-dz, -dy), z: Math.asin(dx) };
	}

	/** A point of the parent's space, seen from the person's feet with this heading. */
	private toLocal(point: THREE.Vector3, heading: number) {
		const wx = point.x - this.root.position.x;
		const wz = point.z - this.root.position.z;
		const c = Math.cos(heading);
		const s = Math.sin(heading);
		return { x: wx * c - wz * s, z: wx * s + wz * c };
	}
}

function eyesGeometry(): THREE.BufferGeometry {
	const eyes = [-1, 1].map((side) =>
		new THREE.SphereGeometry(0.035, 8, 8).translate(side * 0.09, 0, 0),
	);
	return mergeGeometries(eyes) ?? eyes[0];
}

function bowTieGeometry(): THREE.BufferGeometry {
	const wings = [-1, 1].map((side) =>
		new THREE.ConeGeometry(0.05, 0.09, 4)
			.rotateZ(side * (Math.PI / 2))
			.translate(-side * 0.045, 0, 0),
	);
	const knot = new THREE.SphereGeometry(0.025, 8, 6);
	return mergeGeometries([...wings, knot]) ?? knot;
}

/** Hair as caps and simple volumes, in the head group (the skull's centre is at y 0.22). */
function addHair(head: THREE.Group, style: HairStyle, color: number) {
	if (style === "bald") return;
	if (style === "curly") {
		const volume = capOutline(
			new THREE.Mesh(
				shape(
					"hair-curly",
					() => new THREE.SphereGeometry(0.32, 18, 10, 0, Math.PI * 2, 0, 1.8),
				),
				paint(color),
			),
			0.32,
		);
		volume.position.set(0, 0.24, -0.03);
		volume.rotation.x = -0.4;
		head.add(volume);
		return;
	}
	// A cap tipped backwards: the forehead stays clear, the back of the head is covered.
	const cap = capOutline(
		new THREE.Mesh(
			shape(
				"hair-cap",
				() => new THREE.SphereGeometry(0.275, 18, 8, 0, Math.PI * 2, 0, 1.2),
			),
			paint(color),
		),
		0.275,
	);
	cap.position.y = 0.22;
	cap.rotation.x = -0.35;
	head.add(cap);
	if (style === "long") {
		const fall = part(
			shape("hair-long", () =>
				new THREE.CapsuleGeometry(0.17, 0.26, 4, 12).scale(1, 1, 0.5),
			),
			color,
			0.02,
		);
		fall.position.set(0, 0.1, -0.13);
		head.add(fall);
	} else if (style === "bun") {
		const bun = part(
			shape("hair-bun", () => new THREE.SphereGeometry(0.1, 12, 10)),
			color,
			0.018,
		);
		bun.position.set(0, 0.44, -0.1);
		head.add(bun);
	} else if (style === "ponytail") {
		const tail = part(
			shape("hair-tail", () => new THREE.CapsuleGeometry(0.055, 0.16, 4, 8)),
			color,
			0.015,
		);
		tail.position.set(0, 0.16, -0.29);
		tail.rotation.x = 0.5;
		head.add(tail);
	}
}

function addHat(head: THREE.Group, style: HatStyle, color: number) {
	if (style === "beret") {
		const beret = part(
			shape("hat-beret", () =>
				new THREE.SphereGeometry(0.27, 16, 10).scale(1, 0.36, 1),
			),
			color,
			0.018,
			true,
		);
		beret.position.set(0.03, 0.44, -0.02);
		beret.rotation.z = 0.22;
		head.add(beret);
		return;
	}
	// A felt hat turned on a lathe: brim and crown in one mesh.
	const felt = part(
		shape("hat-felt", () => {
			const profile = [
				[0, 0.01],
				[0.2, 0.01],
				[0.34, 0],
				[0.36, 0.015],
				[0.34, 0.03],
				[0.21, 0.04],
				[0.2, 0.19],
				[0.17, 0.22],
				[0, 0.22],
			].map(([x, y]) => new THREE.Vector2(x, y));
			const lathe = new THREE.LatheGeometry(profile, 18);
			lathe.center();
			return lathe;
		}),
		color,
		0.02,
		true,
	);
	felt.position.y = 0.52;
	felt.rotation.x = -0.08;
	head.add(felt);
}
