import * as THREE from "three";
import { competences } from "../../lib/offer/competences";
import { type StationDef, type StationId, stations } from "./stations";
import {
	block,
	checkerTexture,
	cylinder,
	metroTileTexture,
	outline,
	palette,
	toon,
} from "./toon";

const JAR_COLORS = [
	0xd9483b, 0x4f9d4a, 0xf2c230, 0x6b3f7a, 0xe8812f, 0xe9e1cf, 0x7d8a3a,
	0xb5412c, 0x9b8ac4, 0x3f8f8a,
];

export interface StationRuntime {
	def: StationDef;
	group: THREE.Group;
	ring: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
}

export interface Kitchen {
	group: THREE.Group;
	jars: THREE.Mesh[];
	stations: Map<StationId, StationRuntime>;
	potTops: THREE.Vector3[];
	points: {
		pantry: THREE.Vector3;
		stove: THREE.Vector3;
		stoveCook: THREE.Vector3;
		chef: THREE.Vector3;
		passCook: THREE.Vector3;
		plate: THREE.Vector3;
		stamp: THREE.Vector3;
	};
}

export function buildKitchen(): Kitchen {
	const group = new THREE.Group();
	const add = (...objects: THREE.Object3D[]) => group.add(...objects);

	// Diorama base and bistro floor.
	add(block(16.6, 0.7, 11.6, 0x3b2a20, 0, 0, -0.7));
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(16, 11),
		toon(0xffffff, { map: checkerTexture(11) }),
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = 0.002;
	floor.receiveShadow = true;
	add(floor);

	// Cutaway walls: metro tiles above a bottle-green band.
	const backTiles = toon(0xffffff, { map: metroTileTexture(20, 8) });
	const sideTiles = toon(0xffffff, { map: metroTileTexture(14, 8) });
	add(block(16.6, 3.4, 0.3, 0, 0, -5.65, 0, backTiles));
	add(block(0.3, 3.4, 11.6, 0, -8.15, 0, 0, sideTiles));
	add(block(16.6, 1.0, 0.34, palette.band, 0, -5.62));
	add(block(0.34, 1.0, 11.6, palette.band, -8.12, 0));

	// Back-wall window onto Lyon at night: Fourvière hill, its basilica and the metal tower.
	add(block(1.75, 1.4, 0.36, palette.woodDark, 2.85, -5.6, 1.55));
	const view = new THREE.Mesh(
		new THREE.PlaneGeometry(1.5, 1.15),
		new THREE.MeshBasicMaterial({ map: lyonTexture() }),
	);
	view.position.set(2.85, 2.25, -5.41);
	add(view);
	add(block(0.05, 1.15, 0.05, palette.woodDark, 2.85, -5.4, 1.68));

	// Warm pools of light under the pass lamps and above the stove.
	const passLight = new THREE.PointLight(0xffb45a, 7, 6, 2);
	passLight.position.set(1.3, 2.6, 2.9);
	const stoveLight = new THREE.PointLight(0xff9a40, 5, 5, 2);
	stoveLight.position.set(-0.4, 2.2, -4.2);
	group.add(passLight, stoveLight);

	const jars = buildPantry(add);
	const potTops = buildStove(add);

	const stationGroups = new Map<StationId, THREE.Group>();
	const stationGroup = (id: StationId) => {
		const g = new THREE.Group();
		g.userData.station = id;
		stationGroups.set(id, g);
		group.add(g);
		return g;
	};

	buildTools(stationGroup("tools"));
	buildLibrary(stationGroup("library"));
	buildPastry(stationGroup("pastry"));
	buildDelivery(stationGroup("delivery"));
	buildColdRoom(stationGroup("coldroom"));
	buildPass(stationGroup("pass"));

	const runtime = new Map<StationId, StationRuntime>();
	for (const def of stations) {
		const ring = new THREE.Mesh(
			new THREE.CircleGeometry(1.25, 40),
			new THREE.MeshBasicMaterial({
				color: palette.lamp,
				transparent: true,
				opacity: 0,
				depthWrite: false,
			}),
		);
		ring.rotation.x = -Math.PI / 2;
		ring.position.set(def.ring[0], 0.01, def.ring[2]);
		group.add(ring);
		const g = stationGroups.get(def.id);
		if (g) runtime.set(def.id, { def, group: g, ring });
	}

	return {
		group,
		jars,
		stations: runtime,
		potTops,
		points: {
			pantry: new THREE.Vector3(-6.6, 0, -1.8),
			stove: new THREE.Vector3(-0.4, 0, -3.8),
			stoveCook: new THREE.Vector3(0.9, 0, -3.8),
			chef: new THREE.Vector3(1.3, 0, 1.7),
			passCook: new THREE.Vector3(-0.2, 0, 1.9),
			plate: new THREE.Vector3(0.7, 1.04, 2.9),
			stamp: new THREE.Vector3(-0.4, 1.5, 3.6),
		},
	};
}

/** Garde-manger: one jar per skill of the lexicon, 3 shelves of 7. */
function buildPantry(add: (...o: THREE.Object3D[]) => void): THREE.Mesh[] {
	const x = -7.45;
	add(block(0.75, 2.5, 0.08, palette.woodDark, x, -4.2));
	add(block(0.75, 2.5, 0.08, palette.woodDark, x, 0.35));
	const levels = [0.08, 0.85, 1.62, 2.38];
	for (const y of levels)
		add(block(0.75, 0.07, 4.6, palette.wood, x, -1.93, y));
	const jars: THREE.Mesh[] = [];
	competences.forEach((_, i) => {
		const row = Math.floor(i / 7);
		const col = i % 7;
		const jar = cylinder(
			0.19,
			0.46,
			JAR_COLORS[i % JAR_COLORS.length],
			x,
			-3.85 + col * 0.63,
			levels[row] + 0.07,
		);
		jar.add(
			(() => {
				const lid = cylinder(0.2, 0.08, palette.woodDark, 0, 0, 0.23);
				lid.position.y = 0.27;
				return lid;
			})(),
		);
		jar.userData.baseY = jar.position.y;
		jars.push(jar);
		add(jar);
	});
	return jars;
}

/** Le piano: stove, copper pots and a hood. */
function buildStove(add: (...o: THREE.Object3D[]) => void): THREE.Vector3[] {
	add(block(4.2, 0.9, 1.2, palette.steelDark, -0.4, -4.8));
	add(block(4.3, 0.07, 1.25, palette.ink, -0.4, -4.8, 0.9));
	add(block(4.6, 0.55, 1.3, palette.steel, -0.4, -4.85, 2.55));
	add(block(1.2, 0.3, 0.5, palette.steel, -0.4, -5.2, 3.1));
	const tops: THREE.Vector3[] = [];
	for (const [i, x] of [-1.9, -0.9, 0.1, 1.1].entries()) {
		const h = i % 2 === 0 ? 0.5 : 0.36;
		add(cylinder(0.36, h, palette.copper, x, -4.75, 0.97));
		tops.push(new THREE.Vector3(x, 0.97 + h, -4.75));
	}
	return tops;
}

/** Batterie de cuisine: a rail of copper pans over a workbench. */
function buildTools(g: THREE.Group) {
	g.add(block(2.8, 0.9, 0.8, palette.steel, -4.8, -4.95));
	g.add(block(2.9, 0.06, 0.85, palette.steelTop, -4.8, -4.95, 0.9));
	g.add(block(2.8, 0.06, 0.06, palette.steelDark, -4.8, -5.35, 2.15));
	for (const [i, x] of [-5.9, -5.2, -4.5, -3.8].entries()) {
		const pan = new THREE.Mesh(
			new THREE.CylinderGeometry(0.28 - i * 0.03, 0.28 - i * 0.03, 0.06, 24),
			toon(palette.copper),
		);
		pan.rotation.x = Math.PI / 2;
		pan.position.set(x, 1.72 - i * 0.04, -5.3);
		g.add(outline(pan, 0.02));
		g.add(block(0.04, 0.3, 0.04, palette.steelDark, x, -5.3, 1.9));
	}
	// A laptop on the bench: the internal libraries and SDK live here.
	g.add(block(0.7, 0.04, 0.5, palette.ink, -4.3, -4.9, 0.96));
	const screen = block(0.7, 0.45, 0.04, palette.ink, -4.3, -5.13, 0.98);
	screen.rotation.x = -0.25;
	g.add(screen);
}

/** Bibliothèque de recettes: shelves of cookbooks and an open illustrated book. */
function buildLibrary(g: THREE.Group) {
	g.add(block(3.2, 2.9, 0.5, palette.woodDark, 5.4, -5.2));
	const colors = [
		0x2c5f9e, 0xc0392b, 0xe0a82e, 0x2f5d4e, 0x6b3f7a, 0xd9d4c7, 0x3f8f8a,
	];
	for (const [row, y] of [0.35, 1.1, 1.85].entries()) {
		g.add(block(3.0, 0.06, 0.46, palette.wood, 5.4, -5.0, y - 0.06));
		let x = 4.0;
		let i = row * 3;
		while (x < 6.75) {
			const w = 0.16 + ((i * 37) % 7) * 0.02;
			const h = 0.5 + ((i * 53) % 5) * 0.05;
			g.add(block(w, h, 0.34, colors[i % colors.length], x + w / 2, -4.98, y));
			x += w + 0.03;
			i++;
		}
	}
	// Lectern with the open book (a diagram page drawn on canvas).
	g.add(block(0.2, 1.0, 0.2, palette.woodDark, 5.3, -3.5));
	const page = new THREE.Mesh(
		new THREE.BoxGeometry(1.1, 0.05, 0.75),
		toon(0xffffff, { map: bookTexture() }),
	);
	page.position.set(5.3, 1.1, -3.5);
	page.rotation.x = -0.35;
	g.add(outline(page, 0.02));
}

/** Pâtisserie: a marble table with real cakes and their synthetic twins. */
function buildPastry(g: THREE.Group) {
	g.add(block(3.0, 0.9, 1.6, palette.steel, -3.3, 1.7));
	g.add(block(3.1, 0.08, 1.7, palette.marble, -3.3, 1.7, 0.9));
	const flavours: [number, number][] = [
		[0xf2a7b8, 0xffffff],
		[0x6b3e26, 0xf4e1c1],
		[0x9cc27a, 0xf2f1ec],
	];
	flavours.forEach(([base, top], i) => {
		for (const [j, dz] of [-0.35, 0.35].entries()) {
			const x = -4.3 + i * 1.0;
			const cake = cylinder(0.3, 0.32, base, x, 1.7 + dz, 0.98, 24);
			const icing = cylinder(0.31, 0.07, top, 0, 0, 0);
			icing.position.y = 0.2;
			cake.add(icing);
			// The synthetic twin is slightly off: same look, not the same cake.
			if (j === 1) cake.scale.set(0.94, 1.05, 0.94);
			g.add(cake);
		}
	});
}

/** Livraisons: a back door, a delivery of crates and a clipboard. */
function buildDelivery(g: THREE.Group) {
	g.add(block(0.4, 2.6, 1.6, palette.woodDark, -7.95, 3.4));
	const door = block(0.1, 2.4, 1.3, palette.band, -7.4, 4.3);
	door.rotation.y = -0.9;
	g.add(door);
	const crate = (x: number, z: number, y: number) => {
		g.add(block(0.8, 0.5, 0.6, palette.wood, x, z, y));
		g.add(block(0.82, 0.06, 0.62, palette.woodDark, x, z, y + 0.3));
	};
	crate(-6.9, 2.8, 0);
	crate(-6.9, 2.8, 0.52);
	crate(-6.0, 3.3, 0);
	g.add(block(0.4, 0.55, 0.05, 0xffffff, -6.0, 3.6, 0.55));
}

/** Cuisine fermée: a glass cold room where the documents never leave. */
function buildColdRoom(g: THREE.Group) {
	const [x0, x1, z0, z1, h] = [4.8, 7.6, 1.2, 4.4, 2.4];
	const glass = toon(palette.glass, {
		transparent: true,
		opacity: 0.32,
		depthWrite: false,
	});
	for (const [x, z] of [
		[x0, z0],
		[x1, z0],
		[x0, z1],
		[x1, z1],
	]) {
		g.add(block(0.08, h, 0.08, palette.steel, x, z));
	}
	g.add(block(x1 - x0, 0.08, 0.08, palette.steel, (x0 + x1) / 2, z0, h));
	g.add(block(x1 - x0, 0.08, 0.08, palette.steel, (x0 + x1) / 2, z1, h));
	g.add(block(0.08, 0.08, z1 - z0, palette.steel, x0, (z0 + z1) / 2, h));
	g.add(block(0.08, 0.08, z1 - z0, palette.steel, x1, (z0 + z1) / 2, h));
	const panels: [number, number, number, number, number][] = [
		[(x0 + x1) / 2, z0, x1 - x0, h, 0],
		[(x0 + x1) / 2, z1, x1 - x0, h, 0],
		[x0, (z0 + z1) / 2, z1 - z0, h, Math.PI / 2],
		[x1, (z0 + z1) / 2, z1 - z0, h, Math.PI / 2],
	];
	for (const [x, z, w, ph, rot] of panels) {
		const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), glass);
		panel.position.set(x, ph / 2, z);
		panel.rotation.y = rot;
		g.add(panel);
	}
	g.add(block(1.6, 0.8, 0.9, palette.steel, 6.2, 2.9));
	for (let i = 0; i < 4; i++) {
		const sheet = block(
			0.5,
			0.02,
			0.36,
			0xffffff,
			5.9 + (i % 2) * 0.55,
			2.8 + Math.floor(i / 2) * 0.1,
			0.82 + i * 0.02,
		);
		sheet.rotation.y = (i - 1.5) * 0.12;
		g.add(sheet);
	}
	// A small local model: the box stays inside the room.
	g.add(block(0.5, 0.4, 0.4, palette.model, 6.7, 3.1, 0.82));
	g.add(block(0.3, 0.14, 0.02, palette.lamp, 6.7, 2.89, 0.98));
}

/** Le passe: the counter where the chef checks every plate before it leaves. */
function buildPass(g: THREE.Group) {
	g.add(block(4.0, 0.96, 0.9, palette.steel, 1.3, 2.9));
	g.add(block(4.1, 0.07, 1.0, palette.steelTop, 1.3, 2.9, 0.96));
	g.add(block(0.08, 3.1, 0.08, palette.steelDark, -0.6, 2.9));
	g.add(block(0.08, 3.1, 0.08, palette.steelDark, 3.2, 2.9));
	g.add(block(3.9, 0.08, 0.08, palette.steelDark, 1.3, 2.9, 3.1));
	for (const x of [0.2, 1.3, 2.4]) {
		const shade = new THREE.Mesh(
			new THREE.ConeGeometry(0.24, 0.26, 20, 1, true),
			toon(palette.check, { side: THREE.DoubleSide }),
		);
		shade.position.set(x, 2.95, 2.9);
		g.add(outline(shade, 0.02));
		const bulb = new THREE.Mesh(
			new THREE.SphereGeometry(0.1, 12, 12),
			new THREE.MeshBasicMaterial({ color: palette.lamp }),
		);
		bulb.position.set(x, 2.8, 2.9);
		g.add(bulb);
	}
	// Ticket rail with orders already hanging.
	g.add(block(3.2, 0.05, 0.05, palette.steelDark, 1.3, 2.5, 2.45));
	for (const x of [-0.3, 0.1, 0.5])
		g.add(block(0.22, 0.34, 0.02, 0xffffff, x, 2.5, 2.1));
	// The bell.
	const bell = new THREE.Mesh(
		new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
		toon(palette.lamp),
	);
	bell.position.set(2.8, 1.03, 2.7);
	g.add(outline(bell, 0.02));
}

/** Lyon at night, seen from the kitchen: Fourvière hill with its basilica and metal tower. */
function lyonTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 300;
	canvas.height = 230;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const sky = ctx.createLinearGradient(0, 0, 0, 230);
		sky.addColorStop(0, "#0f2638");
		sky.addColorStop(1, "#27506a");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, 300, 230);
		ctx.fillStyle = "#f3e7b3";
		for (const [x, y, r] of [
			[30, 30, 1.5],
			[90, 18, 1],
			[150, 40, 1.2],
			[250, 22, 1.4],
			[200, 60, 1],
			[60, 75, 1],
		]) {
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.beginPath();
		ctx.arc(240, 55, 16, 0, Math.PI * 2);
		ctx.fill();
		// The hill.
		ctx.fillStyle = "#132e24";
		ctx.beginPath();
		ctx.moveTo(0, 230);
		ctx.bezierCurveTo(40, 150, 140, 120, 300, 170);
		ctx.lineTo(300, 230);
		ctx.fill();
		// The basilica: a body, four towers and a golden statue.
		ctx.fillStyle = "#e9e1c8";
		ctx.fillRect(70, 108, 70, 30);
		for (const x of [66, 84, 118, 136]) ctx.fillRect(x - 5, 96, 10, 42);
		ctx.fillStyle = "#1b1e1c";
		for (const x of [80, 92, 104, 116, 128]) ctx.fillRect(x - 1.5, 116, 3, 10);
		ctx.fillStyle = "#f2c230";
		ctx.fillRect(103, 98, 4, 10);
		// The metal tower, a thin lattice.
		ctx.strokeStyle = "#c9cfd1";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(185, 132);
		ctx.lineTo(195, 62);
		ctx.lineTo(205, 132);
		ctx.moveTo(188, 110);
		ctx.lineTo(202, 110);
		ctx.moveTo(191, 88);
		ctx.lineTo(199, 88);
		ctx.stroke();
		ctx.fillStyle = "#c0392b";
		ctx.beginPath();
		ctx.arc(195, 60, 2.5, 0, Math.PI * 2);
		ctx.fill();
		// City lights at the foot of the hill.
		ctx.fillStyle = "#ffc857";
		for (let i = 0; i < 26; i++) {
			const x = (i * 53) % 300;
			const y = 185 + ((i * 29) % 40);
			ctx.fillRect(x, y, 3, 3);
		}
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function bookTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 176;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#f7f3e8";
		ctx.fillRect(0, 0, 256, 176);
		ctx.strokeStyle = "#1b1e1c";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(128, 8);
		ctx.lineTo(128, 168);
		ctx.stroke();
		ctx.lineWidth = 2;
		// Left page: an exploded view. Right page: lines of text.
		ctx.strokeRect(24, 40, 36, 36);
		ctx.strokeRect(70, 60, 36, 36);
		ctx.beginPath();
		ctx.arc(60, 120, 22, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = "#c0392b";
		ctx.beginPath();
		ctx.arc(88, 78, 7, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#8a948f";
		for (let i = 0; i < 9; i++)
			ctx.fillRect(144, 28 + i * 15, 90 - (i % 3) * 18, 5);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
