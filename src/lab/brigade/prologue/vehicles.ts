import gsap from "gsap";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { outline, palette, toon } from "../toon";

/**
 * Cars of the street, drawn in code like everything else: a city car, a saloon and a
 * small delivery van, plus the taxi. The root sits on the road surface, the front
 * points to +x, and the pavement side is -z. Lights are unlit materials: no car
 * carries a real light, which keeps the street cheap on an integrated GPU.
 */

export type CarShape = "city" | "sedan" | "van";

export interface CarOptions {
	body: number;
	/** Roof panel colour; a darker shade of the body when omitted. */
	roof?: number;
	/** Adds the lit roof sign. */
	taxi?: boolean;
	/** Bumper to bumper. Each shape has its own default. */
	length?: number;
	/** The silhouette; a saloon when omitted. */
	shape?: CarShape;
}

export interface Car {
	root: THREE.Group;
	wheels: THREE.Mesh[];
	/** Moves the car along the road and turns its wheels to match. */
	setX(x: number): void;
	/** Opens or closes the rear door on the pavement side (-z when the car drives towards +x). */
	rearDoor(open: boolean): gsap.core.Tween;
	/** Ground point on the pavement side where a passenger appears, in root coordinates. */
	readonly exitPoint: THREE.Vector3;
	/** Bumper to bumper, also kept in root.userData.length. */
	readonly length: number;
}

const WIDTH = 1.3;
const CABIN_WIDTH = 1.2;
const WHEEL = 0.24;
const SILL = 0.3;
/** How far the rear door swings open: wide, so a passenger clears it. */
const DOOR_OPEN = 1.45;
const colors = {
	glass: 0x2a4a63,
	headlight: 0xfff2c0,
	// Tail lights are lighting, not a check: a dark red is fine here.
	tail: 0x7c1d16,
};

interface Profile {
	length: number;
	/** Top of the lower body. */
	waist: number;
	cabinFrom: number;
	cabinTo: number;
	/** Top of the cabin. */
	top: number;
	/** A saloon or city car has windows all round; a van only at the front. */
	van: boolean;
	wheelInset: number;
}

function profileOf(shape: CarShape, length?: number): Profile {
	if (shape === "city") {
		const l = length ?? 2.4;
		return {
			length: l,
			waist: 0.76,
			cabinFrom: -l / 2 + 0.12,
			cabinTo: l / 2 - 0.7,
			top: 1.28,
			van: false,
			wheelInset: 0.45,
		};
	}
	if (shape === "van") {
		const l = length ?? 3.1;
		return {
			length: l,
			waist: 0.82,
			cabinFrom: -l / 2,
			cabinTo: l / 2 - 0.8,
			top: 1.72,
			van: true,
			wheelInset: 0.55,
		};
	}
	const l = length ?? 2.8;
	return {
		length: l,
		waist: 0.79,
		cabinFrom: -0.346 * l,
		cabinTo: 0.23 * l,
		top: 1.31,
		van: false,
		wheelInset: 0.45,
	};
}

// Shared resources: one material per colour, one geometry per size.
const toons = new Map<number, THREE.MeshToonMaterial>();
const paint = (color: number) => {
	let material = toons.get(color);
	if (!material) {
		material = toon(color);
		toons.set(color, material);
	}
	return material;
};
const unlit = new Map<number, THREE.MeshBasicMaterial>();
const glow = (color: number) => {
	let material = unlit.get(color);
	if (!material) {
		material = new THREE.MeshBasicMaterial({ color });
		unlit.set(color, material);
	}
	return material;
};
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
const box = (w: number, h: number, d: number) =>
	shape(
		`box ${w.toFixed(3)} ${h.toFixed(3)} ${d.toFixed(3)}`,
		() => new THREE.BoxGeometry(w, h, d),
	);
/** The headlight beam fades along the road: its alpha lives in the vertex colours. */
const beamMaterial = new THREE.MeshBasicMaterial({
	vertexColors: true,
	transparent: true,
	depthWrite: false,
	side: THREE.DoubleSide,
});

/** A toon box with its outline; its base sits at y. */
function slab(
	w: number,
	h: number,
	d: number,
	color: number,
	x: number,
	y: number,
	z = 0,
	thickness: number | null = 0.025,
): THREE.Mesh {
	const mesh = new THREE.Mesh(box(w, h, d), paint(color));
	mesh.position.set(x, y + h / 2, z);
	if (thickness !== null) outline(mesh, thickness);
	return mesh;
}

/** Flat panes merged into one mesh: glass or lights cost one draw call per car. */
function panes(
	key: string,
	list: {
		w: number;
		h: number;
		at: [number, number, number];
		facing: "+x" | "-x" | "+z" | "-z";
		round?: boolean;
	}[],
): THREE.BufferGeometry {
	return shape(key, () => {
		const turn = {
			"+z": 0,
			"-z": Math.PI,
			"+x": Math.PI / 2,
			"-x": -Math.PI / 2,
		};
		const parts = list.map(({ w, h, at, facing, round }) => {
			const g = round
				? new THREE.CircleGeometry(w / 2, 12)
				: new THREE.PlaneGeometry(w, h);
			g.rotateY(turn[facing]);
			g.translate(...at);
			return g;
		});
		return mergeGeometries(parts) ?? parts[0];
	});
}

function darker(color: number, factor: number): number {
	return new THREE.Color(color).multiplyScalar(factor).getHex();
}

export function buildCar(options: CarOptions): Car {
	const shapeName = options.shape ?? "sedan";
	const p = profileOf(
		shapeName,
		options.length ?? (options.taxi && !options.shape ? 2.6 : undefined),
	);
	const { length: l, waist, cabinFrom, cabinTo, top } = p;
	const key = `${shapeName} ${l.toFixed(2)}`;
	const cabinLength = cabinTo - cabinFrom;
	const cabinMid = (cabinFrom + cabinTo) / 2;
	const body = options.body;
	const root = new THREE.Group();
	root.userData.length = l;

	const lower = slab(l, waist - 0.24, WIDTH, body, 0, 0.24, 0, 0.03);
	lower.castShadow = true;
	const cabin = slab(
		cabinLength,
		top - waist,
		CABIN_WIDTH,
		body,
		cabinMid,
		waist,
	);
	cabin.castShadow = true;
	root.add(
		lower,
		cabin,
		// Sill and bumpers in one dark band; the roof panel on top.
		slab(l + 0.1, 0.1, WIDTH + 0.04, palette.ink, 0, 0.22, 0, null),
		slab(
			cabinLength + 0.06,
			0.06,
			CABIN_WIDTH + 0.04,
			options.roof ?? darker(body, 0.82),
			cabinMid,
			top,
			0,
			null,
		),
	);

	// The rear door on the pavement side: a real hinge on its front edge.
	const doorLength = p.van ? 0.75 : Math.min(0.75, cabinLength / 2);
	// A van's side door opens just behind the driver's window.
	const hinge = p.van ? cabinTo - 0.65 : cabinMid;
	const windowLow = waist + 0.08;
	const windowHigh = top - 0.08;
	const windowHeight = windowHigh - windowLow;
	const windowMid = (windowLow + windowHigh) / 2;
	const side = CABIN_WIDTH / 2 + 0.005;

	const glass: Parameters<typeof panes>[1] = [
		{
			w: CABIN_WIDTH - 0.12,
			h: windowHeight,
			at: [cabinTo + 0.005, windowMid, 0],
			facing: "+x",
		},
	];
	if (p.van) {
		for (const z of [side, -side]) {
			glass.push({
				w: 0.5,
				h: windowHeight * 0.6,
				at: [cabinTo - 0.35, windowHigh - windowHeight * 0.3, z],
				facing: z > 0 ? "+z" : "-z",
			});
		}
	} else {
		const paneWidth = cabinLength / 2 - 0.14;
		const front = cabinMid + cabinLength / 4;
		const back = cabinMid - cabinLength / 4;
		glass.push(
			{
				w: paneWidth,
				h: windowHeight,
				at: [front, windowMid, side],
				facing: "+z",
			},
			{
				w: paneWidth,
				h: windowHeight,
				at: [back, windowMid, side],
				facing: "+z",
			},
			{
				w: paneWidth,
				h: windowHeight,
				at: [front, windowMid, -side],
				facing: "-z",
			},
			{
				w: CABIN_WIDTH - 0.12,
				h: windowHeight,
				at: [cabinFrom - 0.005, windowMid, 0],
				facing: "-x",
			},
		);
	}
	root.add(new THREE.Mesh(panes(`glass ${key}`, glass), glow(colors.glass)));

	const lamp = waist - 0.24;
	root.add(
		new THREE.Mesh(
			panes(
				`headlights ${key}`,
				[-0.42, 0.42].map((z) => ({
					w: 0.2,
					h: 0.2,
					at: [l / 2 + 0.006, lamp, z] as [number, number, number],
					facing: "+x" as const,
					round: true,
				})),
			),
			glow(colors.headlight),
		),
		new THREE.Mesh(
			panes(
				`tail ${key}`,
				[-0.46, 0.46].map((z) => ({
					w: 0.18,
					h: 0.11,
					at: [-l / 2 - 0.006, waist - 0.14, z] as [number, number, number],
					facing: "-x" as const,
				})),
			),
			glow(colors.tail),
		),
		new THREE.Mesh(
			shape(`beam ${key}`, () => beamGeometry(l)),
			beamMaterial,
		),
	);

	// The dark inside of the car, only seen when the door is open.
	const openingTop = p.van ? top - 0.06 : windowHigh;
	root.add(
		new THREE.Mesh(
			panes(`inside ${key}`, [
				{
					w: doorLength,
					h: waist - SILL,
					at: [hinge - doorLength / 2, (SILL + waist) / 2, -WIDTH / 2 - 0.002],
					facing: "-z",
				},
				{
					w: doorLength - 0.08,
					h: openingTop - waist,
					at: [
						hinge - doorLength / 2,
						(waist + openingTop) / 2,
						-CABIN_WIDTH / 2 - 0.002,
					],
					facing: "-z",
				},
			]),
			glow(palette.ink),
		),
	);

	const door = new THREE.Group();
	door.position.set(hinge, 0, -WIDTH / 2);
	if (p.van) {
		// A van's side door is one panel up to the roof, without a window.
		door.add(
			slab(
				doorLength,
				top - 0.06 - SILL,
				0.05,
				body,
				-doorLength / 2,
				SILL,
				-0.028,
				0.015,
			),
		);
	} else {
		door.add(
			slab(
				doorLength,
				waist - SILL,
				0.05,
				body,
				-doorLength / 2,
				SILL,
				-0.028,
				0.015,
			),
		);
		const pane = new THREE.Mesh(
			panes(`door-glass ${key}`, [
				{
					w: doorLength - 0.14,
					h: windowHeight,
					at: [-doorLength / 2, windowMid, WIDTH / 2 - side],
					facing: "-z",
				},
			]),
			glow(colors.glass),
		);
		door.add(pane);
	}
	root.add(door);

	if (options.taxi) {
		const sign = new THREE.Mesh(box(0.46, 0.16, 0.24), glow(palette.lamp));
		sign.position.set(cabinMid, top + 0.06 + 0.08, 0);
		root.add(outline(sign, 0.02));
	}

	const wheels: THREE.Mesh[] = [];
	const tyre = shape(
		"wheel",
		() => new THREE.CylinderGeometry(WHEEL, WHEEL, 0.2, 14),
	);
	const hubShape = box(0.3, 0.06, 0.22);
	for (const x of [-(l / 2 - p.wheelInset), l / 2 - p.wheelInset]) {
		for (const z of [-0.62, 0.62]) {
			const wheel = new THREE.Mesh(tyre, paint(palette.ink));
			wheel.rotation.x = Math.PI / 2;
			wheel.position.set(x, WHEEL, z);
			wheel.add(new THREE.Mesh(hubShape, paint(palette.steel)));
			wheel.castShadow = true;
			root.add(wheel);
			wheels.push(wheel);
		}
	}

	return {
		root,
		wheels,
		length: l,
		// Behind the open door, clear of it, a step away from the car.
		exitPoint: new THREE.Vector3(
			Math.max(hinge - 0.6, cabinFrom - 0.1),
			0,
			-(WIDTH / 2 + 0.35),
		),
		setX: (x: number) => {
			// Distance travelled forwards, whichever way the car is turned.
			const travel = (x - root.position.x) * Math.cos(root.rotation.y);
			root.position.x = x;
			for (const wheel of wheels) wheel.rotation.y -= travel / WHEEL;
		},
		rearDoor: (open: boolean) =>
			gsap.to(door.rotation, {
				y: open ? -DOOR_OPEN : 0,
				duration: open ? 0.5 : 0.4,
				ease: open ? "back.out(1.4)" : "power2.in",
			}),
	};
}

/** A pool of warm light on the road ahead, fading out. */
function beamGeometry(length: number): THREE.BufferGeometry {
	const near = length / 2 + 0.05;
	const far = near + 4;
	const y = 0.02;
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(
			[near, y, -0.45, near, y, 0.45, far, y, -0.95, far, y, 0.95],
			3,
		),
	);
	const [r, g, b] = new THREE.Color(colors.headlight).toArray();
	geometry.setAttribute(
		"color",
		new THREE.Float32BufferAttribute(
			[r, g, b, 0.3, r, g, b, 0.3, r, g, b, 0, r, g, b, 0],
			4,
		),
	);
	geometry.setIndex([0, 2, 1, 1, 2, 3]);
	return geometry;
}
