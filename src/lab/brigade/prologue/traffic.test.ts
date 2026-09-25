import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { palette } from "../toon";
import {
	MESH_BUDGET,
	meshCount,
	type Outfit,
	Person,
	passerbyOutfit,
	SEAT_HEIGHT,
} from "./people";
import { Crowd, seatPatrons, Traffic } from "./traffic";
import { buildCar } from "./vehicles";

const STEP = 1 / 30;

function meshes(object: THREE.Object3D): THREE.Mesh[] {
	const found: THREE.Mesh[] = [];
	object.traverse((o) => {
		if (o instanceof THREE.Mesh) found.push(o);
	});
	return found;
}

/** Distance in sRGB space, 0 to about 441. */
function distance(a: number, b: number): number {
	const channel = (c: number, shift: number) => (c >> shift) & 0xff;
	return Math.hypot(
		channel(a, 16) - channel(b, 16),
		channel(a, 8) - channel(b, 8),
		channel(a, 0) - channel(b, 0),
	);
}

/** What a passer-by wears. Skin is left out: it comes from palette.skins, not a wardrobe. */
function outfitColors(outfit: Outfit): number[] {
	return [
		outfit.coat,
		outfit.trousers,
		outfit.hair,
		...(outfit.accent === undefined ? [] : [outfit.accent]),
	];
}

const RESERVED = [palette.check, palette.model];

describe("passerbyOutfit", () => {
	it("is deterministic", () => {
		for (const seed of [0, 1, 7, 42, 123456]) {
			expect(passerbyOutfit(seed)).toEqual(passerbyOutfit(seed));
		}
	});

	it("varies from one seed to the next", () => {
		const outfits = Array.from({ length: 300 }, (_, seed) =>
			passerbyOutfit(seed),
		);
		expect(new Set(outfits.map((o) => JSON.stringify(o))).size).toBeGreaterThan(
			280,
		);
		expect(new Set(outfits.map((o) => o.skin))).toEqual(new Set(palette.skins));
		expect(new Set(outfits.map((o) => o.hairStyle)).size).toBe(6);
		expect(new Set(outfits.map((o) => o.hatStyle)).size).toBe(3);
		for (const flag of ["hat", "bag", "umbrella", "longCoat"] as const) {
			expect(outfits.some((o) => o[flag])).toBe(true);
			expect(outfits.some((o) => !o[flag])).toBe(true);
		}
		expect(outfits.some((o) => o.accent !== undefined)).toBe(true);
		expect(outfits.every((o) => o.look === "passerby")).toBe(true);
		expect(outfits.some((o) => o.bag && o.umbrella)).toBe(false);
	});

	it("never dresses anyone in the reserved red or blue", () => {
		for (let seed = 0; seed < 500; seed++) {
			for (const color of outfitColors(passerbyOutfit(seed))) {
				for (const reserved of RESERVED) {
					expect(color).not.toBe(reserved);
					expect(distance(color, reserved)).toBeGreaterThan(70);
				}
			}
		}
	});

	it("keeps derived colours (hat, bag, umbrella) away from them too", () => {
		for (let seed = 0; seed < 120; seed++) {
			const outfit = passerbyOutfit(seed);
			for (const mesh of meshes(new Person(outfit, seed).root)) {
				const list = Array.isArray(mesh.material)
					? mesh.material
					: [mesh.material];
				for (const material of list) {
					const color = (material as THREE.MeshBasicMaterial).color?.getHex();
					if (color === undefined || color === outfit.skin) continue;
					for (const reserved of RESERVED)
						expect(distance(color, reserved)).toBeGreaterThan(60);
				}
			}
		}
	});
});

describe("Person", () => {
	const host: Outfit = {
		look: "host",
		coat: palette.ink,
		trousers: palette.ink,
		skin: palette.skins[3],
		hair: palette.ink,
	};
	const recruiter: Outfit = {
		look: "recruiter",
		coat: 0xb07a4f,
		trousers: 0x3a3f3c,
		skin: palette.skins[1],
		hair: 0x2b2118,
		accent: 0xefe3c4,
		bag: true,
	};

	it("is built with as many meshes as meshCount says", () => {
		const outfits = [
			host,
			recruiter,
			...Array.from({ length: 200 }, (_, s) => passerbyOutfit(s)),
		];
		for (const outfit of outfits) {
			expect(meshes(new Person(outfit).root).length).toBe(meshCount(outfit));
		}
	});

	it("stays within the mesh budget", () => {
		expect(meshes(new Person(host).root).length).toBeLessThanOrEqual(
			MESH_BUDGET,
		);
		// The visitor and the passers-by may take their phone out.
		for (const outfit of [
			recruiter,
			...Array.from({ length: 300 }, (_, s) => passerbyOutfit(s)),
		]) {
			const person = new Person(outfit);
			person.holdPhone(true);
			expect(meshes(person.root).length).toBeLessThanOrEqual(MESH_BUDGET);
		}
	});

	it("is about 1.9 units tall, with the bubble above the head", () => {
		const person = new Person(recruiter);
		person.root.updateMatrixWorld(true);
		const size = new THREE.Box3()
			.setFromObject(person.root)
			.getSize(new THREE.Vector3());
		expect(size.y).toBeGreaterThan(1.8);
		expect(size.y).toBeLessThan(2.05);
		expect(person.bubbleHeight).toBeGreaterThan(size.y);
	});

	it("turns to face a point, and animates without a browser", () => {
		const person = new Person(host);
		person.faceTowards(new THREE.Vector3(5, 0, 0));
		person.gesture(new THREE.Vector3(3, 0, 3), 1);
		person.wave(1);
		person.holdPhone(true);
		for (let t = 0; t < 2; t += STEP) person.update(STEP);
		expect(person.root.rotation.y).toBeCloseTo(Math.PI / 2, 2);
	});
});

describe("Crowd", () => {
	const walkways = [
		{ z: 6.9, fromX: -32, toX: 32 },
		{ z: 7.4, fromX: -32, toX: 32 },
	];
	const keepClear = { fromX: -1.5, toX: 3.5 };

	function simulate(
		seconds: number,
		seed = 7,
		obstacles: THREE.Object3D[] = [],
	) {
		const crowd = new Crowd({ walkways, count: 12, seed, keepClear });
		crowd.avoid(obstacles);
		const people = crowd.group.children;
		const track = people.map((p) => [p.position.clone()]);
		for (let t = 0; t < seconds; t += STEP) {
			crowd.update(STEP);
			people.forEach((p, i) => {
				track[i].push(p.position.clone());
			});
		}
		return { crowd, track };
	}

	it("puts the whole crowd on the pavement", () => {
		const { crowd } = simulate(0);
		expect(crowd.group.children).toHaveLength(12);
	});

	it("keeps everyone in their lane, and loops them round", () => {
		const { track } = simulate(150);
		for (const path of track) {
			const lane = walkways.find((w) => Math.abs(w.z - path[0].z) < 1e-6);
			expect(lane).toBeDefined();
			if (!lane) continue;
			let loops = 0;
			for (const [k, p] of path.entries()) {
				expect(Math.abs(p.z - lane.z)).toBeLessThanOrEqual(0.3 + 1e-9);
				expect(p.x).toBeGreaterThanOrEqual(lane.fromX - 1e-9);
				expect(p.x).toBeLessThanOrEqual(lane.toX + 1e-9);
				if (k > 0 && Math.abs(p.x - path[k - 1].x) > 30) loops++;
			}
			expect(loops).toBeGreaterThanOrEqual(1);
		}
	});

	it("walks both ways", () => {
		const { track } = simulate(3);
		const directions = new Set(
			track.map((path) => Math.sign(path[path.length - 1].x - path[0].x)),
		);
		expect(directions).toEqual(new Set([-1, 1]));
	});

	it("never stops in front of the door", () => {
		for (const seed of [1, 7, 21]) {
			const { track } = simulate(200, seed);
			let stops = 0;
			for (const path of track) {
				for (let k = 1; k < path.length; k++) {
					const still = Math.abs(path[k].x - path[k - 1].x) < 1e-9;
					if (!still) continue;
					stops++;
					const inFront =
						path[k].x >= keepClear.fromX && path[k].x <= keepClear.toX;
					expect(inFront).toBe(false);
				}
			}
			// People do stop, elsewhere: the rule is tested, not dodged.
			expect(stops).toBeGreaterThan(0);
		}
	});

	it("goes round someone standing on the pavement", () => {
		const host = new THREE.Object3D();
		host.position.set(0.8, 0, 7.35);
		const { track } = simulate(200, 7, [host]);
		let passed = 0;
		for (const path of track) {
			for (const p of path) {
				const d = Math.hypot(p.x - host.position.x, p.z - host.position.z);
				expect(d).toBeGreaterThan(0.55);
				if (Math.abs(p.x - host.position.x) < 0.1) passed++;
			}
		}
		// People did walk past, rather than never coming near.
		expect(passed).toBeGreaterThan(10);
	});

	it("replays identically from the same seed", () => {
		const a = simulate(20).track.map((path) => path[path.length - 1]);
		const b = simulate(20).track.map((path) => path[path.length - 1]);
		expect(a).toEqual(b);
	});
});

describe("Traffic", () => {
	const lane = { z: 10.2, y: -0.15, fromX: 36, toX: -36 };

	function visibleCars(traffic: Traffic) {
		return traffic.group.children.filter((c) => c.visible);
	}

	it("never lets two cars overlap", () => {
		for (const seed of [1, 3, 9]) {
			// A short interval crowds the lane, to put the rule under pressure.
			const traffic = new Traffic({ lane, interval: [0.5, 2], seed });
			for (let t = 0; t < 400; t += STEP) {
				traffic.update(STEP);
				const cars = visibleCars(traffic).sort(
					(a, b) => a.position.x - b.position.x,
				);
				for (let i = 1; i < cars.length; i++) {
					const gap =
						cars[i].position.x -
						cars[i - 1].position.x -
						(cars[i].userData.length + cars[i - 1].userData.length) / 2;
					expect(gap).toBeGreaterThan(0);
				}
			}
		}
	});

	it("drives along the lane, towards toX", () => {
		const traffic = new Traffic({ lane, interval: [4, 9], seed: 3 });
		const car = visibleCars(traffic)[0];
		expect(car).toBeDefined();
		const before = car.position.x;
		traffic.update(0.1);
		expect(car.position.x).toBeLessThan(before);
		expect(car.position.z).toBe(lane.z);
		expect(car.position.y).toBe(lane.y);
	});

	it("sets off at irregular intervals, within the range asked", () => {
		const traffic = new Traffic({ lane, interval: [4, 9], seed: 3 });
		const starts: number[] = [];
		let seen = new Set(visibleCars(traffic));
		for (let t = 0; t < 200; t += STEP) {
			traffic.update(STEP);
			const now = new Set(visibleCars(traffic));
			for (const car of now) if (!seen.has(car)) starts.push(t);
			seen = now;
		}
		const gaps = starts.slice(1).map((t, i) => t - starts[i]);
		expect(gaps.length).toBeGreaterThan(15);
		for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(4 - STEP);
		expect(new Set(gaps.map((g) => g.toFixed(1))).size).toBeGreaterThan(5);
	});

	it("holds new departures while paused", () => {
		const traffic = new Traffic({ lane, interval: [4, 9], seed: 5 });
		const out = new Set(visibleCars(traffic));
		traffic.pause(true);
		for (let t = 0; t < 60; t += STEP) {
			traffic.update(STEP);
			for (const car of visibleCars(traffic)) expect(out.has(car)).toBe(true);
		}
		// The cars that were out have all left, and nobody replaced them.
		expect(visibleCars(traffic)).toHaveLength(0);
		traffic.pause(false);
		for (let t = 0; t < 10; t += STEP) traffic.update(STEP);
		expect(visibleCars(traffic).length).toBeGreaterThan(0);
	});
});

describe("buildCar", () => {
	it("opens its rear door on the pavement side, clear of the passenger", () => {
		for (const shape of ["city", "sedan", "van"] as const) {
			const car = buildCar({ body: 0xe8dcc0, shape });
			const tween = car.rearDoor(true);
			tween.progress(1);
			const rotation = tween.targets()[0] as THREE.Euler;
			expect(rotation.y).toBeLessThan(-1.2);
			expect(car.exitPoint.z).toBeLessThan(-0.65);
			expect(Math.abs(car.exitPoint.x)).toBeLessThan(car.length / 2);
			car.rearDoor(false).progress(1);
			expect(rotation.y).toBe(0);
		}
	});

	it("turns its wheels as it moves, in either direction", () => {
		const car = buildCar({ body: 0xefe6d2, roof: palette.ink, taxi: true });
		car.setX(1);
		const forwards = car.wheels[0].rotation.y;
		expect(forwards).toBeLessThan(0);
		const reversed = buildCar({ body: 0xefe6d2 });
		reversed.root.rotation.y = Math.PI;
		reversed.setX(-1);
		expect(reversed.wheels[0].rotation.y).toBeCloseTo(forwards, 6);
	});

	it("stays a modest number of meshes", () => {
		for (const shape of ["city", "sedan", "van"] as const) {
			expect(
				meshes(buildCar({ body: 0x8fa38a, shape }).root).length,
			).toBeLessThanOrEqual(22);
		}
		expect(
			meshes(buildCar({ body: 0xefe6d2, taxi: true }).root).length,
		).toBeLessThanOrEqual(24);
	});
});

describe("seatPatrons", () => {
	it("keeps each patron on their seat, facing where the seat says", () => {
		// As the street gives them: the top of the seat, and a point to look at.
		const seats = [
			{
				position: new THREE.Vector3(10, 0.48, 6.2),
				facing: new THREE.Vector3(10.2, 0.48, 9.5),
			},
			{
				position: new THREE.Vector3(10.7, 0.48, 6.2),
				facing: new THREE.Vector3(-1, 0, 0),
			},
		];
		const patrons = seatPatrons(seats, 11);
		expect(patrons.group.children).toHaveLength(2);
		for (let t = 0; t < 30; t += STEP) patrons.update(STEP);
		const [a, b] = patrons.group.children;
		for (const [i, patron] of [a, b].entries()) {
			expect(patron.position.x).toBe(seats[i].position.x);
			expect(patron.position.z).toBe(seats[i].position.z);
			expect(patron.position.y).toBeCloseTo(0.48 - SEAT_HEIGHT, 6);
			expect(meshes(patron).length).toBeLessThanOrEqual(MESH_BUDGET);
		}
		expect(a.rotation.y).toBeCloseTo(Math.atan2(0.2, 3.3), 5);
		expect(b.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
	});
});
