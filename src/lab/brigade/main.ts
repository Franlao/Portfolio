import gsap from "gsap";
import * as THREE from "three";
import {
	CSS2DObject,
	CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import type {
	Outcome,
	PieceId,
} from "../../components/demos/claims-agent/engine";
import type { Lang } from "../../i18n/ui";
import { competenceById, competences } from "../../lib/offer/competences";
import { countWords, MIN_WORDS } from "../../lib/offer/engine";
import { presets } from "../../lib/offer/presets";
import type { Order } from "../../lib/offer/reader";
import { readOffer } from "../../lib/offer/remote";
import type { ProjectCard } from "../../lib/projects";
import { frTypo } from "../../lib/typo";
import { readVisit, saveVisit } from "../../lib/visit";
import { Bill, type Tasting } from "./bill";
import { Cook, crate } from "./cook";
import { copy, intlLocale } from "./copy";
import { games } from "./games";
import { buildKitchen, type StationRuntime } from "./kitchen";
import type { Notebook, NotebookRound } from "./notebook/notebook";
import { prologueCopy } from "./prologue/copy";
import { createNarration } from "./prologue/narration";
import { Person } from "./prologue/people";
import { arrive, CHEF_TABLE, shouldArrive } from "./prologue/prologue";
import { deal, judge, type Round, rushCases, score } from "./rush";
import { Sound } from "./sound";
import type { StationId } from "./stations";
import { outline, palette, toon } from "./toon";
import { announcement } from "./voice/announce";
import { voiceCopy } from "./voice/copy";
import { type Speaker, STREET_VOICES } from "./voice/speakers";
import { Voices } from "./voice/voices";

const FOOD: Record<StationId, number> = {
	pass: palette.check,
	delivery: palette.wood,
	library: palette.model,
	coldroom: 0x3f8f8a,
	pastry: 0xf2a7b8,
	tools: palette.copper,
};

/** The usual three-quarter view of the kitchen, from the front right corner. */
const REST_DIRECTION = new THREE.Vector3(1, 0.86, 1).normalize();

const reducedMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;
const wait = (seconds: number) =>
	new Promise<void>((resolve) => gsap.delayedCall(seconds, resolve));
/**
 * Reduced motion speeds the whole timeline up (see start()), but reading time and
 * timers must keep real seconds: this converts them to timeline seconds.
 */
const realSeconds = (seconds: number) =>
	seconds * gsap.globalTimeline.timeScale();
/** Under reduced motion, the camera cuts instead of flying. */
const cameraSeconds = (seconds: number) => (reducedMotion ? 0 : seconds);
// Uses the promise GSAP exposes, so the animation keeps its own onComplete callback.
const play = (tl: gsap.core.Timeline | gsap.core.Tween) =>
	tl.then(() => undefined);

/** The page's language, set by the layout on <html lang>. */
function pageLang(): Lang {
	return document.documentElement.lang === "en" ? "en" : "fr";
}

function readProjects(): ProjectCard[] {
	const node = document.getElementById("brigade-data");
	return node?.textContent
		? (JSON.parse(node.textContent) as ProjectCard[])
		: [];
}

function element<T extends HTMLElement>(selector: string): T {
	const found = document.querySelector<T>(selector);
	if (!found) throw new Error(`Missing ${selector}`);
	return found;
}

/** Applies French typography to every static text node of the page. */
function typesetStatic(root: HTMLElement) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.nodeValue) node.nodeValue = frTypo(node.nodeValue);
	}
}

export function start() {
	if (reducedMotion) gsap.globalTimeline.timeScale(3);
	const lang = pageLang();
	const t = copy[lang];
	const percentFormat = new Intl.NumberFormat(intlLocale[lang], {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const percent = (v: number) => percentFormat.format(v);
	const projects = readProjects();
	const bySlug = new Map(projects.map((p) => [p.slug, p]));
	const stage = element<HTMLElement>(".brigade-stage");
	if (lang === "fr") typesetStatic(stage);
	const canvas = element<HTMLCanvasElement>("#brigade-canvas");

	// Renderer, scene, camera.
	let renderer: THREE.WebGLRenderer;
	try {
		renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	} catch {
		// No WebGL (old device, disabled GPU): the menu tells the same story in text.
		const menu = document.querySelector<HTMLAnchorElement>(
			".intro-text-version a",
		);
		if (menu) window.location.replace(menu.href);
		return;
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	// Hard shadows: they suit the comic style, and soft PCF shadows cost up to 100x more
	// on integrated graphics (measured: 2 fps against 211 fps on an Intel laptop GPU).
	renderer.shadowMap.type = THREE.BasicShadowMap;
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const labels = new CSS2DRenderer();
	labels.domElement.className = "brigade-labels";
	stage.appendChild(labels.domElement);

	const scene = new THREE.Scene();
	scene.background = new THREE.Color(palette.backdrop);

	const camera = new THREE.OrthographicCamera();
	// shift slides the scene sideways, as a fraction of the screen width (positive: to the right).
	// direction points from the target to the camera: the usual three-quarter view,
	// or the street in front of the restaurant during the arrival.
	const view = {
		target: new THREE.Vector3(0, 0.9, 0),
		zoom: 1,
		shift: 0,
		direction: REST_DIRECTION.clone(),
	};
	const frame = { halfW: 1, halfH: 1, wide: false };
	const restShift = () => (frame.wide ? 0.1 : 0);
	const pointer = new THREE.Vector2();
	const lookFrom = new THREE.Vector3();
	// The first visit starts outside, in the street, until the chef's tour is over.
	let arriving = shouldArrive();

	const hemi = new THREE.HemisphereLight(0xfff4e0, 0x2a3b35, 1.6);
	scene.add(hemi);
	const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
	sun.position.set(6, 12, 8);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.camera.left = -12;
	sun.shadow.camera.right = 12;
	sun.shadow.camera.top = 12;
	sun.shadow.camera.bottom = -12;
	sun.shadow.bias = -0.0005;
	scene.add(sun);

	const kitchen = buildKitchen();
	scene.add(kitchen.group);

	// The brigade.
	const chef = new Cook({
		apron: palette.ink,
		skin: palette.skins[0],
		chef: true,
	});
	const runner = new Cook({ apron: palette.model, skin: palette.skins[2] });
	const cook = new Cook({ apron: palette.model, skin: palette.skins[1] });
	const home = {
		chef: kitchen.points.chef.clone(),
		runner: new THREE.Vector3(-2.6, 0, -3.3),
		cook: kitchen.points.stoveCook.clone(),
	};
	chef.root.position.copy(home.chef);
	runner.root.position.copy(home.runner);
	cook.root.position.copy(home.cook);
	cook.root.rotation.y = Math.PI;
	runner.root.rotation.y = Math.PI * 0.75;
	scene.add(chef.root, runner.root, cook.root);
	const cooks = [chef, runner, cook];
	// The visitor, seated at the chef's table: the whole kitchen works for them.
	const guest = new Person({
		look: "recruiter",
		coat: 0xb07a4f,
		trousers: 0x3a3f3c,
		skin: palette.skins[1],
		hair: 0x2b2118,
		accent: 0xefe3c4,
		bag: true,
	});
	guest.root.position.copy(CHEF_TABLE);
	guest.faceTowards(home.chef);
	scene.add(guest.root);
	cook.setStirring(true);
	const sound = new Sound();
	const voiceText = voiceCopy[lang];
	// The camera is the visitor's ears: each voice comes from where its character stands on screen.
	const ear = new THREE.Vector3();
	const voices = new Voices(
		sound,
		lang,
		(point) => ear.copy(point).project(camera).x,
	);
	const speakerOf = new Map<Cook, Speaker>([
		[chef, "chef"],
		[runner, "runner"],
		[cook, "cook"],
	]);

	const bubble = (cookObj: Cook) => {
		const div = document.createElement("div");
		div.className = "bubble";
		// Kitchen chatter: what matters is also said by the ticket, the panels and the narration.
		div.setAttribute("aria-hidden", "true");
		const object = new CSS2DObject(div);
		object.position.set(0, 2.75, 0);
		cookObj.root.add(object);
		return div;
	};
	const bubbles = new Map<Cook, HTMLDivElement>([
		[chef, bubble(chef)],
		[runner, bubble(runner)],
		[cook, bubble(cook)],
	]);
	const hides = new Map<HTMLDivElement, gsap.core.Tween>();
	/** Shows a bubble for a few seconds. A voiced bubble stays as long as the voice, and shows it. */
	const bubbleSay = (
		who: Cook,
		text: string,
		seconds: number,
		voiced = false,
	) => {
		const div = bubbles.get(who);
		if (!div) return;
		div.textContent = lang === "fr" ? frTypo(text) : text;
		div.classList.add("is-visible");
		div.classList.toggle("is-voiced", voiced);
		hides.get(div)?.kill();
		hides.set(
			div,
			gsap.delayedCall(realSeconds(seconds), () =>
				div.classList.remove("is-visible", "is-voiced"),
			),
		);
	};
	/**
	 * A character speaks: the bubble always, the voice too once the sound is on. Resolves
	 * when the voice has finished, with false if it stayed silent.
	 */
	const say = (who: Cook, text: string, seconds = 1.4): Promise<boolean> => {
		bubbleSay(who, text, seconds);
		const speaker = speakerOf.get(who);
		if (!speaker) return Promise.resolve(false);
		return voices.say(speaker, text, {
			from: who.root,
			onStart: (clip) =>
				bubbleSay(who, text, Math.max(seconds, clip.seconds + 0.3), true),
		});
	};

	// Station tags: real buttons, so the stations can be visited with a keyboard.
	const tags = new Map<StationId, HTMLButtonElement>();
	for (const runtime of kitchen.stations.values()) {
		const project = bySlug.get(runtime.def.slug);
		const button = document.createElement("button");
		button.type = "button";
		button.className = "tag";
		button.innerHTML = `<span class="tag-name"></span><span class="tag-project"></span><span class="tag-score"></span>`;
		(button.querySelector(".tag-name") as HTMLElement).textContent =
			t.stations[runtime.def.id].name;
		(button.querySelector(".tag-project") as HTMLElement).textContent =
			project?.title ?? "";
		button.addEventListener("click", () => visit(runtime.def.id));
		const object = new CSS2DObject(button);
		object.position.set(...runtime.def.tag);
		scene.add(object);
		tags.set(runtime.def.id, button);
	}

	// Steam: a small pool of puffs above the pots.
	const steamMaterial = new THREE.MeshBasicMaterial({
		color: 0xffffff,
		transparent: true,
		opacity: 0.8,
		depthWrite: false,
	});
	const puffs = Array.from({ length: 48 }, () => {
		const mesh = new THREE.Mesh(
			new THREE.SphereGeometry(0.12, 8, 8),
			steamMaterial.clone(),
		);
		mesh.visible = false;
		scene.add(mesh);
		return { mesh, life: 0, speed: 0 };
	});
	let steam = 0.25;
	const emit = () => {
		const puff = puffs.find((p) => p.life <= 0);
		if (!puff) return;
		const top =
			kitchen.potTops[Math.floor(Math.random() * kitchen.potTops.length)];
		puff.mesh.position.set(
			top.x + (Math.random() - 0.5) * 0.3,
			top.y,
			top.z + (Math.random() - 0.5) * 0.3,
		);
		puff.life = 1;
		puff.speed = 0.6 + Math.random() * 0.5;
		puff.mesh.visible = true;
	};

	// The plate, the stamp and the bell ring at the pass.
	const plate = new THREE.Group();
	const dish = outline(
		new THREE.Mesh(
			new THREE.CylinderGeometry(0.42, 0.34, 0.06, 28),
			toon(0xffffff),
		),
		0.02,
	);
	plate.add(dish);
	plate.visible = false;
	scene.add(plate);
	const stampDiv = document.createElement("div");
	stampDiv.className = "stamp";
	stampDiv.textContent = t.stamp;
	stampDiv.setAttribute("aria-hidden", "true");
	const stamp = new CSS2DObject(stampDiv);
	stamp.position.copy(kitchen.points.stamp);
	scene.add(stamp);

	// Camera framing.
	const visitPanel = element<HTMLElement>(".visit");
	const rushPanel = element<HTMLElement>(".rush");
	const gamePanel = element<HTMLElement>(".game");
	const resize = () => {
		const { clientWidth: w, clientHeight: h } = stage;
		renderer.setSize(w, h, false);
		labels.setSize(w, h);
		const aspect = w / h;
		// Portrait screens crop the edges of the diorama rather than shrinking it too much.
		const viewHeight = aspect < 0.8 ? 17 / aspect : Math.max(15, 22 / aspect);
		frame.halfH = viewHeight / 2;
		frame.halfW = (viewHeight * aspect) / 2;
		frame.wide = aspect > 1.25;
		// On wide screens, the kitchen slides right to leave room for the intro.
		if (visitPanel.hidden && !arriving) view.shift = restShift();
		applyProjection();
	};
	const applyProjection = () => {
		// Three.js zooms around the frustum centre, so the offset is divided by the zoom
		// to keep the same share of the screen.
		const offset = (view.shift * 2 * frame.halfW) / view.zoom;
		camera.left = -frame.halfW - offset;
		camera.right = frame.halfW - offset;
		camera.top = frame.halfH;
		camera.bottom = -frame.halfH;
		camera.near = 0.1;
		// The arrival's backdrop (Fourvière hill) stands far behind the street.
		camera.far = 200;
		camera.zoom = view.zoom;
		camera.updateProjectionMatrix();
	};
	resize();
	window.addEventListener("resize", resize);
	stage.addEventListener("pointermove", (event) => {
		const rect = stage.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			((event.clientY - rect.top) / rect.height) * 2 - 1,
		);
	});

	// Pointing at a station lights it up; clicking it visits it.
	const raycaster = new THREE.Raycaster();
	const pointerNdc = new THREE.Vector2();
	let pointerInside = false;
	let hovered: StationId | null = null;
	const lit = new Set<StationId>();

	const stationAt = (ndc: THREE.Vector2): StationId | null => {
		raycaster.setFromCamera(ndc, camera);
		const hit = raycaster.intersectObjects(kitchen.group.children, true)[0];
		let node: THREE.Object3D | null = hit?.object ?? null;
		while (node && !node.userData.station) node = node.parent;
		return node ? (node.userData.station as StationId) : null;
	};

	const toNdc = (event: PointerEvent | MouseEvent) => {
		const rect = canvas.getBoundingClientRect();
		return new THREE.Vector2(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1,
		);
	};

	canvas.addEventListener("pointermove", (event) => {
		pointerNdc.copy(toNdc(event));
		pointerInside = true;
	});
	canvas.addEventListener("pointerleave", () => {
		pointerInside = false;
	});
	canvas.addEventListener("click", (event) => {
		if (arriving) return;
		const id = stationAt(toNdc(event));
		if (id) visit(id);
	});

	const updateHover = () => {
		const id = pointerInside && !arriving ? stationAt(pointerNdc) : null;
		if (id === hovered) return;
		if (hovered) {
			tags.get(hovered)?.classList.remove("is-hover");
			const ring = kitchen.stations.get(hovered)?.ring;
			if (ring && !lit.has(hovered)) ring.material.opacity = 0;
		}
		hovered = id;
		canvas.style.cursor = id ? "pointer" : "default";
		if (id) {
			tags.get(id)?.classList.add("is-hover");
			const ring = kitchen.stations.get(id)?.ring;
			if (ring && !lit.has(id)) {
				ring.scale.set(0.8, 0.8, 1);
				ring.material.opacity = 0.22;
			}
		}
	};

	// Render loop. The prologue hooks its street life into it.
	const frameHooks = new Set<(delta: number) => void>();
	const timer = new THREE.Timer();
	timer.connect(document);
	let emitAccumulator = 0;
	let lastShift = view.shift;
	let frameCount = 0;
	// If the first frames are slow (weak GPU, very dense screen), trade resolution for smoothness.
	let perfStart = 0;
	let perfChecked = false;
	renderer.setAnimationLoop((time) => {
		timer.update(time);
		if (!perfChecked) {
			if (frameCount === 0) perfStart = time;
			if (frameCount === 90) {
				perfChecked = true;
				const fps = 90000 / Math.max(1, time - perfStart);
				if (fps < 45 && renderer.getPixelRatio() > 1) renderer.setPixelRatio(1);
			}
		}
		const delta = Math.min(timer.getDelta(), 0.05);
		for (const c of cooks) c.update(delta);
		// Voices follow their characters; mouths and balloons follow the voices.
		voices.update();
		for (const c of cooks) {
			const level = voices.level(speakerOf.get(c) as Speaker);
			c.talk(level);
			bubbles.get(c)?.style.setProperty("--voice", level.toFixed(2));
		}
		guest.update(delta);
		for (const hook of frameHooks) hook(delta);
		frameCount++;
		if (frameCount % 4 === 0) updateHover();
		emitAccumulator += delta * (4 + steam * 26);
		while (emitAccumulator > 1) {
			emit();
			emitAccumulator -= 1;
		}
		for (const puff of puffs) {
			if (puff.life <= 0) continue;
			puff.life -= delta * 0.8;
			puff.mesh.position.y += delta * puff.speed;
			const s = 0.6 + (1 - puff.life) * 1.6;
			puff.mesh.scale.setScalar(s);
			(puff.mesh.material as THREE.MeshBasicMaterial).opacity =
				Math.max(0, puff.life) * 0.7;
			if (puff.life <= 0) puff.mesh.visible = false;
		}
		const sway = reducedMotion ? 0 : 0.35 / view.zoom;
		const target = view.target
			.clone()
			.add(
				new THREE.Vector3(
					pointer.x * sway,
					-pointer.y * sway * 0.5,
					-pointer.x * sway,
				),
			);
		camera.position
			.copy(target)
			.addScaledVector(lookFrom.copy(view.direction).normalize(), 30);
		camera.lookAt(target);
		if (camera.zoom !== view.zoom || lastShift !== view.shift) {
			lastShift = view.shift;
			applyProjection();
		}
		renderer.render(scene, camera);
		labels.render(scene, camera);
	});

	// Overlay UI.
	const ticket = element<HTMLElement>(".ticket");
	const dishPanel = element<HTMLElement>(".dish");
	const orderButtons = [
		...document.querySelectorAll<HTMLButtonElement>("[data-order]"),
	];
	const writeDialog = element<HTMLDialogElement>(".write");
	const writeText = element<HTMLTextAreaElement>(".write textarea");
	const writeError = element<HTMLElement>(".write-error");
	let busy = false;
	let orderNumber = 41;

	// aria-disabled rather than disabled: the button keeps the focus while the kitchen works.
	const setBusy = (value: boolean) => {
		busy = value;
		for (const b of orderButtons)
			b.setAttribute("aria-disabled", String(value));
		stage.classList.toggle("is-busy", value);
	};

	const resetStations = () => {
		for (const runtime of kitchen.stations.values()) {
			gsap.to(runtime.ring.material, { opacity: 0, duration: 0.3 });
			const tag = tags.get(runtime.def.id);
			tag?.classList.remove("is-lit", "is-best");
			lit.delete(runtime.def.id);
			const score = tag?.querySelector(".tag-score");
			if (score) score.textContent = "";
		}
		for (const jar of kitchen.jars) {
			(jar.material as THREE.MeshToonMaterial).emissive.setHex(0x000000);
		}
		plate.visible = false;
		stampDiv.classList.remove("is-visible");
	};

	const ticketList = element<HTMLOListElement>(".ticket-lines");
	const ticketFoot = element<HTMLElement>(".ticket-foot");
	const quoted = (text: string) => {
		const short = text.length > 30 ? `${text.slice(0, 28).trimEnd()}…` : text;
		return lang === "fr" ? frTypo(`« ${short} »`) : `“${short}”`;
	};
	const ticketLine = (className: string, text: string) => {
		const li = document.createElement("li");
		li.className = className;
		li.textContent = text;
		return li;
	};

	/** The ticket slides in as soon as the order is sent: the commis is still reading. */
	const openTicket = (label: string) => {
		orderNumber++;
		element<HTMLElement>(".ticket-number").textContent = t.ticket.number(
			String(orderNumber).padStart(3, "0"),
		);
		element<HTMLElement>(".ticket-title").textContent = label;
		ticketList.replaceChildren(ticketLine("is-reading", t.ticket.reading));
		ticketFoot.textContent = "";
		ticket.hidden = false;
		gsap.fromTo(
			ticket,
			{ yPercent: -110 },
			{ yPercent: 0, duration: 0.7, ease: "steps(8)" },
		);
	};

	/**
	 * What the model read is written in blue, like everything a model writes on this site;
	 * the red ticks of the check come later, at the pass.
	 */
	const fillTicket = (order: Order) => {
		const fromModel = order.source === "model";
		const lines = order.demand.map((d) => {
			const li = document.createElement("li");
			if (fromModel) li.className = "is-model";
			const qty = document.createElement("span");
			qty.textContent = t.ticket.quantity(d.count);
			li.append(
				qty,
				` ${competenceById.get(d.competence)?.label[lang] ?? d.competence}`,
			);
			if (fromModel) {
				const tick = document.createElement("b");
				tick.className = "ticket-tick";
				tick.textContent = "✓";
				tick.setAttribute("aria-hidden", "true");
				li.append(tick);
			}
			return li;
		});
		// Only checked lines reach the ticket. What the house does not cook is said
		// under the dish.
		ticketList.replaceChildren(...lines);
		ticketFoot.textContent = fromModel
			? t.ticket.footModel(order.lines)
			: t.ticket.foot(order.words, order.lines);
		gsap.fromTo(
			ticketList.children,
			{ opacity: 0 },
			{ opacity: 1, stagger: 0.08 },
		);
	};

	/** The pass checks the ticket: a red tick per line. */
	const checkTicket = () => {
		const tl = gsap.timeline();
		tl.fromTo(
			ticketList.querySelectorAll(".ticket-tick"),
			{ opacity: 0, scale: 2.4 },
			{
				opacity: 1,
				scale: 1,
				duration: 0.2,
				stagger: 0.12,
				ease: "back.out(2)",
			},
		);
		return tl;
	};

	const lightStations = (result: Order) => {
		const tl = gsap.timeline();
		const best = result.matches[0]?.project;
		for (const [index, match] of result.matches.entries()) {
			const runtime = [...kitchen.stations.values()].find(
				(r) => r.def.slug === match.project,
			);
			if (!runtime || match.coverage <= 0) continue;
			const tag = tags.get(runtime.def.id);
			const score = tag?.querySelector(".tag-score");
			const counter = { v: 0 };
			lit.add(runtime.def.id);
			tl.add(() => tag?.classList.add("is-lit"), index * 0.25);
			tl.to(
				runtime.ring.material,
				{ opacity: 0.12 + match.coverage * 0.55, duration: 0.5 },
				index * 0.25,
			);
			tl.fromTo(
				runtime.ring.scale,
				{ x: 0.3, y: 0.3 },
				{
					x: 0.5 + match.coverage,
					y: 0.5 + match.coverage,
					duration: 0.7,
					ease: "back.out(2)",
				},
				index * 0.25,
			);
			tl.to(
				counter,
				{
					v: match.coverage,
					duration: 0.8,
					onUpdate: () => {
						if (score) score.textContent = percent(counter.v);
					},
				},
				index * 0.25,
			);
			if (match.project === best)
				tl.add(() => tag?.classList.add("is-best"), index * 0.25 + 0.6);
		}
		return tl;
	};

	const stationFor = (slug: string): StationRuntime | undefined =>
		[...kitchen.stations.values()].find((r) => r.def.slug === slug);

	const showDish = (result: Order) => {
		const list = element<HTMLOListElement>(".dish-list");
		list.replaceChildren(
			...result.matches
				.filter((m) => m.coverage > 0)
				.slice(0, 3)
				.map((m) => {
					const runtime = stationFor(m.project);
					const li = document.createElement("li");
					const button = document.createElement("button");
					button.type = "button";
					const title = document.createElement("strong");
					title.textContent = bySlug.get(m.project)?.title ?? m.project;
					const meta = document.createElement("span");
					meta.textContent = t.dish.meta(
						runtime ? t.stations[runtime.def.id].name : "",
						percent(m.coverage),
					);
					button.append(title, meta);
					if (runtime)
						button.addEventListener("click", () => visit(runtime.def.id));
					li.append(button);
					return li;
				}),
		);
		// What the offer asks and the house does not cook, said plainly.
		const missing = [
			...result.outside.slice(0, 2).map(quoted),
			...result.uncovered
				.slice(0, 2)
				.map((id) => competenceById.get(id)?.label[lang] ?? id),
		];
		const outside = element<HTMLElement>(".dish-outside");
		outside.hidden = missing.length === 0;
		outside.textContent = `${t.dish.outside} ${missing.join(", ")}`;
		dishPanel.hidden = false;
		stage.classList.add("is-served");
		gsap.fromTo(
			dishPanel,
			{ y: 30, opacity: 0 },
			{
				y: 0,
				opacity: 1,
				duration: 0.5,
				ease: "back.out(1.6)",
				// The stylesheet hides the dish during a visit or a game: no inline opacity left.
				clearProps: "opacity,transform",
			},
		);
		// The keyboard follows the service, from the order just sent to the dish.
		const active = document.activeElement;
		if (!active || active === document.body || active.closest(".orders"))
			dishPanel.focus({ preventScroll: true });
	};

	// The first order is told station by station, in kitchen words then AI words.
	const narration = createNarration(
		stage,
		prologueCopy[lang].narration,
		reducedMotion,
		// The chef leans towards the visitor at his table: an aside, close and dry.
		(text, onStart) =>
			voices.say("chef", text, { from: chef.root, plan: "aside", onStart }),
		voiceText.spoken.narration,
	);
	// The kitchen's lines, fetched as soon as the sound is on.
	voices.preload([
		...[
			t.bubbles.coming,
			t.bubbles.service,
			t.bubbles.nothing,
			t.bubbles.invite,
			t.bubbles.bill,
			voiceText.call.table,
			...Object.values(voiceText.call.skills),
			...voiceText.spoken.narration.model,
			...voiceText.spoken.narration.steps,
		].map((text) => ({ speaker: "chef" as const, text })),
		{ speaker: "runner", text: t.bubbles.yes },
		{ speaker: "cook", text: t.bubbles.yes },
		{ speaker: "cook", text: t.bubbles.heat },
	]);

	/**
	 * The chef calls the order aloud, as in any kitchen, and each ticket line lights up as
	 * he names it. With the sound off, the ticket says the same.
	 */
	const callOrder = (result: Order) => {
		const calls = announcement(result.demand, voiceText.call);
		const lines = [...ticketList.children];
		return voices.sequence(
			calls.map((call) => ({
				speaker: "chef" as const,
				text: call.text,
				from: chef.root,
			})),
			{
				gap: 0.12,
				onEach: (index) => {
					const call = calls[index];
					bubbleSay(chef, call.text, 1.2, true);
					if (call.line !== null) lines[call.line]?.classList.add("is-called");
				},
			},
		);
	};
	let narrated = false;

	const serve = async (text: string, label: string) => {
		if (busy) return;
		if (countWords(text) < MIN_WORDS) {
			writeError.textContent = t.write.tooShort;
			return;
		}
		ordered = true;
		// The commis (a language model) starts reading now; the kitchen gets going meanwhile.
		const reading = readOffer(text, projects);
		writeDialog.close();
		setBusy(true);
		leave();
		resetStations();
		dishPanel.hidden = true;
		stage.classList.remove("is-served");
		openTicket(label);

		await wait(0.8);
		// The chef finishes his « Ça marche ! » before calling the order.
		const acknowledged = say(chef, t.bubbles.coming);
		chef.hop();
		// The brigade turns to the chef, waiting for the call.
		runner.faceTowards(chef.root.position);
		cook.faceTowards(chef.root.position);
		const outcome = await reading;
		if (!outcome.ok) {
			ticketList.replaceChildren(ticketLine("is-sent-back", t.write.noSkill));
			say(chef, t.bubbles.nothing, 2);
			setBusy(false);
			return;
		}
		const result = outcome.order;
		tasted({ kind: "order", label });
		saveVisit({ order: label });
		const source = result.source;
		fillTicket(result);
		// The chef calls the order, the brigade answers.
		chef.faceTowards(runner.root.position);
		await acknowledged;
		await callOrder(result);
		say(runner, t.bubbles.yes);
		gsap.delayedCall(0.15, () => say(cook, t.bubbles.yes));
		runner.hop();
		cook.hop();
		await wait(0.7);
		const narrate = !narrated;
		narrated = true;
		// The first order is told step by step. With the sound on, the kitchen waits for the
		// chef to finish a sentence before the next step.
		let telling: Promise<void> = Promise.resolve();
		const tell = async (index: number) => {
			if (!narrate) return;
			await telling;
			telling = narration.show(index, source);
		};
		await tell(0);
		// The first time, the kitchen leaves a moment to read the subtitles.
		await wait(narrate ? realSeconds(1.6) : 0.6);

		// The check: every line the model wrote must quote the offer, or it goes back.
		if (source === "model") {
			await tell(1);
			chef.faceTowards(kitchen.points.plate);
			await play(checkTicket());
			sound.stamp();
			await wait(narrate ? realSeconds(1.6) : 0.4);
		}

		// Retrieval: the runner fetches one jar per skill found in the order.
		if (source === "lexicon") await tell(1);
		follow(kitchen.points.pantry);
		await play(
			runner.walk([new THREE.Vector3(-3.4, 0, -3.3), kitchen.points.pantry]),
		);
		runner.faceTowards(new THREE.Vector3(-8, 0, kitchen.points.pantry.z));
		const picked = result.demand.map((d) =>
			competences.findIndex((c) => c.id === d.competence),
		);
		const jarsTl = gsap.timeline();
		picked.forEach((index, i) => {
			const jar = kitchen.jars[index];
			if (!jar) return;
			jarsTl.add(
				() =>
					(jar.material as THREE.MeshToonMaterial).emissive.setHex(0x3a2a00),
				i * 0.14,
			);
			jarsTl.to(
				jar.position,
				{
					y: (jar.userData.baseY as number) + 0.18,
					duration: 0.14,
					yoyo: true,
					repeat: 1,
				},
				i * 0.14,
			);
		});
		await play(jarsTl);
		follow(kitchen.points.stove);
		runner.carry(
			crate(
				picked.map((index) =>
					(
						kitchen.jars[index].material as THREE.MeshToonMaterial
					).color.getHex(),
				),
			),
		);
		await play(
			runner.walk([
				new THREE.Vector3(-3.4, 0, -3.3),
				new THREE.Vector3(-1.2, 0, -3.8),
			]),
		);
		runner.faceTowards(kitchen.points.stove.clone().setZ(-5));
		runner.carry(null);

		await telling;
		// Cooking: the stove roars while the stations that match light up.
		cook.faceTowards(kitchen.points.stove.clone().setZ(-5));
		const heat = { v: steam };
		const syncSteam = () => {
			steam = heat.v;
		};
		gsap.to(heat, { v: 1, duration: 0.3, onUpdate: syncSteam });
		const heated = say(cook, t.bubbles.heat);
		sound.sizzle();
		if (!frame.wide) resetCamera();
		// The chef lets the cook finish his shout before explaining.
		if (narrate) await heated;
		await tell(2);
		await play(lightStations(result));
		// Sped up, the stations light up too fast to read this step.
		if (narrate && reducedMotion) await wait(realSeconds(1.6));
		gsap.to(heat, { v: 0.25, duration: 1.2, onUpdate: syncSteam });

		// Plating: the cook brings the plate to the pass.
		const top = result.matches.filter((m) => m.coverage > 0).slice(0, 3);
		for (const child of [...plate.children])
			if (child !== dish) plate.remove(child);
		top.forEach((m, i) => {
			const runtime = stationFor(m.project);
			const food = outline(
				new THREE.Mesh(
					new THREE.SphereGeometry(0.1 + m.coverage * 0.1, 14, 12),
					toon(runtime ? FOOD[runtime.def.id] : palette.lamp),
				),
				0.015,
			);
			const angle = (i / Math.max(1, top.length)) * Math.PI * 2;
			food.position.set(Math.cos(angle) * 0.18, 0.12, Math.sin(angle) * 0.18);
			plate.add(food);
		});
		cook.setStirring(false);
		follow(kitchen.points.plate);
		cook.carry(plate.clone());
		await play(
			cook.walk([new THREE.Vector3(0.9, 0, -1.2), kitchen.points.passCook]),
		);
		cook.faceTowards(kitchen.points.plate);
		cook.carry(null);
		plate.position.copy(kitchen.points.plate);
		plate.visible = true;
		gsap.fromTo(
			plate.scale,
			{ x: 0.6, y: 0.6, z: 0.6 },
			{ x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(3)" },
		);

		// The check: the chef inspects, stamps, rings the bell.
		chef.faceTowards(kitchen.points.plate);
		await tell(3);
		await play(chef.inspect());
		// The chef finishes his sentence before calling the service.
		await telling;
		stampDiv.classList.add("is-visible");
		sound.stamp();
		gsap.delayedCall(0.25, () => sound.bell());
		say(chef, t.bubbles.service);
		chef.hop();
		await wait(0.6);
		showDish(result);
		sound.good();
		if (narrate) narration.hide(realSeconds(8));

		// Back to positions.
		void play(cook.walk([new THREE.Vector3(0.9, 0, -1.2), home.cook])).then(
			() => {
				cook.faceTowards(kitchen.points.stove.clone().setZ(-5));
				cook.setStirring(true);
			},
		);
		void play(runner.walk([home.runner]));
		setBusy(false);
	};

	// On narrow screens the whole kitchen is small: during the service, the camera follows the action.
	const follow = (point: THREE.Vector3) => {
		if (frame.wide) return;
		gsap.to(view.target, {
			x: point.x,
			y: 0.9,
			z: point.z,
			duration: cameraSeconds(0.9),
			ease: "power2.inOut",
		});
		gsap.to(view, {
			zoom: 1.7,
			shift: 0,
			duration: cameraSeconds(0.9),
			ease: "power2.inOut",
		});
	};

	// Camera moves: fly to a station, or back to the whole kitchen.
	/** A wide panel (a game) covers half the screen: the station slides further left. */
	const focusStation = (id: StationId, panel: "narrow" | "wide" = "narrow") => {
		const runtime = kitchen.stations.get(id);
		if (!runtime) return;
		const shift = frame.wide ? (panel === "wide" ? -0.25 : -0.14) : 0;
		gsap.to(view.target, {
			x: runtime.def.focus[0],
			y: runtime.def.focus[1],
			z: runtime.def.focus[2],
			duration: cameraSeconds(1.1),
			ease: "power3.inOut",
		});
		gsap.to(view, {
			zoom: panel === "wide" ? 2 : 2.3,
			shift,
			duration: cameraSeconds(1.1),
			ease: "power3.inOut",
		});
	};

	const resetCamera = () => {
		gsap.to(view.target, {
			x: 0,
			y: 0.9,
			z: 0,
			duration: cameraSeconds(1),
			ease: "power3.inOut",
		});
		gsap.to(view, {
			zoom: 1,
			shift: restShift(),
			duration: cameraSeconds(1),
			ease: "power3.inOut",
		});
	};

	// Visiting a station: the camera flies in, the panel explains the idea.
	let visiting: StationId | null = null;
	// What had the focus when the visit started: it gets it back when the visit, or its game, ends.
	let returnFocus: HTMLElement | null = null;
	const restoreFocus = (panel: HTMLElement) => {
		const active = document.activeElement;
		if (active && active !== document.body && !panel.contains(active)) return;
		const target = returnFocus?.isConnected
			? returnFocus
			: visiting
				? tags.get(visiting)
				: null;
		target?.focus({ preventScroll: true });
	};
	// The bill: every order, visit and tasting goes on it. After a few, the chef offers it.
	const bill = new Bill();
	const billDialog = element<HTMLDialogElement>(".bill");
	const billButton = element<HTMLButtonElement>(".bill-open");
	const billShared = element<HTMLElement>(".bill-shared");
	let billOffered = false;
	const tasted = (tasting: Parameters<Bill["add"]>[0]) => {
		bill.add(tasting);
		saveVisit({ bill: [...bill.lines] });
		if (billOffered || bill.size < 3) return;
		billOffered = true;
		gsap.delayedCall(4, () => {
			billButton.classList.add("is-calling");
			if (!busy) say(chef, t.bubbles.bill, 2);
		});
	};
	// Back from another page of the site: the visit goes on where it was.
	const saved = readVisit();
	const isTasting = (value: unknown): value is Tasting => {
		if (!value || typeof value !== "object") return false;
		const line = value as Record<string, unknown>;
		if (line.kind === "order") return typeof line.label === "string";
		return (
			(line.kind === "visit" || line.kind === "play") &&
			typeof line.station === "string" &&
			line.station in t.stations
		);
	};
	for (const line of saved.bill) if (isTasting(line)) bill.add(line);
	if (bill.size >= 3) {
		billOffered = true;
		billButton.classList.add("is-calling");
	}
	/** The last game at the pass: the chef's notebook explains it. */
	let lastRounds: NotebookRound[] = saved.rounds.flatMap((round) => {
		const known = rushCases.find((c) => c.id === round.id);
		return known ? [{ id: known.id, choice: round.choice }] : [];
	});

	const openBill = () => {
		const lines = bill.lines.map((tasting) => {
			const li = document.createElement("li");
			const name = document.createElement("span");
			name.textContent =
				tasting.kind === "order"
					? t.bill.order(tasting.label)
					: t.bill[tasting.kind](t.stations[tasting.station].name);
			const price = document.createElement("span");
			price.className = "bill-price";
			price.textContent = t.bill.price;
			li.append(name, price);
			return li;
		});
		element<HTMLOListElement>(".bill-lines").replaceChildren(...lines);
		element<HTMLElement>(".bill-empty").hidden = lines.length > 0;
		billShared.textContent = "";
		linkField.hidden = true;
		billButton.classList.remove("is-calling");
		billDialog.showModal();
		sound.bell();
	};
	billButton.addEventListener("click", openBill);
	// A link for the hiring manager: it skips the arrival and opens on the kitchen.
	const shareButton = element<HTMLButtonElement>(".bill-share");
	const linkField = element<HTMLInputElement>(".bill-link");
	const touch = window.matchMedia("(pointer: coarse)").matches;
	shareButton.addEventListener("click", async () => {
		const link = new URL(`${location.pathname}?cuisine`, location.origin).href;
		if (touch && navigator.share) {
			try {
				await navigator.share({ title: document.title, url: link });
				return;
			} catch {
				// Closed without sharing: fall back on the copy below.
			}
		}
		linkField.value = link;
		linkField.hidden = false;
		linkField.select();
		let copied = false;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
		} catch {
			copied = false;
		}
		billShared.textContent = copied ? t.bill.shared : t.bill.copyThis;
		if (copied) {
			shareButton.textContent = t.bill.copied;
			shareButton.classList.add("is-done");
			sound.pop();
			gsap.delayedCall(3, () => {
				shareButton.textContent = t.bill.share;
				shareButton.classList.remove("is-done");
			});
		}
	});

	const visit = (id: StationId) => {
		const runtime = kitchen.stations.get(id);
		if (!runtime || !rushPanel.hidden || !gamePanel.hidden) return;
		visiting = id;
		// Opened from the 3D scene, nothing had the focus: the station's tag will get it.
		const opener = document.activeElement;
		if (opener instanceof HTMLElement && !visitPanel.contains(opener))
			returnFocus = opener === document.body ? null : opener;
		tasted({ kind: "visit", station: id });
		const project = bySlug.get(runtime.def.slug);
		element<HTMLElement>(".visit-name").textContent = t.stations[id].name;
		element<HTMLElement>(".visit-project").textContent = project
			? `${project.title}, ${project.org}`
			: "";
		element<HTMLElement>(".visit-concept").textContent = t.stations[id].concept;
		element<HTMLElement>(".visit-summary").textContent = project?.summary ?? "";
		const link = element<HTMLAnchorElement>(".visit-play");
		// At the pass, the project is read in the chef's notebook, without leaving the kitchen.
		link.textContent = id === "pass" ? t.visit.notebook : t.visit.read;
		const rushButton = element<HTMLButtonElement>(".visit-rush");
		const soon = element<HTMLElement>(".visit-soon");
		const playable = id === "pass" || id in games;
		rushButton.textContent = id === "pass" ? t.visit.takePass : t.visit.play;
		link.hidden = !project?.href;
		rushButton.hidden = !playable;
		soon.hidden = playable;
		if (project?.href) link.href = project.href;
		visitPanel.hidden = false;
		stage.classList.add("is-visiting");
		focusStation(id);
		sound.pop();
		element<HTMLButtonElement>(".visit-back").focus({ preventScroll: true });
	};

	const leave = () => {
		if (visitPanel.hidden) return;
		visitPanel.hidden = true;
		stage.classList.remove("is-visiting");
		resetCamera();
		restoreFocus(visitPanel);
	};

	element<HTMLButtonElement>(".visit-back").addEventListener("click", leave);

	// « Coup de feu au passe » : the player decides, the chef (the real engine) judges.
	const ROUND_SECONDS = 12;
	const rushPlay = element<HTMLElement>(".rush-play");
	const rushEnd = element<HTMLElement>(".rush-end");
	const rushVerdict = element<HTMLElement>(".rush-verdict");
	const rushNext = element<HTMLButtonElement>(".rush-next");
	const rushTimer = element<HTMLElement>(".rush-timer span");
	const rushStamp = element<HTMLElement>(".rush-stamp");
	const relax = element<HTMLInputElement>(".rush-relax input");
	const choiceButtons = [
		...document.querySelectorAll<HTMLButtonElement>("[data-choice]"),
	];
	const msFormat = new Intl.NumberFormat(intlLocale[lang], {
		maximumFractionDigits: 2,
	});
	const euros = new Intl.NumberFormat(intlLocale[lang], {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	});
	let deck: ReturnType<typeof deal> = [];
	let rounds: Round[] = [];
	let roundIndex = 0;
	let roundStart = 0;
	let answered = false;
	let countdown: gsap.core.Tween | null = null;

	const pieceNames: Record<PieceId, string> = t.rush.pieces;
	const stampText: Record<Outcome, string> = t.rush.stamps;

	// As in the station games: no imposed timer under reduced motion.
	if (reducedMotion) relax.checked = true;
	// Ticking "no timer" during a case stops the clock at once.
	relax.addEventListener("change", () => {
		if (!relax.checked || answered || rushPanel.hidden) return;
		countdown?.kill();
		rushTimer.parentElement?.toggleAttribute("hidden", true);
	});

	const renderCase = (index: number) => {
		const rushCase = deck[index];
		const days = rushCase.file.delayDays;
		element<HTMLElement>(".rush-progress").textContent = t.rush.progress(
			index + 1,
			deck.length,
		);
		element<HTMLElement>(".rush-story").textContent = rushCase.story[lang];
		element<HTMLUListElement>(".rush-pieces").replaceChildren(
			...(Object.keys(pieceNames) as PieceId[]).map((piece) => {
				const li = document.createElement("li");
				const received = rushCase.file.pieces.includes(piece);
				li.dataset.received = String(received);
				li.textContent = `${received ? "✓" : "✗"} ${pieceNames[piece]}`;
				return li;
			}),
		);
		element<HTMLElement>(".rush-delay").textContent = t.rush.days(days);
		element<HTMLElement>(".rush-amount").textContent =
			rushCase.file.pieces.includes("quote")
				? euros.format(rushCase.file.quoteAmount)
				: t.rush.notReceived;
	};

	const nextRound = () => {
		answered = false;
		renderCase(roundIndex);
		rushVerdict.hidden = true;
		rushStamp.textContent = "";
		rushStamp.classList.remove("is-visible");
		for (const button of choiceButtons) button.disabled = false;
		roundStart = performance.now();
		countdown?.kill();
		rushTimer.parentElement?.toggleAttribute("hidden", relax.checked);
		if (!relax.checked) {
			countdown = gsap.fromTo(
				rushTimer,
				{ scaleX: 1 },
				{
					scaleX: 0,
					duration: realSeconds(ROUND_SECONDS),
					ease: "none",
					onComplete: () => answer(null),
				},
			);
		}
		gsap.fromTo(
			".rush-ticket",
			{ y: -24, opacity: 0 },
			{ y: 0, opacity: 1, duration: 0.35, ease: "back.out(1.8)" },
		);
		choiceButtons[0]?.focus({ preventScroll: true });
		sound.pop();
	};

	const answer = (choice: Outcome | null) => {
		if (answered) return;
		answered = true;
		countdown?.kill();
		const rushCase = deck[roundIndex];
		const verdict = judge(rushCase.file, lang);
		const seconds = (performance.now() - roundStart) / 1000;
		rounds.push({ rushCase, choice, verdict, seconds });
		const right = choice === verdict.outcome;
		for (const button of choiceButtons) button.disabled = true;

		rushStamp.textContent = stampText[verdict.outcome];
		rushStamp.classList.add("is-visible");
		sound.stamp();
		element<HTMLElement>(".rush-verdict-head").textContent = right
			? t.rush.verdict.right
			: choice === null
				? t.rush.verdict.late
				: t.rush.verdict.wrong;
		rushVerdict.dataset.right = String(right);
		element<HTMLElement>(".rush-verdict-chef").textContent =
			t.rush.verdict.chef(
				t.rush.outcomes[verdict.outcome].toLowerCase(),
				msFormat.format(verdict.ms),
			);
		element<HTMLUListElement>(".rush-reasons").replaceChildren(
			...verdict.reasons.map((reason) => {
				const li = document.createElement("li");
				li.textContent = lang === "fr" ? frTypo(reason) : reason;
				return li;
			}),
		);
		rushNext.textContent =
			roundIndex + 1 >= deck.length ? t.rush.result : t.rush.next;
		rushVerdict.hidden = false;
		rushNext.focus({ preventScroll: true });

		if (right) {
			chef.hop();
			say(chef, t.bubbles.right);
			sound.good();
		} else {
			say(chef, verdict.reasons[0] ?? t.bubbles.wrong, 2.2);
			sound.bad();
		}
	};

	const endRush = () => {
		const result = score(rounds);
		lastRounds = rounds.map((round) => ({
			id: round.rushCase.id,
			choice: round.choice,
		}));
		saveVisit({ rounds: lastRounds });
		rushPlay.hidden = true;
		rushEnd.hidden = false;
		element<HTMLElement>(".rush-progress").textContent = "";
		element<HTMLElement>(".rush-score").textContent = t.rush.score(
			result.right,
			result.total,
			Math.round(result.playerSeconds),
		);
		element<HTMLElement>(".rush-chef").textContent = t.rush.chefScore(
			result.total,
			msFormat.format(result.chefMs),
		);
		chef.hop();
		say(chef, t.bubbles.rushEnd, 2);
		sound.bell();
		element<HTMLButtonElement>(".rush-again").focus({ preventScroll: true });
	};

	const startRush = () => {
		if (busy) return;
		tasted({ kind: "play", station: "pass" });
		visitPanel.hidden = true;
		stage.classList.remove("is-visiting");
		stage.classList.add("is-rushing");
		labels.domElement.inert = true;
		focusStation("pass", "wide");
		chef.faceTowards(kitchen.points.plate);
		deck = deal();
		rounds = [];
		roundIndex = 0;
		rushPanel.hidden = false;
		rushPlay.hidden = false;
		rushEnd.hidden = true;
		say(chef, t.bubbles.rushStart, 1.6);
		nextRound();
	};

	const quitRush = () => {
		if (rushPanel.hidden) return;
		countdown?.kill();
		rushPanel.hidden = true;
		stage.classList.remove("is-rushing");
		labels.domElement.inert = false;
		resetCamera();
		restoreFocus(rushPanel);
	};

	// The other stations: each game is loaded on demand and renders into a shared panel.
	const gameBody = element<HTMLElement>(".game-body");
	let gameCleanup: (() => void) | null = null;

	const closeGame = () => {
		if (gamePanel.hidden) return;
		gameCleanup?.();
		gameCleanup = null;
		gamePanel.hidden = true;
		gameBody.replaceChildren();
		stage.classList.remove("is-rushing");
		labels.domElement.inert = false;
		resetCamera();
		restoreFocus(gamePanel);
	};

	const openGame = async (id: StationId) => {
		const load = games[id];
		if (!load || busy) return;
		tasted({ kind: "play", station: id });
		visitPanel.hidden = true;
		stage.classList.remove("is-visiting");
		stage.classList.add("is-rushing");
		labels.domElement.inert = true;
		focusStation(id, "wide");
		const { game } = await load();
		element<HTMLElement>(".game-title").textContent = game.title[lang];
		element<HTMLElement>(".game-intro").textContent = game.intro[lang];
		gameBody.replaceChildren();
		gamePanel.hidden = false;
		gameCleanup = game.mount(gameBody, {
			lang,
			sound,
			say: (text) => say(chef, text, 2),
			close: closeGame,
			reducedMotion,
		});
		element<HTMLButtonElement>(".game-quit").focus({ preventScroll: true });
	};

	element<HTMLButtonElement>(".game-quit").addEventListener("click", closeGame);
	element<HTMLButtonElement>(".visit-rush").addEventListener("click", () => {
		if (visiting === "pass") startRush();
		else if (visiting) void openGame(visiting);
	});
	element<HTMLButtonElement>(".rush-quit").addEventListener("click", quitRush);
	element<HTMLButtonElement>(".rush-again").addEventListener(
		"click",
		startRush,
	);
	rushNext.addEventListener("click", () => {
		roundIndex++;
		if (roundIndex >= deck.length) endRush();
		else nextRound();
	});
	for (const button of choiceButtons) {
		button.addEventListener("click", () =>
			answer(button.dataset.choice as Outcome),
		);
	}

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			if (billDialog.open || writeDialog.open || notebook?.isOpen) return;
			if (!rushPanel.hidden) quitRush();
			else if (!gamePanel.hidden) closeGame();
			else leave();
			return;
		}
		const playing = !rushPanel.hidden && !rushPlay.hidden && !answered;
		if (playing && ["1", "2", "3"].includes(event.key)) {
			choiceButtons[Number(event.key) - 1]?.click();
		}
	});

	// Sound, off by default: the corner's toggle, and the phone's during the arrival.
	const soundButtons = [
		element<HTMLButtonElement>(".sound-toggle"),
		...document.querySelectorAll<HTMLButtonElement>(".arrival-sound"),
	];
	const captionsToggle = element<HTMLButtonElement>(".captions-toggle");
	const toggleSound = () => {
		if (sound.enabled) sound.disable();
		else sound.enable();
		for (const button of soundButtons) {
			button.setAttribute("aria-pressed", String(sound.enabled));
			button.textContent = sound.enabled ? t.sound.disable : t.sound.enable;
		}
		// Subtitles only mean something once the voices speak.
		captionsToggle.hidden = !sound.enabled;
		if (sound.enabled) sound.bell();
	};
	for (const button of soundButtons)
		button.addEventListener("click", toggleSound);
	// With the sound on, the voice says the sentence and the screen keeps the word:
	// subtitles bring the sentences back.
	const setCaptions = (on: boolean) => {
		stage.classList.toggle("has-captions", on);
		captionsToggle.setAttribute("aria-pressed", String(on));
		try {
			window.localStorage.setItem("brigade.captions", on ? "1" : "0");
		} catch {
			// Private browsing: the choice lasts for this visit.
		}
	};
	try {
		setCaptions(window.localStorage.getItem("brigade.captions") === "1");
	} catch {
		setCaptions(false);
	}
	captionsToggle.addEventListener("click", () =>
		setCaptions(!stage.classList.contains("has-captions")),
	);

	// Until the first order, the chef invites the visitor now and then.
	let ordered = saved.order !== null;
	const invite = () => {
		if (
			!ordered &&
			!busy &&
			visitPanel.hidden &&
			rushPanel.hidden &&
			gamePanel.hidden
		) {
			say(chef, t.bubbles.invite, 1.8);
			chef.hop();
		}
		if (!ordered) gsap.delayedCall(9, invite);
	};

	for (const button of orderButtons) {
		button.addEventListener("click", () => {
			const preset = presets.find((p) => p.id === button.dataset.order);
			if (preset) void serve(preset.text[lang], preset.label[lang]);
		});
	}
	element<HTMLButtonElement>(".order-write").addEventListener("click", () => {
		writeError.textContent = "";
		writeDialog.showModal();
		writeText.focus();
	});
	element<HTMLFormElement>(".write form").addEventListener(
		"submit",
		(event) => {
			event.preventDefault();
			const words = writeText.value.trim().split(/\s+/).length;
			void serve(writeText.value, t.write.ticketTitle(words));
		},
	);
	element<HTMLButtonElement>(".write-cancel").addEventListener("click", () =>
		writeDialog.close(),
	);

	// The tour points at stations: their rings light up one after the other.
	const spotlight = (ids: StationId[]) => {
		let delay = 0;
		for (const runtime of kitchen.stations.values()) {
			const on = ids.includes(runtime.def.id);
			tags.get(runtime.def.id)?.classList.toggle("is-lit", on);
			if (on) lit.add(runtime.def.id);
			else lit.delete(runtime.def.id);
			gsap.to(runtime.ring.material, {
				opacity: on ? 0.4 : 0,
				duration: 0.4,
				delay: on ? delay : 0,
			});
			if (on) {
				gsap.fromTo(
					runtime.ring.scale,
					{ x: 0.3, y: 0.3 },
					{ x: 1, y: 1, duration: 0.6, delay, ease: "back.out(2)" },
				);
				delay += 0.15;
			}
		}
	};

	// The arrival comes last, so the very first frame already shows the street.
	const screenPoint = new THREE.Vector3();
	const opening = arriving
		? arrive(
				{
					scene,
					camera,
					canvas,
					stage,
					view,
					frame,
					hemi,
					sun,
					sound,
					voices,
					// The terrace's exchanges, each line with its voice.
					murmurs: voiceText.street.map((exchange, i) =>
						exchange.flatMap((text, j) => {
							const speaker = STREET_VOICES[lang][i]?.[j];
							return text && speaker ? [{ speaker, text }] : [];
						}),
					),
					spoken: voiceText.spoken,
					brigade: { chef, runner, cook },
					guest,
					onFrame: (hook) => {
						frameHooks.add(hook);
						return () => frameHooks.delete(hook);
					},
					say,
					spotlight,
					rest: () => ({
						target: new THREE.Vector3(0, 0.9, 0),
						zoom: 1,
						shift: restShift(),
						direction: REST_DIRECTION.clone(),
					}),
					toScreen: (point) => {
						screenPoint.copy(point).project(camera);
						return {
							x: ((screenPoint.x + 1) / 2) * stage.clientWidth,
							y: ((1 - screenPoint.y) / 2) * stage.clientHeight,
						};
					},
					reducedMotion,
				},
				prologueCopy[lang],
			)
		: Promise.resolve();
	/**
	 * The chef's notebook: how the agent at the pass decided the claims the visitor just
	 * judged. Loaded the first time it opens.
	 */
	let notebook: Notebook | null = null;
	const chefHands = new THREE.Vector3();
	const openNotebook = async () => {
		if (busy || notebook?.isOpen) return;
		const { createNotebook } = await import("./notebook/notebook");
		notebook ??= createNotebook({
			stage,
			lang,
			reducedMotion,
			sound,
			voices,
			spoken: voiceText.notebook,
			chef,
			chefOnScreen: () => {
				chef.root.getWorldPosition(chefHands);
				chefHands.y += 1.1;
				chefHands.project(camera);
				return {
					x: ((chefHands.x + 1) / 2) * stage.clientWidth,
					y: ((1 - chefHands.y) / 2) * stage.clientHeight,
				};
			},
			projectHref: bySlug.get("claims-agent")?.href ?? "",
			onClose: () => chef.faceTowards(kitchen.points.plate),
		});
		chef.faceTowards(guest.root.position);
		chef.hop();
		await notebook.open(lastRounds);
	};
	element<HTMLButtonElement>(".rush-notebook").addEventListener("click", () => {
		void openNotebook();
	});
	element<HTMLAnchorElement>(".visit-play").addEventListener(
		"click",
		(event) => {
			if (visiting !== "pass") return;
			event.preventDefault();
			void openNotebook();
		},
	);

	// After the tour the chef has just asked for an order: the next invitation can wait.
	const firstVisit = arriving;
	void opening.then(() => {
		arriving = false;
		// Back from the project page: the notebook opens again, where the visitor left it.
		if (new URLSearchParams(window.location.search).has("carnet")) {
			window.history.replaceState(null, "", window.location.pathname);
			gsap.delayedCall(0.8, () => void openNotebook());
		}
		// The tour's balloon left with the focus: the first order takes it.
		if (firstVisit && document.activeElement === document.body)
			orderButtons[0]?.focus({ preventScroll: true });
		gsap.delayedCall(firstVisit ? 9 : 3, invite);
	});
}
