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
import { competenceById, competences } from "../../lib/offer/competences";
import { type Analysis, analyze } from "../../lib/offer/engine";
import { presets } from "../../lib/offer/presets";
import type { ProjectCard } from "../../lib/projects";
import { frTypo } from "../../lib/typo";
import { Cook, crate } from "./cook";
import { games } from "./games";
import { buildKitchen, type StationRuntime } from "./kitchen";
import { deal, judge, outcomeLabel, type Round, score } from "./rush";
import { Sound } from "./sound";
import type { StationId } from "./stations";
import { outline, palette, toon } from "./toon";

const FOOD: Record<StationId, number> = {
	pass: palette.check,
	delivery: palette.wood,
	library: palette.model,
	coldroom: 0x3f8f8a,
	pastry: 0xf2a7b8,
	tools: palette.copper,
};

const reducedMotion = window.matchMedia(
	"(prefers-reduced-motion: reduce)",
).matches;
const wait = (seconds: number) =>
	new Promise<void>((resolve) => gsap.delayedCall(seconds, resolve));
// Uses the promise GSAP exposes, so the animation keeps its own onComplete callback.
const play = (tl: gsap.core.Timeline | gsap.core.Tween) =>
	tl.then(() => undefined);
const percent = (v: number) =>
	new Intl.NumberFormat("fr-FR", {
		style: "percent",
		maximumFractionDigits: 0,
	}).format(v);

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
	const projects = readProjects();
	const bySlug = new Map(projects.map((p) => [p.slug, p]));
	const stage = element<HTMLDivElement>(".brigade-stage");
	typesetStatic(stage);
	const canvas = element<HTMLCanvasElement>("#brigade-canvas");

	// Renderer, scene, camera.
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
	const view = { target: new THREE.Vector3(0, 0.9, 0), zoom: 1, shift: 0 };
	const frame = { halfW: 1, halfH: 1, wide: false };
	const restShift = () => (frame.wide ? 0.1 : 0);
	const pointer = new THREE.Vector2();
	const direction = new THREE.Vector3(1, 0.86, 1).normalize();

	scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a3b35, 1.6));
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
	cook.setStirring(true);
	const sound = new Sound();

	const bubble = (cookObj: Cook) => {
		const div = document.createElement("div");
		div.className = "bubble";
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
	const say = (who: Cook, text: string, seconds = 1.4) => {
		const div = bubbles.get(who);
		if (!div) return;
		div.textContent = frTypo(text);
		div.classList.add("is-visible");
		gsap.delayedCall(seconds, () => div.classList.remove("is-visible"));
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
			runtime.def.name;
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
	stampDiv.textContent = "Vérifié";
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
		if (visitPanel.hidden) view.shift = restShift();
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
		camera.far = 100;
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
		const id = stationAt(toNdc(event));
		if (id) visit(id);
	});

	const updateHover = () => {
		const id = pointerInside ? stationAt(pointerNdc) : null;
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

	// Render loop.
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
		camera.position.copy(target).addScaledVector(direction, 30);
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

	const setBusy = (value: boolean) => {
		busy = value;
		for (const b of orderButtons) b.disabled = value;
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

	const showTicket = (label: string, result: Analysis) => {
		orderNumber++;
		element<HTMLElement>(".ticket-number").textContent =
			`Commande n° ${String(orderNumber).padStart(3, "0")}`;
		element<HTMLElement>(".ticket-title").textContent = label;
		const list = element<HTMLOListElement>(".ticket-lines");
		list.replaceChildren(
			...result.demand.map((d) => {
				const li = document.createElement("li");
				const qty = document.createElement("span");
				qty.textContent = `${d.count} ×`;
				li.append(
					qty,
					` ${competenceById.get(d.competence)?.label.fr ?? d.competence}`,
				);
				return li;
			}),
		);
		element<HTMLElement>(".ticket-foot").textContent =
			`${result.words} mots lus, ${result.evidence.length} mentions relevées`;
		ticket.hidden = false;
		gsap.fromTo(
			ticket,
			{ yPercent: -110 },
			{ yPercent: 0, duration: 0.7, ease: "steps(8)" },
		);
		gsap.fromTo(
			list.children,
			{ opacity: 0 },
			{ opacity: 1, stagger: 0.08, delay: 0.5 },
		);
	};

	const lightStations = (result: Analysis) => {
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

	const showDish = (result: Analysis) => {
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
					meta.textContent = `${runtime?.def.name ?? ""}, ${percent(m.coverage)} de votre commande`;
					button.append(title, meta);
					if (runtime)
						button.addEventListener("click", () => visit(runtime.def.id));
					li.append(button);
					return li;
				}),
		);
		dishPanel.hidden = false;
		stage.classList.add("is-served");
		gsap.fromTo(
			dishPanel,
			{ y: 30, opacity: 0 },
			{ y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)" },
		);
	};

	const serve = async (text: string, label: string) => {
		if (busy) return;
		ordered = true;
		const result = analyze(text, projects);
		if (!result.ok) {
			writeError.textContent =
				result.reason === "too-short"
					? "La commande est trop courte : il faut au moins 20 mots."
					: "La brigade ne reconnaît aucun ingrédient dans cette commande. Collez la description du poste.";
			return;
		}
		writeDialog.close();
		setBusy(true);
		leave();
		resetStations();
		dishPanel.hidden = true;
		stage.classList.remove("is-served");
		showTicket(label, result);

		await wait(0.8);
		chef.faceTowards(runner.root.position);
		say(chef, "Ça marche !");
		chef.hop();
		await wait(0.7);
		say(runner, "Oui chef !");
		say(cook, "Oui chef !");
		runner.hop();
		cook.hop();
		await wait(0.6);

		// Retrieval: the runner fetches one jar per skill found in the order.
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

		// Cooking: the stove roars while the stations that match light up.
		cook.faceTowards(kitchen.points.stove.clone().setZ(-5));
		const heat = { v: steam };
		const syncSteam = () => {
			steam = heat.v;
		};
		gsap.to(heat, { v: 1, duration: 0.3, onUpdate: syncSteam });
		say(cook, "Ça chauffe !");
		sound.sizzle();
		if (!frame.wide) resetCamera();
		await play(lightStations(result));
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
		await play(chef.inspect());
		stampDiv.classList.add("is-visible");
		sound.stamp();
		gsap.delayedCall(0.25, () => sound.bell());
		say(chef, "Service !");
		chef.hop();
		await wait(0.6);
		showDish(result);
		sound.good();

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
			duration: 0.9,
			ease: "power2.inOut",
		});
		gsap.to(view, { zoom: 1.7, shift: 0, duration: 0.9, ease: "power2.inOut" });
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
			duration: 1.1,
			ease: "power3.inOut",
		});
		gsap.to(view, {
			zoom: panel === "wide" ? 2 : 2.3,
			shift,
			duration: 1.1,
			ease: "power3.inOut",
		});
	};

	const resetCamera = () => {
		gsap.to(view.target, {
			x: 0,
			y: 0.9,
			z: 0,
			duration: 1,
			ease: "power3.inOut",
		});
		gsap.to(view, {
			zoom: 1,
			shift: restShift(),
			duration: 1,
			ease: "power3.inOut",
		});
	};

	// Visiting a station: the camera flies in, the panel explains the idea.
	let visiting: StationId | null = null;
	const visit = (id: StationId) => {
		const runtime = kitchen.stations.get(id);
		if (!runtime || !rushPanel.hidden || !gamePanel.hidden) return;
		visiting = id;
		const project = bySlug.get(runtime.def.slug);
		element<HTMLElement>(".visit-name").textContent = runtime.def.name;
		element<HTMLElement>(".visit-project").textContent = project
			? `${project.title}, ${project.org}`
			: "";
		element<HTMLElement>(".visit-concept").textContent = runtime.def.concept;
		element<HTMLElement>(".visit-summary").textContent = project?.summary ?? "";
		const link = element<HTMLAnchorElement>(".visit-play");
		const rushButton = element<HTMLButtonElement>(".visit-rush");
		const soon = element<HTMLElement>(".visit-soon");
		const playable = id === "pass" || id in games;
		rushButton.textContent =
			id === "pass" ? "Prendre le passe" : "Jouer à ce poste";
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
	const msFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
	const euros = new Intl.NumberFormat("fr-FR", {
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

	const pieceNames: Record<PieceId, string> = {
		declaration: "Déclaration de sinistre",
		photos: "Photos des dégâts",
		quote: "Devis de réparation",
		statement: "Attestation du voisin",
	};
	const stampText: Record<Outcome, string> = {
		offer: "Indemnisé",
		missing: "Pièce réclamée",
		escalation: "Transmis",
	};

	const renderCase = (index: number) => {
		const rushCase = deck[index];
		const days = rushCase.file.delayDays;
		element<HTMLElement>(".rush-progress").textContent =
			`Dossier ${index + 1} sur ${deck.length}`;
		element<HTMLElement>(".rush-story").textContent = rushCase.story;
		element<HTMLUListElement>(".rush-pieces").replaceChildren(
			...(Object.keys(pieceNames) as PieceId[]).map((piece) => {
				const li = document.createElement("li");
				const received = rushCase.file.pieces.includes(piece);
				li.dataset.received = String(received);
				li.textContent = `${received ? "✓" : "✗"} ${pieceNames[piece]}`;
				return li;
			}),
		);
		element<HTMLElement>(".rush-delay").textContent =
			`${days} jour${days > 1 ? "s" : ""}`;
		element<HTMLElement>(".rush-amount").textContent =
			rushCase.file.pieces.includes("quote")
				? euros.format(rushCase.file.quoteAmount)
				: "non reçu";
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
					duration: ROUND_SECONDS,
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
		const verdict = judge(rushCase.file);
		const seconds = (performance.now() - roundStart) / 1000;
		rounds.push({ rushCase, choice, verdict, seconds });
		const right = choice === verdict.outcome;
		for (const button of choiceButtons) button.disabled = true;

		rushStamp.textContent = stampText[verdict.outcome];
		rushStamp.classList.add("is-visible");
		sound.stamp();
		element<HTMLElement>(".rush-verdict-head").textContent = frTypo(
			right
				? "Bien vu : même décision que le chef."
				: choice === null
					? "Trop tard : le chef a tranché sans vous."
					: "Pas tout à fait.",
		);
		rushVerdict.dataset.right = String(right);
		element<HTMLElement>(".rush-verdict-chef").textContent = frTypo(
			`Le chef : ${outcomeLabel[verdict.outcome].toLowerCase()}, en ${msFormat.format(verdict.ms)} ms.`,
		);
		element<HTMLUListElement>(".rush-reasons").replaceChildren(
			...verdict.reasons.map((reason) => {
				const li = document.createElement("li");
				li.textContent = frTypo(reason);
				return li;
			}),
		);
		rushNext.textContent =
			roundIndex + 1 >= deck.length ? "Voir le résultat" : "Dossier suivant";
		rushVerdict.hidden = false;
		rushNext.focus({ preventScroll: true });

		if (right) {
			chef.hop();
			say(chef, "Bien vu !");
			sound.good();
		} else {
			say(chef, verdict.reasons[0] ?? "Non !", 2.2);
			sound.bad();
		}
	};

	const endRush = () => {
		const result = score(rounds);
		const plural = result.right > 1 ? "s" : "";
		rushPlay.hidden = true;
		rushEnd.hidden = false;
		element<HTMLElement>(".rush-progress").textContent = "";
		element<HTMLElement>(".rush-score").textContent = frTypo(
			`Vous : ${result.right} bonne${plural} décision${plural} sur ${result.total}, en ${Math.round(result.playerSeconds)} s.`,
		);
		element<HTMLElement>(".rush-chef").textContent = frTypo(
			`Le chef, c'est-à-dire l'agent : ${result.total} sur ${result.total}, en ${msFormat.format(result.chefMs)} ms au total, avec la raison de chaque décision. C'est tout l'intérêt d'un agent auditable : il applique le règlement à chaque fois, et il dit pourquoi.`,
		);
		chef.hop();
		say(chef, "Service terminé !", 2);
		sound.bell();
		element<HTMLButtonElement>(".rush-again").focus({ preventScroll: true });
	};

	const startRush = () => {
		if (busy) return;
		visitPanel.hidden = true;
		stage.classList.remove("is-visiting");
		stage.classList.add("is-rushing");
		focusStation("pass", "wide");
		chef.faceTowards(kitchen.points.plate);
		deck = deal();
		rounds = [];
		roundIndex = 0;
		rushPanel.hidden = false;
		rushPlay.hidden = false;
		rushEnd.hidden = true;
		say(chef, "À vous le passe !", 1.6);
		nextRound();
	};

	const quitRush = () => {
		if (rushPanel.hidden) return;
		countdown?.kill();
		rushPanel.hidden = true;
		stage.classList.remove("is-rushing");
		resetCamera();
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
		resetCamera();
	};

	const openGame = async (id: StationId) => {
		const load = games[id];
		if (!load || busy) return;
		visitPanel.hidden = true;
		stage.classList.remove("is-visiting");
		stage.classList.add("is-rushing");
		focusStation(id, "wide");
		const { game } = await load();
		element<HTMLElement>(".game-title").textContent = frTypo(game.title);
		element<HTMLElement>(".game-intro").textContent = frTypo(game.intro);
		gameBody.replaceChildren();
		gamePanel.hidden = false;
		gameCleanup = game.mount(gameBody, {
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

	// Sound, off by default.
	const soundToggle = element<HTMLButtonElement>(".sound-toggle");
	soundToggle.addEventListener("click", () => {
		if (sound.enabled) sound.disable();
		else sound.enable();
		soundToggle.setAttribute("aria-pressed", String(sound.enabled));
		soundToggle.textContent = sound.enabled
			? "Couper le son"
			: "Activer le son";
		if (sound.enabled) sound.bell();
	});

	// Until the first order, the chef invites the visitor now and then.
	let ordered = false;
	const invite = () => {
		if (
			!ordered &&
			!busy &&
			visitPanel.hidden &&
			rushPanel.hidden &&
			gamePanel.hidden
		) {
			say(chef, "Une commande ?", 1.8);
			chef.hop();
		}
		if (!ordered) gsap.delayedCall(9, invite);
	};
	gsap.delayedCall(3, invite);

	for (const button of orderButtons) {
		button.addEventListener("click", () => {
			const preset = presets.find((p) => p.id === button.dataset.order);
			if (preset) void serve(preset.text.fr, preset.label.fr);
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
			void serve(writeText.value, `Votre offre (${words} mots)`);
		},
	);
	element<HTMLButtonElement>(".write-cancel").addEventListener("click", () =>
		writeDialog.close(),
	);
}
