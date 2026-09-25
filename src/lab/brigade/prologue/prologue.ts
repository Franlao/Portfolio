import gsap from "gsap";
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Cook } from "../cook";
import type { Sound } from "../sound";
import type { StationId } from "../stations";
import { palette } from "../toon";
import type { PrologueCopy } from "./copy";
import { buildFacade, type Facade } from "./facade";
import { Person } from "./people";
import { buildStreet, type Street } from "./street";
import { Crowd, seatPatrons, Traffic } from "./traffic";
import { buildCar } from "./vehicles";

/** What the prologue needs from the kitchen scene. main.ts provides it. */
export interface Stagehand {
	scene: THREE.Scene;
	camera: THREE.Camera;
	canvas: HTMLCanvasElement;
	stage: HTMLElement;
	view: {
		target: THREE.Vector3;
		zoom: number;
		shift: number;
		direction: THREE.Vector3;
	};
	frame: { wide: boolean; halfH: number };
	hemi: THREE.HemisphereLight;
	sun: THREE.DirectionalLight;
	sound: Sound;
	brigade: { chef: Cook; runner: Cook; cook: Cook };
	/** The visitor, as a character: they get out of the taxi and end up at the chef's table. */
	guest: Person;
	say(who: Cook, text: string, seconds?: number): void;
	/** Lights the rings and tags of these stations, and dims the others. */
	spotlight(ids: StationId[]): void;
	/** Where the kitchen rests once everyone is inside. */
	rest(): {
		target: THREE.Vector3;
		zoom: number;
		shift: number;
		direction: THREE.Vector3;
	};
	/** Projects a point of the scene to CSS pixels inside the stage. */
	toScreen(point: THREE.Vector3): { x: number; y: number };
	/** Runs a function on every frame, until the returned function is called. */
	onFrame(update: (delta: number) => void): () => void;
	reducedMotion: boolean;
}

const STORAGE_KEY = "brigade.arrived";
/** Looking at the shop front from across the street, slightly from the right. */
const FRONT = new THREE.Vector3(0.22, 0.2, 1).normalize();
const NIGHT = {
	background: 0x0d1b27,
	hemi: 0.45,
	sun: 0.5,
	sunColor: 0x9fb4d0,
};

/** The visitor's seat at the chef's table: across the pass from the chef. */
export const CHEF_TABLE = new THREE.Vector3(1.6, 0, 4.4);
/** The street, as the story uses it. */
const TAXI_LANE = 8.6;
const TAXI_STOP = 0.6;
const HOST_SPOT = new THREE.Vector3(-0.35, 0, 6.45);
const DOORSTEP = new THREE.Vector3(1.3, 0, 6.9);
const DOORWAY = new THREE.Vector3(1.3, 0, 5.4);
const INSIDE = new THREE.Vector3(1.3, 0, 4.8);

const wait = (seconds: number) =>
	new Promise<void>((resolve) => gsap.delayedCall(seconds, resolve));
const play = (tl: gsap.core.Timeline | gsap.core.Tween) =>
	tl.then(() => undefined);

const ARRIVING = "brigade-arriving";

/**
 * The page decides before the first paint (first visit, or ?arrivee in the address),
 * with an inline script that marks <html>: the kitchen controls never flash on screen.
 */
export function shouldArrive(): boolean {
	return document.documentElement.classList.contains(ARRIVING);
}

function remember() {
	try {
		window.localStorage.setItem(STORAGE_KEY, "1");
	} catch {
		// Private browsing: the arrival will simply play again next time.
	}
}

function element<T extends HTMLElement>(root: ParentNode, selector: string): T {
	const found = root.querySelector<T>(selector);
	if (!found) throw new Error(`Missing ${selector}`);
	return found;
}

/** A comic speech bubble over a character's head. Texts arrive typeset. */
function speaker(person: Person) {
	const div = document.createElement("div");
	div.className = "bubble";
	const anchor = new CSS2DObject(div);
	anchor.position.set(0, person.bubbleHeight, 0);
	person.root.add(anchor);
	return (text: string, seconds = 2) => {
		div.textContent = text;
		div.classList.add("is-visible");
		// Reduced motion speeds the global timeline up: reading time stays real.
		gsap.delayedCall(seconds * gsap.globalTimeline.timeScale(), () =>
			div.classList.remove("is-visible"),
		);
	};
}

/**
 * Plays the whole arrival. The visitor booked on their phone; a taxi drops them in
 * front of the restaurant; the maître d' opens the car door and welcomes them; the
 * front of the house opens; they sit at the chef's table; the chef says hello.
 * Resolves when the visitor has the kitchen to themselves.
 */
export async function arrive(
	hand: Stagehand,
	copy: PrologueCopy,
): Promise<void> {
	const { stage, view, scene, guest } = hand;
	const card = element<HTMLElement>(stage, ".arrival");
	const facade = buildFacade(copy.facade);
	const street = buildStreet();
	scene.add(facade.group, street.group);
	void document.fonts?.ready.then(() => facade.redraw());

	// Night falls on the street; the kitchen keeps its own warm lights.
	const day = {
		background: (scene.background as THREE.Color).clone(),
		hemi: hand.hemi.intensity,
		sun: hand.sun.intensity,
		sunColor: hand.sun.color.clone(),
	};
	(scene.background as THREE.Color).setHex(NIGHT.background);
	hand.hemi.intensity = NIGHT.hemi;
	hand.sun.intensity = NIGHT.sun;
	hand.sun.color.setHex(NIGHT.sunColor);

	const framing = hand.frame.wide
		? // The phone sits on the left: the house stands on the right.
			{ target: new THREE.Vector3(0.6, 3.2, 5.8), zoom: 0.86, shift: 0.15 }
		: // On a phone the conversation is a bottom sheet: the house fills the top half.
			{ target: new THREE.Vector3(1.0, -1.2, 5.8), zoom: 1.6, shift: 0 };
	view.direction.copy(FRONT);
	view.target.copy(framing.target);
	view.zoom = framing.zoom;
	view.shift = framing.shift;

	// The street comes alive: passers-by, cars, the café terrace, the maître d' at the door.
	const life = new THREE.Group();
	scene.add(life);
	const crowd = new Crowd({
		walkways: street.walkways,
		count: 10,
		seed: 7,
		keepClear: { fromX: -1.5, toX: 3.5 },
	});
	const traffic = new Traffic({
		// A one-way street, as often on the Presqu'île: the taxi stops on the left-hand kerb.
		lane: { z: 10.2, y: -0.15, fromX: -36, toX: 36 },
		interval: [4, 9],
		seed: 3,
	});
	const patrons = seatPatrons(street.seats, 11);
	const host = new Person({
		look: "host",
		coat: palette.ink,
		trousers: palette.ink,
		skin: palette.skins[3],
		hair: palette.ink,
	});
	host.root.position.copy(HOST_SPOT);
	host.faceTowards(HOST_SPOT.clone().setZ(12));
	const hostSays = speaker(host);
	const taxi = buildCar({ body: 0xefe6d2, roof: palette.ink, taxi: true });
	const taxiState = { x: -26 };
	taxi.root.position.set(taxiState.x, -0.15, TAXI_LANE);
	taxi.setX(taxiState.x);
	life.add(crowd.group, traffic.group, patrons.group, host.root, taxi.root);
	const stopLife = hand.onFrame((delta) => {
		crowd.update(delta);
		traffic.update(delta);
		patrons.update(delta);
		host.update(delta);
	});
	guest.root.visible = false;
	// Passers-by step around the maître d' and the visitor rather than through them.
	crowd.avoid([host.root, guest.root]);

	// The menu framed by the door leads to the text version.
	const menuLink = document.createElement("a");
	menuLink.className = "tag menu-tag";
	menuLink.href = element<HTMLAnchorElement>(card, ".arrival-menu").href;
	menuLink.textContent = copy.menuTag;
	const menuTag = new CSS2DObject(menuLink);
	menuTag.position.copy(facade.points.menu);
	facade.group.add(menuTag);

	// The restaurant's last message, once the taxi has stopped.
	const typing = element<HTMLElement>(card, ".msg-typing");
	const arrived = element<HTMLElement>(card, ".msg-arrived");
	const thread = element<HTMLElement>(card, ".phone-thread");
	const phoneSaysArrived = () => {
		if (!arrived.hidden) return;
		typing.hidden = true;
		arrived.hidden = false;
		card.classList.add("is-here");
		thread.scrollTop = thread.scrollHeight;
	};

	// The scene plays by itself; entering at any moment skips to the doorstep.
	let skipped = false;
	const walks: gsap.core.Timeline[] = [];
	const walk = (person: Person, points: THREE.Vector3[], speed?: number) => {
		const tl = person.walk(points, speed);
		walks.push(tl);
		return play(tl);
	};
	const exit = () => taxi.root.localToWorld(taxi.exitPoint.clone());
	const story = async () => {
		await play(
			gsap.to(taxiState, {
				x: TAXI_STOP,
				duration: 3,
				ease: "power2.out",
				onUpdate: () => taxi.setX(taxiState.x),
			}),
		);
		if (skipped) return;
		phoneSaysArrived();
		hand.sound.pop();
		// The camera comes closer, as in a film: the welcome is the moment to watch.
		const close = hand.frame.wide
			? { x: 0.4, y: 2.2, z: 6.6, zoom: 1.2 }
			: { x: 0.8, y: -0.2, z: 6.6, zoom: 2.1 };
		gsap.to(view.target, {
			x: close.x,
			y: close.y,
			z: close.z,
			duration: 3,
			ease: "power2.inOut",
		});
		gsap.to(view, { zoom: close.zoom, duration: 3, ease: "power2.inOut" });
		// The maître d' comes to open the car door.
		const door = exit();
		host.wave(0.8);
		await walk(host, [new THREE.Vector3(door.x + 0.8, 0, 7.35)], 2.4);
		if (skipped) return;
		host.faceTowards(door);
		await play(taxi.rearDoor(true));
		if (skipped) return;
		// The visitor gets out, phone still in hand.
		guest.root.position.copy(door);
		guest.root.position.y = -0.15;
		guest.root.visible = true;
		guest.holdPhone(true);
		gsap.to(guest.root.position, { y: 0, duration: 0.25, delay: 0.3 });
		await walk(guest, [new THREE.Vector3(door.x, 0, 7.2)], 1.8);
		if (skipped) return;
		host.faceTowards(guest.root.position);
		guest.faceTowards(host.root.position);
		walks.push(host.bow());
		hostSays(copy.host.welcome, 2.6);
		await wait(1.1);
		if (skipped) return;
		guest.holdPhone(false);
		await play(taxi.rearDoor(false));
		if (skipped) return;
		// The taxi leaves; the maître d' walks the visitor to the door.
		gsap.to(taxiState, {
			x: 34,
			duration: 2.4,
			ease: "power2.in",
			onUpdate: () => taxi.setX(taxiState.x),
		});
		void walk(host, [HOST_SPOT], 2.2).then(() => {
			if (!skipped) host.faceTowards(DOORSTEP);
		});
		await walk(guest, [DOORSTEP], 1.8);
		if (skipped) return;
		guest.faceTowards(DOORWAY);
	};
	// Skipping (or reduced motion) puts everyone where the story would have left them.
	const settle = () => {
		for (const tl of walks) tl.progress(1);
		gsap.killTweensOf([taxiState, guest.root.position, view, view.target]);
		taxi.root.visible = false;
		host.root.position.copy(HOST_SPOT);
		host.faceTowards(DOORSTEP);
		guest.root.position.copy(DOORSTEP);
		guest.root.visible = true;
		guest.holdPhone(false);
		guest.faceTowards(DOORWAY);
		phoneSaysArrived();
	};
	if (hand.reducedMotion) settle();
	else void story();

	// Enter with the reply button, the door itself, or Escape.
	await new Promise<void>((resolve) => {
		const enterButton = element<HTMLButtonElement>(card, ".arrival-enter");
		const raycaster = new THREE.Raycaster();
		const cast = (event: MouseEvent) => {
			const rect = hand.canvas.getBoundingClientRect();
			raycaster.setFromCamera(
				new THREE.Vector2(
					((event.clientX - rect.left) / rect.width) * 2 - 1,
					-((event.clientY - rect.top) / rect.height) * 2 + 1,
				),
				hand.camera,
			);
		};
		const onCanvasClick = (event: MouseEvent) => {
			cast(event);
			if (raycaster.intersectObject(facade.front, true).length > 0) done();
		};
		const onMove = (event: PointerEvent) => {
			cast(event);
			const overDoor = raycaster.intersectObject(facade.door, true).length > 0;
			hand.canvas.style.cursor = overDoor ? "pointer" : "default";
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") done();
		};
		const done = () => {
			enterButton.removeEventListener("click", done);
			hand.canvas.removeEventListener("click", onCanvasClick);
			hand.canvas.removeEventListener("pointermove", onMove);
			window.removeEventListener("keydown", onKey);
			hand.canvas.style.cursor = "default";
			resolve();
		};
		enterButton.addEventListener("click", done);
		hand.canvas.addEventListener("click", onCanvasClick);
		hand.canvas.addEventListener("pointermove", onMove);
		window.addEventListener("keydown", onKey);
		enterButton.focus({ preventScroll: true });
	});

	skipped = true;
	settle();
	remember();
	card.classList.add("is-leaving");
	facade.group.remove(menuTag);

	// « Par ici ! » : the maître d' opens the door and the visitor walks in.
	host.faceTowards(facade.points.door);
	host.gesture(INSIDE, 1.6);
	hostSays(copy.host.thisWay, 1.4);
	gsap.to(facade.door.rotation, { y: 1.75, duration: 0.6, ease: "power2.out" });
	if (!hand.reducedMotion) {
		void walk(guest, [DOORWAY, INSIDE], 2);
		await wait(0.6);
	}
	await openHouse(hand, facade, street, life, day, copy.ding);
	stopLife();
	scene.remove(facade.group, street.group, life);
	document.documentElement.classList.remove(ARRIVING);

	// The visitor takes their seat at the chef's table.
	const seat = () => {
		guest.root.position.copy(CHEF_TABLE);
		guest.faceTowards(hand.brigade.chef.root.position);
	};
	if (hand.reducedMotion) seat();
	else {
		await walk(guest, [CHEF_TABLE], 2.2);
		guest.faceTowards(hand.brigade.chef.root.position);
	}
	await tour(hand, copy);
}

/**
 * The doll's-house opening: the bell rings, the front and the side wall fall outwards,
 * the roof lifts off, the street folds away layer by layer, and the camera rises to
 * its usual corner of the kitchen.
 */
async function openHouse(
	hand: Stagehand,
	facade: Facade,
	street: Street,
	life: THREE.Group,
	day: {
		background: THREE.Color;
		hemi: number;
		sun: number;
		sunColor: THREE.Color;
	},
	dingText: string,
) {
	const { view } = hand;
	const rest = hand.rest();
	hand.sound.bell();
	const anchor = document.createElement("div");
	anchor.className = "ding-anchor";
	const ding = document.createElement("span");
	ding.className = "ding";
	ding.textContent = dingText;
	ding.setAttribute("aria-hidden", "true");
	anchor.append(ding);
	const bell = new CSS2DObject(anchor);
	bell.position.set(facade.points.door.x + 0.6, 2.9, facade.points.door.z);
	hand.scene.add(bell);
	gsap
		.timeline({ onComplete: () => hand.scene.remove(bell) })
		.fromTo(
			ding,
			{ scale: 0.3, rotate: -18, opacity: 0 },
			{ scale: 1, rotate: -8, opacity: 1, duration: 0.25, ease: "back.out(3)" },
		)
		.to(ding, { opacity: 0, y: -20, duration: 0.3, delay: 0.5 });

	if (hand.reducedMotion) {
		view.direction.copy(rest.direction);
		view.target.copy(rest.target);
		view.zoom = rest.zoom;
		view.shift = rest.shift;
		(hand.scene.background as THREE.Color).copy(day.background);
		hand.hemi.intensity = day.hemi;
		hand.sun.intensity = day.sun;
		hand.sun.color.copy(day.sunColor);
		return;
	}

	const background = hand.scene.background as THREE.Color;
	const tl = gsap.timeline();
	// The camera steps towards the door, behind the visitor.
	tl.to(
		view.target,
		{
			x: facade.points.door.x,
			y: hand.frame.wide ? 1.6 : -0.4,
			z: facade.points.door.z,
			duration: 0.8,
			ease: "power2.inOut",
		},
		0,
	);
	tl.to(
		view,
		{ zoom: view.zoom * 1.5, shift: 0, duration: 0.8, ease: "power2.inOut" },
		0,
	);
	// The house opens.
	tl.to(
		facade.front.rotation,
		{ x: Math.PI / 2, duration: 1.0, ease: "bounce.out" },
		0.65,
	);
	tl.to(
		facade.side.rotation,
		{ z: -Math.PI / 2, duration: 1.0, ease: "bounce.out" },
		0.75,
	);
	tl.to(facade.roof.position, { y: 16, duration: 0.9, ease: "power2.in" }, 0.6);
	// The street folds away like a stage set. The neighbours step aside first, so the
	// walls can fall where they stood; the road, the quay and the sky follow.
	const [curb, right, left, road, quay, town, sky] = street.layers;
	tl.to(life.position, { y: -24, duration: 0.7, ease: "power2.in" }, 0.45);
	tl.to(
		[curb, right, left].map((layer) => layer.position),
		{ y: -30, duration: 0.55, ease: "power2.in", stagger: 0.06 },
		0.05,
	);
	tl.to(
		[road, quay].map((layer) => layer.position),
		{ y: -30, duration: 0.8, ease: "power2.in" },
		1.1,
	);
	tl.to(
		[town, sky].map((layer) => layer.position),
		{ y: -40, duration: 0.8, ease: "power2.in" },
		0.9,
	);
	for (const lamp of street.lamps)
		tl.to(lamp, { intensity: 0, duration: 0.6 }, 0.6);
	// Day comes back with the kitchen lights.
	tl.to(
		background,
		{
			r: day.background.r,
			g: day.background.g,
			b: day.background.b,
			duration: 1.2,
		},
		0.8,
	);
	tl.to(hand.hemi, { intensity: day.hemi, duration: 1.2 }, 0.8);
	tl.to(hand.sun, { intensity: day.sun, duration: 1.2 }, 0.8);
	tl.to(
		hand.sun.color,
		{ r: day.sunColor.r, g: day.sunColor.g, b: day.sunColor.b, duration: 1.2 },
		0.8,
	);
	// The camera rises to the usual three-quarter view.
	tl.to(
		view.direction,
		{
			x: rest.direction.x,
			y: rest.direction.y,
			z: rest.direction.z,
			duration: 1.7,
			ease: "power3.inOut",
		},
		0.9,
	);
	tl.to(
		view.target,
		{
			x: rest.target.x,
			y: rest.target.y,
			z: rest.target.z,
			duration: 1.7,
			ease: "power3.inOut",
		},
		0.9,
	);
	tl.to(
		view,
		{ zoom: rest.zoom, shift: rest.shift, duration: 1.7, ease: "power3.inOut" },
		0.9,
	);
	// The walls lying on the pavement and the props at the door go last.
	tl.to(
		[facade.props.position, facade.front.position, facade.side.position],
		{ y: -24, duration: 0.8, ease: "power2.in" },
		1.5,
	);
	await play(tl);
}

/**
 * The chef's tour: three short lines, each one pointing at what it explains.
 * The speech balloon follows the chef on wide screens, and sits at the bottom on phones.
 */
async function tour(hand: Stagehand, copy: PrologueCopy): Promise<void> {
	const { stage, brigade } = hand;
	const steps = copy.tour.steps;
	const balloon = document.createElement("section");
	balloon.className = "tour";
	balloon.setAttribute("aria-label", copy.tour.label);
	balloon.innerHTML = `
		<p class="tour-count"></p>
		<p class="tour-text" aria-live="polite"></p>
		<div class="tour-actions">
			<button type="button" class="tour-next"></button>
			<button type="button" class="tour-skip"></button>
		</div>`;
	stage.appendChild(balloon);
	const text = element<HTMLElement>(balloon, ".tour-text");
	const count = element<HTMLElement>(balloon, ".tour-count");
	const next = element<HTMLButtonElement>(balloon, ".tour-next");
	const skip = element<HTMLButtonElement>(balloon, ".tour-skip");
	skip.textContent = copy.tour.skip;
	const orders = stage.querySelector<HTMLElement>(".orders");
	const head = new THREE.Vector3();

	// On roomy screens, the balloon hangs above the chef's head. On phones and very short
	// screens, the stylesheet places it: the same query decides both, so they never disagree.
	const docked = window.matchMedia("(max-width: 760px), (max-height: 500px)");
	const follow = () => {
		if (docked.matches) {
			balloon.style.removeProperty("left");
			balloon.style.removeProperty("top");
			return;
		}
		brigade.chef.root.getWorldPosition(head);
		head.y += 2.6;
		const { x, y } = hand.toScreen(head);
		balloon.style.left = `${Math.round(x)}px`;
		balloon.style.top = `${Math.round(y)}px`;
	};
	gsap.ticker.add(follow);
	follow();
	stage.classList.add("is-touring");

	const show = (index: number) => {
		count.textContent = copy.tour.step(index + 1, steps.length);
		text.textContent = steps[index];
		next.textContent =
			index === steps.length - 1 ? copy.tour.done : copy.tour.next;
		orders?.classList.toggle("is-spotlit", index === 1);
		if (index === 0) {
			brigade.chef.faceTowards(hand.guest.root.position);
			hand.say(brigade.chef, copy.bubbles.hello, 1.6);
			brigade.chef.wave(2.4);
			hand.spotlight([
				"delivery",
				"library",
				"coldroom",
				"pastry",
				"tools",
				"pass",
			]);
			gsap.delayedCall(0.6, () => {
				brigade.runner.hop();
				brigade.cook.hop();
			});
		} else if (index === 1) {
			hand.spotlight([]);
		} else {
			hand.spotlight(["pass"]);
			brigade.chef.hop();
		}
		if (!hand.reducedMotion) {
			gsap.fromTo(
				balloon,
				{ scale: 0.92, opacity: 0.4 },
				{ scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" },
			);
		}
		hand.sound.pop();
		next.focus({ preventScroll: true });
	};

	await new Promise<void>((resolve) => {
		let index = 0;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") finish();
		};
		const finish = () => {
			next.removeEventListener("click", onNext);
			skip.removeEventListener("click", finish);
			window.removeEventListener("keydown", onKey);
			resolve();
		};
		const onNext = () => {
			index++;
			if (index >= steps.length) finish();
			else show(index);
		};
		next.addEventListener("click", onNext);
		skip.addEventListener("click", finish);
		window.addEventListener("keydown", onKey);
		show(0);
	});

	gsap.ticker.remove(follow);
	orders?.classList.remove("is-spotlit");
	hand.spotlight([]);
	stage.classList.remove("is-touring");
	balloon.remove();
	hand.say(brigade.chef, copy.bubbles.order, 1.8);
}
