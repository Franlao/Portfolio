import * as THREE from "three";
import {
	MESH_BUDGET,
	meshCount,
	type Outfit,
	Person,
	passerbyOutfit,
	SEAT_HEIGHT,
	seeded,
} from "./people";
import { buildCar, type CarShape } from "./vehicles";

/**
 * The life of the street: passers-by on the pavement, cars on the road, patrons on
 * the café terrace. Everything moves from update(delta) with seeded randomness, so a
 * crowd replays identically and the tests can drive it without a browser.
 */

export interface Walkway {
	z: number;
	fromX: number;
	toX: number;
}

/** Centre to centre, between two people walking the same way in the same lane. */
const MIN_GAP = 1.0;
/** Lateral distance two people keep when they cross. */
const CLEARANCE = 0.85;
const MAX_DODGE = 0.3;
/** Lateral distance kept from someone standing on the pavement, and the widest detour. */
const ROOM = 0.72;
const MAX_DETOUR = 0.8;
/** Someone this close behind a person who stopped makes them move on. */
const POLITE = 2.6;
/** Lanes are picked by how much of them lies within this distance of the restaurant. */
const NEAR = 20;

interface Walker {
	person: Person;
	lane: number;
	z: number;
	min: number;
	max: number;
	dir: 1 | -1;
	speed: number;
	x: number;
	offset: number;
	/** Where to step sideways this frame, to let someone pass or to go round them. */
	aside: number;
	/** Speed over the last frame, which followers match. */
	moved: number;
	/** Distance left before the next thought of stopping. */
	stopIn: number;
	/** Time left standing still. */
	stopped: number;
	/** Stopped to look at a shop window (otherwise, at their phone). */
	window: boolean;
	/** Walks along reading their phone. */
	reading: boolean;
}

/**
 * Passers-by walking in lanes of the pavement, both ways, at slightly different speeds.
 * Past the end of a lane, a walker comes back from the other end, out of sight.
 * People crossing each other keep to their right; nobody overtakes, a faster walker
 * falls in behind a slower one.
 */
export class Crowd {
	readonly group = new THREE.Group();
	private readonly walkers: Walker[] = [];
	private readonly random: () => number;
	private readonly keepClear: { from: number; to: number } | null;
	private obstacles: THREE.Object3D[] = [];
	/** How far across the pavement anyone may step aside, beyond the outer lanes. */
	private band = { lo: 0, hi: 0 };

	constructor(options: {
		walkways: Walkway[];
		count: number;
		seed: number;
		/** Part of the pavement where nobody stops (the door): people walk through it. */
		keepClear?: { fromX: number; toX: number };
	}) {
		const { walkways, count, seed, keepClear } = options;
		this.random = seeded(seed);
		this.keepClear = keepClear
			? {
					from: Math.min(keepClear.fromX, keepClear.toX),
					to: Math.max(keepClear.fromX, keepClear.toX),
				}
			: null;
		if (walkways.length === 0) return;
		const zs = walkways.map((w) => w.z);
		// A body's width towards the houses, a little less towards the kerb.
		this.band = { lo: Math.min(...zs) - 0.3, hi: Math.max(...zs) + 0.25 };
		// Most people walk where the camera looks: a lane weighs what it has near the
		// restaurant, plus a little so that side lanes still get someone now and then.
		const weights = walkways.map((w) => {
			const lo = Math.max(Math.min(w.fromX, w.toX), -NEAR);
			const hi = Math.min(Math.max(w.fromX, w.toX), NEAR);
			return Math.max(0, hi - lo) + 2;
		});
		const total = weights.reduce((a, b) => a + b, 0);
		const pickLane = () => {
			let r = this.random() * total;
			for (const [lane, weight] of weights.entries()) {
				r -= weight;
				if (r < 0) return lane;
			}
			return weights.length - 1;
		};

		for (let i = 0; i < count; i++) {
			const lane = pickLane();
			const walkway = walkways[lane];
			const person = new Person(
				passerbyOutfit(seed * 7919 + i * 104729),
				seed * 31 + i,
			);
			const reading = this.random() < 0.18;
			if (reading) person.holdPhone(true);
			this.walkers.push({
				person,
				lane,
				z: walkway.z,
				min: Math.min(walkway.fromX, walkway.toX),
				max: Math.max(walkway.fromX, walkway.toX),
				dir: i % 2 === 0 ? 1 : -1,
				speed: 1.15 + this.random() * 0.6,
				x: 0,
				offset: 0,
				aside: 0,
				moved: 0,
				stopIn: 6 + this.random() * 30,
				stopped: 0,
				window: false,
				reading,
			});
			this.group.add(person.root);
		}

		// Spread each lane's walkers evenly along it, with a little jitter.
		const groups = new Map<string, Walker[]>();
		for (const w of this.walkers) {
			const key = `${w.lane} ${w.dir}`;
			groups.set(key, [...(groups.get(key) ?? []), w]);
		}
		for (const members of groups.values()) {
			members.forEach((w, k) => {
				const spacing = (w.max - w.min) / members.length;
				w.x = w.min + spacing * (k + 0.5 + (this.random() - 0.5) * 0.5);
			});
		}
		for (const w of this.walkers) {
			w.person.root.position.set(w.x, 0, w.z);
			w.person.root.rotation.y = (w.dir * Math.PI) / 2;
			w.person.setPace(w.speed);
		}
	}

	/**
	 * People standing on the pavement (the maître d', the visitor): walkers go round
	 * them. Their positions are read every frame, in the crowd group's parent space;
	 * hidden ones are ignored.
	 */
	avoid(obstacles: THREE.Object3D[]) {
		this.obstacles = obstacles;
	}

	update(delta: number) {
		const dt = Math.min(delta, 0.1);
		if (dt <= 0) return;
		const walkers = this.walkers;

		// Stops end when time is up, or as soon as someone comes up behind.
		for (const w of walkers) {
			if (w.stopped <= 0) continue;
			w.stopped -= dt;
			if (w.stopped <= 0 || this.behind(w, POLITE)) this.resume(w);
		}

		// People crossing each other step aside, each to their own side.
		for (const w of walkers) w.aside = 0;
		for (let i = 0; i < walkers.length; i++) {
			for (let j = i + 1; j < walkers.length; j++) {
				const a = walkers[i];
				const b = walkers[j];
				if (a.dir === b.dir) continue;
				const ahead = (b.x - a.x) * a.dir;
				// Only while they approach or pass, not once they are past each other.
				if (ahead > 2.4 || ahead < -0.8) continue;
				const dz = b.z - a.z;
				if (Math.abs(dz) >= CLEARANCE) continue;
				const push = (CLEARANCE - Math.abs(dz)) / 2;
				// Same lane: each keeps to their right (+z when heading to +x).
				const sign = dz !== 0 ? Math.sign(dz) : -a.dir;
				a.aside -= sign * push;
				b.aside += sign * push;
			}
		}
		for (const w of walkers) {
			// Someone standing in the way comes first: go round them. Otherwise, make way.
			let detour = 0;
			for (const o of this.obstacles) {
				if (!o.visible) continue;
				const ahead = (o.position.x - w.x) * w.dir;
				if (ahead > 2.5 || ahead < -0.7) continue;
				if (Math.abs(o.position.z - w.z) >= ROOM) continue;
				const d = this.detour(w, o.position.z);
				if (Math.abs(d) > Math.abs(detour)) detour = d;
			}
			const aside =
				detour !== 0
					? detour
					: THREE.MathUtils.clamp(w.aside, -MAX_DODGE, MAX_DODGE);
			w.aside = THREE.MathUtils.clamp(
				aside,
				this.band.lo - w.z,
				this.band.hi - w.z,
			);
		}
		const sidestep = 1 - Math.exp(-dt * 5);
		for (const w of walkers) w.offset += (w.aside - w.offset) * sidestep;

		for (const w of walkers) {
			if (w.stopped > 0) {
				w.moved = 0;
				continue;
			}
			let speed = w.speed;
			let room = Number.POSITIVE_INFINITY;
			const leader = this.leader(w);
			if (leader) {
				const gap = (leader.x - w.x) * w.dir;
				// Fall in behind a slower walker, never closer than MIN_GAP.
				if (gap < 2) speed = Math.min(speed, leader.moved + (gap - 1.4) * 1.5);
				room = Math.max(0, gap - MIN_GAP);
			}
			// Not round someone standing there yet: slow down, without stopping.
			if (this.blocked(w)) speed = Math.min(speed, 0.25);
			const step = Math.min(Math.max(0, speed) * dt, room);
			w.x += w.dir * step;
			w.moved = step / dt;
			if (w.dir > 0 ? w.x > w.max : w.x < w.min) {
				// Out of sight: come back from the other end, once there is room there.
				const start = w.dir > 0 ? w.min : w.max;
				w.x = this.startIsFree(w, start) ? start : w.dir > 0 ? w.max : w.min;
			}
			w.stopIn -= step;
			if (w.stopIn <= 0) this.considerStopping(w);
		}

		for (const w of walkers) {
			const person = w.person;
			person.root.position.set(w.x, 0, w.z + w.offset);
			if (w.stopped <= 0) person.setPace(w.moved);
			person.update(dt);
		}
	}

	/** The nearest walker ahead, in the same lane and the same direction. */
	private leader(w: Walker): Walker | null {
		let best: Walker | null = null;
		let bestGap = Number.POSITIVE_INFINITY;
		for (const o of this.walkers) {
			if (o === w || o.lane !== w.lane || o.dir !== w.dir) continue;
			const gap = (o.x - w.x) * w.dir;
			if (gap >= 0 && gap < bestGap) {
				best = o;
				bestGap = gap;
			}
		}
		return best;
	}

	/** Is anyone walking up behind w, closer than distance? */
	private behind(w: Walker, distance: number): boolean {
		return this.walkers.some((o) => {
			if (o === w || o.lane !== w.lane || o.dir !== w.dir || o.stopped > 0)
				return false;
			const gap = (w.x - o.x) * w.dir;
			return gap > 0 && gap < distance;
		});
	}

	/**
	 * The sideways step that clears someone standing at z: on the side that needs less,
	 * as long as it stays on the pavement; else as far as the pavement allows.
	 */
	private detour(w: Walker, z: number): number {
		const { lo, hi } = this.band;
		const fits = (step: number) =>
			Math.abs(step) <= MAX_DETOUR && w.z + step >= lo && w.z + step <= hi;
		const sides = [z - w.z - ROOM, z - w.z + ROOM].filter(fits);
		if (sides.length > 0)
			return sides.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
		return z - lo > hi - z
			? Math.max(lo - w.z, -MAX_DETOUR)
			: Math.min(hi - w.z, MAX_DETOUR);
	}

	/** Is someone standing just ahead, not yet stepped round? */
	private blocked(w: Walker): boolean {
		const z = w.z + w.offset;
		return this.obstacles.some((o) => {
			if (!o.visible) return false;
			const ahead = (o.position.x - w.x) * w.dir;
			return ahead > 0 && ahead < 1.1 && Math.abs(o.position.z - z) < 0.6;
		});
	}

	private startIsFree(w: Walker, start: number): boolean {
		return !this.walkers.some(
			(o) =>
				o !== w &&
				o.lane === w.lane &&
				o.dir === w.dir &&
				Math.abs(o.x - start) < MIN_GAP + 0.2,
		);
	}

	/** Now and then someone stops: a shop window, a message. Never in front of the door. */
	private considerStopping(w: Walker) {
		const random = this.random;
		const margin = (w.max - w.min) * 0.2;
		const inView = w.x > w.min + margin && w.x < w.max - margin;
		const clear =
			!this.keepClear ||
			w.x < this.keepClear.from - 1.2 ||
			w.x > this.keepClear.to + 1.2;
		const duration = 1.5 + random() * 2.5;
		const lookAtWindow = w.reading || random() < 0.6;
		if (!inView || !clear || this.behind(w, POLITE + 1.5)) {
			w.stopIn = 3 + random() * 6;
			return;
		}
		w.stopped = duration;
		w.window = lookAtWindow;
		w.stopIn = 25 + random() * 35;
		w.moved = 0;
		w.person.setPace(0);
		// The shop fronts are on the -z side of the pavement.
		if (lookAtWindow) w.person.faceTowards(new THREE.Vector3(w.x, 0, w.z - 4));
		else w.person.holdPhone(true);
	}

	private resume(w: Walker) {
		w.stopped = 0;
		if (!w.window && !w.reading) w.person.holdPhone(false);
		w.person.faceTowards(new THREE.Vector3(w.x + w.dir * 5, 0, w.z));
	}
}

/** Muted car colours: no red, no blue, those mean something else on this site. */
const CAR_COLORS = [
	0xe8dcc0, 0x8fa38a, 0x6d7478, 0x2f4a3f, 0xc9a13b, 0xf0ece2, 0x3d4143,
	0xa89f8a, 0x6b6b45,
] as const;
const FLEET: CarShape[] = ["city", "sedan", "van", "city", "sedan"];
/** Bumper to bumper, between two cars rolling one behind the other. */
const CAR_GAP = 1.2;
/** Bumper to bumper, for a car to set off behind the last one. */
const START_GAP = 2.5;

interface Vehicle {
	car: ReturnType<typeof buildCar>;
	length: number;
	active: boolean;
	/** Distance travelled from the start of the lane. */
	p: number;
	v: number;
	cruise: number;
}

/** Cars along one lane, at irregular intervals, never overlapping. */
export class Traffic {
	readonly group = new THREE.Group();
	private readonly vehicles: Vehicle[] = [];
	private readonly random: () => number;
	private readonly interval: [number, number];
	private readonly speed: number;
	private readonly from: number;
	private readonly dir: 1 | -1;
	private readonly span: number;
	private timer: number;
	private paused = false;

	constructor(options: {
		lane: { z: number; y: number; fromX: number; toX: number };
		interval: [number, number];
		seed: number;
		speed?: number;
	}) {
		const { lane, interval, seed, speed = 6.5 } = options;
		this.random = seeded(seed);
		this.interval = [
			Math.min(interval[0], interval[1]),
			Math.max(interval[0], interval[1]),
		];
		this.speed = speed;
		this.from = lane.fromX;
		this.dir = lane.toX >= lane.fromX ? 1 : -1;
		this.span = Math.abs(lane.toX - lane.fromX);
		for (const shape of FLEET) {
			const body =
				shape === "van"
					? 0xeeeae0
					: CAR_COLORS[Math.floor(this.random() * CAR_COLORS.length)];
			const car = buildCar({ body, shape });
			car.root.rotation.y = this.dir > 0 ? 0 : Math.PI;
			car.root.position.set(lane.fromX, lane.y, lane.z);
			car.root.visible = false;
			this.group.add(car.root);
			this.vehicles.push({
				car,
				length: car.length,
				active: false,
				p: 0,
				v: 0,
				cruise: speed,
			});
		}
		this.timer = this.random() * this.interval[0];
		// Warm up, so the street is already busy on the first frame.
		const warm = (0.6 * this.span) / speed;
		for (let t = 0; t < warm; t += 0.1) this.step(0.1);
	}

	update(delta: number) {
		const dt = Math.min(delta, 0.1);
		if (dt > 0) this.step(dt);
	}

	/** Holds new departures, e.g. while the taxi stands on this lane. Cars already out drive on. */
	pause(on: boolean) {
		this.paused = on;
	}

	private step(dt: number) {
		const active = this.vehicles
			.filter((v) => v.active)
			.sort((a, b) => b.p - a.p);
		for (const [i, v] of active.entries()) {
			const leader = i > 0 ? active[i - 1] : null;
			let target = v.cruise;
			const room = leader
				? leader.p - v.p - (leader.length + v.length) / 2
				: Number.POSITIVE_INFINITY;
			if (leader && room < 7)
				target = Math.min(target, leader.v + (room - CAR_GAP) * 0.9);
			target = Math.max(0, target);
			// Gentle on the accelerator, firm on the brake.
			const rate = target > v.v ? 3 : 9;
			v.v += THREE.MathUtils.clamp(target - v.v, -rate * dt, rate * dt);
			v.p += v.v * dt;
			// Whatever the speeds, a car never runs into the one ahead.
			if (leader)
				v.p = Math.min(
					v.p,
					leader.p - (leader.length + v.length) / 2 - CAR_GAP / 2,
				);
			v.car.setX(this.from + this.dir * v.p);
			if (v.p > this.span + v.length) {
				v.active = false;
				v.car.root.visible = false;
			}
		}

		this.timer -= dt;
		if (this.timer > 0 || this.paused) return;
		const idle = this.vehicles.filter((v) => !v.active);
		const next = idle[Math.floor(this.random() * idle.length)];
		const last = this.vehicles
			.filter((v) => v.active)
			.reduce<Vehicle | null>((a, v) => (!a || v.p < a.p ? v : a), null);
		const free =
			next && (!last || last.p - (last.length + next.length) / 2 >= START_GAP);
		if (!free) {
			this.timer = 0.4;
			return;
		}
		next.active = true;
		next.p = 0;
		next.cruise = this.speed * (0.9 + this.random() * 0.2);
		next.v = next.cruise;
		next.car.root.position.x = this.from;
		next.car.setX(this.from);
		next.car.root.visible = true;
		const [low, high] = this.interval;
		this.timer = low + this.random() * (high - low);
	}
}

/**
 * Patrons seated at the café tables, quietly alive: a cup to the lips now and then,
 * a nod, a glance at their neighbour.
 * A seat's position is the top of the seat. Its facing is the point the patron looks
 * at; a unit vector is read as a direction instead.
 */
export function seatPatrons(
	seats: { position: THREE.Vector3; facing: THREE.Vector3 }[],
	seed: number,
): { group: THREE.Group; update(delta: number): void } {
	const group = new THREE.Group();
	const random = seeded(seed);
	const patrons = seats.map((seat, i) => {
		const outfit: Outfit = {
			...passerbyOutfit(seed * 6151 + i * 3571),
			longCoat: false,
			bag: false,
			umbrella: false,
		};
		// Seated with a cup: shed the hat, then the scarf, if the cup would break the budget.
		const withCup = random() < 0.75;
		if (withCup && meshCount(outfit) + 2 > MESH_BUDGET) outfit.hat = false;
		if (withCup && meshCount(outfit) + 2 > MESH_BUDGET)
			outfit.accent = undefined;
		const person = new Person(outfit, seed * 59 + i);
		person.root.position.copy(seat.position);
		person.root.position.y -= SEAT_HEIGHT;
		const f = seat.facing;
		const look =
			Math.abs(f.length() - 1) < 1e-3 ? f : f.clone().sub(seat.position);
		person.root.rotation.y = Math.atan2(look.x, look.z);
		person.sit(true);
		person.holdCup(withCup);
		group.add(person.root);
		return {
			person,
			sip: 2 + random() * 6,
			nod: 1 + random() * 5,
			glance: 2 + random() * 6,
			glancing: 0,
		};
	});
	// Someone to glance at: the nearest other patron, if they share a table.
	const neighbour = patrons.map((p) => {
		let best: THREE.Vector3 | null = null;
		let bestDistance = 1.8;
		for (const o of patrons) {
			if (o === p) continue;
			const d = o.person.root.position.distanceTo(p.person.root.position);
			if (d < bestDistance) {
				best = o.person.root.position.clone();
				bestDistance = d;
			}
		}
		return best;
	});

	return {
		group,
		update(delta: number) {
			const dt = Math.min(delta, 0.1);
			for (const [i, p] of patrons.entries()) {
				p.sip -= dt;
				if (p.sip <= 0) {
					p.person.sip();
					p.sip = 4 + random() * 8;
				}
				p.nod -= dt;
				if (p.nod <= 0) {
					p.person.nod();
					p.nod = 3 + random() * 7;
				}
				p.glance -= dt;
				if (p.glancing > 0) {
					p.glancing -= dt;
					if (p.glancing <= 0) p.person.glance(null);
				} else if (p.glance <= 0) {
					const other = neighbour[i];
					if (other) {
						p.person.glance(other);
						p.glancing = 1.5 + random() * 2;
					}
					p.glance = 4 + random() * 8;
				}
				p.person.update(dt);
			}
		},
	};
}
