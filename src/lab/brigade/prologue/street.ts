import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { outline, palette, toon } from "../toon";

/**
 * The street around the restaurant, at night: a Presqu'île street between two rows of
 * Lyon houses, the Saône quay in the foreground, and Fourvière hill above the roofs.
 * Like the kitchen, it is drawn in code. Detail lives in canvas textures, and small
 * parts are merged into batches, so the whole street costs about a hundred draw calls.
 */

export interface Street {
	/** Everything in the street. */
	group: THREE.Group;
	/**
	 * Groups to clear away one by one when the house opens, sorted from the closest to
	 * the restaurant to the farthest: curb, right, left, street, across, town, sky.
	 */
	layers: THREE.Object3D[];
	/** Café terrace chairs: top of the seat, and the point the sitter looks at. */
	seats: { position: THREE.Vector3; facing: THREE.Vector3 }[];
	/** Walking lanes on the restaurant's pavement, for passers-by (fixed z, from x to x). */
	walkways: { z: number; fromX: number; toX: number }[];
	lamps: THREE.PointLight[];
}

// The world, shared with facade.ts: the restaurant fills x in [-8.3, 8.3], z in [-5.8, 5.8].
const FRONT_Z = 5.8;
const CURB_Z = 7.8;
const ROAD_Y = -0.15;
const FAR_CURB_Z = 11;
const QUAY_Z = 13.4;
const WATER_Y = -1.4;
/** The water stops short of the camera's near plane; a wall of water hides the cut. */
const WATER_END_Z = 30;
const WEST = -54;
const EAST = 44;
const HOUSE_X = 8.3;
/** Kept clear for the maître d', the visitor, the chalkboard and the door plants. */
const CLEAR = { x0: -1.5, x1: 3.5 };
/** Street furniture stands on these lines, just behind each kerb. */
const KERB_LINE = 7.64;
const FAR_KERB_LINE = 11.3;
const FAR_TREE_LINE = 12.6;
/** Shop fronts are as tall as the restaurant's, and every storey above is the same. */
const SHOP = 3.4;
const STOREY = 2.2;
const DEPTH = 9;
/** Façade texture resolution, in pixels per world unit. */
const PX = 56;

/** Looking at the shop front from across the street: the backdrop faces this way. */
const VIEW = new THREE.Vector3(0.22, 0.2, 1).normalize();
const VIEW_TARGET = new THREE.Vector3(0.6, 3.2, 5.8);

const colors = {
	pavement: 0xc9c2b1,
	kerb: 0xa9a59b,
	coping: 0xd9cfb9,
	water: 0x0f2531,
	iron: 0x26292b,
	lampPost: 0x1f3b33,
	lantern: 0xffe2a0,
	tiles: 0x98583a,
	zinc: 0x7f8b8f,
	brick: 0xa4553a,
	stone: 0xe0d6c1,
	rattan: 0xb07b45,
	darkWindow: 0x22384d,
	moon: 0xf3e7b3,
	hill: 0x1f3a30,
	town: 0x1a2632,
};

const WARM_LIGHTS = [0xffd27a, 0xffc46b, 0xffdc93, 0xfff0c4, 0xf7b75e];

type Ctx = CanvasRenderingContext2D;
type Painting = (ctx: Ctx) => void;
type ShopKind =
	| "cafe"
	| "pharmacy"
	| "bakery"
	| "bookshop"
	| "grocer"
	| "carriage"
	| "shuttered";

interface House {
	x0: number;
	x1: number;
	floors: number;
	plaster: number;
	shutters: number;
	/** Wooden shutters folded against the wall, or metal ones folded into the jamb. */
	leaves: boolean;
	roof: "tiles" | "zinc";
	shop: ShopKind;
	/** A continuous wrought-iron balcony along the first floor. */
	balcony?: boolean;
	/** Share of lit windows. */
	lit: number;
	seed: number;
}

const house = (
	x0: number,
	x1: number,
	floors: number,
	plaster: number,
	shutters: number,
	roof: House["roof"],
	shop: ShopKind,
	options: { leaves?: boolean; balcony?: boolean; lit?: number; seed: number },
): House => ({
	x0,
	x1,
	floors,
	plaster,
	shutters,
	roof,
	shop,
	leaves: options.leaves ?? false,
	balcony: options.balcony,
	lit: options.lit ?? 0.42,
	seed: options.seed,
});

// Lyon colours: ochres, pinks, sienna, pale yellow, one grey-blue. From the restaurant outwards.
const WEST_HOUSES: House[] = [
	house(-14.4, -HOUSE_X, 3, 0xe4cb8a, 0x6e8b7f, "tiles", "cafe", {
		leaves: true,
		balcony: true,
		lit: 0.55,
		seed: 3,
	}),
	house(-20.2, -14.4, 3, 0xd6907b, 0xe6e0cf, "tiles", "pharmacy", {
		lit: 0.4,
		seed: 7,
	}),
	house(-25, -20.2, 2, 0x8fa1ad, 0xd9d4c4, "zinc", "carriage", {
		leaves: true,
		seed: 11,
	}),
	house(-31.4, -25, 3, 0xb96c46, 0x55706a, "tiles", "grocer", {
		balcony: true,
		lit: 0.5,
		seed: 5,
	}),
	house(-37.2, -31.4, 2, 0xe0c074, 0x7d6a58, "tiles", "shuttered", {
		leaves: true,
		lit: 0.35,
		seed: 13,
	}),
	house(-44.6, -37.2, 3, 0xdcae98, 0x6e8b7f, "zinc", "carriage", {
		seed: 17,
	}),
	house(WEST, -44.6, 2, 0xcf9859, 0xe0dccd, "tiles", "shuttered", {
		leaves: true,
		lit: 0.35,
		seed: 19,
	}),
];

const EAST_HOUSES: House[] = [
	house(HOUSE_X, 14.2, 2, 0x93a6b2, 0xe7e2d2, "zinc", "bookshop", {
		leaves: true,
		lit: 0.5,
		seed: 23,
	}),
	house(14.2, 20, 3, 0xe8d6a0, 0x7a8f6a, "tiles", "bakery", {
		balcony: true,
		seed: 29,
	}),
	house(20, 25, 2, 0xc27650, 0xded6c3, "tiles", "carriage", {
		leaves: true,
		seed: 31,
	}),
	house(25, 31.6, 3, 0xd9a08c, 0x5f7470, "zinc", "shuttered", { seed: 37 }),
	house(31.6, 37.4, 2, 0xd8a35e, 0xe9e3d3, "tiles", "grocer", {
		leaves: true,
		seed: 41,
	}),
	house(37.4, EAST, 3, 0xe6d49c, 0x6e8b7f, "tiles", "shuttered", {
		lit: 0.35,
		seed: 43,
	}),
];

/** Shop signs: street words, the same in French and in English. */
const SIGNS: Partial<
	Record<ShopKind, { text: string; ground: number; ink: number }>
> = {
	cafe: { text: "Café", ground: 0x2c2622, ink: 0xf1e3bf },
	pharmacy: { text: "Pharmacie", ground: 0x2f7a4a, ink: 0xf7f6f1 },
	bakery: { text: "Boulangerie", ground: 0x4a2e22, ink: 0xe0b24a },
	bookshop: { text: "Librairie", ground: 0x1f4f55, ink: 0xf1e3bf },
};

/**
 * Street furniture. Tall things in the foreground stand between the shop signs, so that
 * no lamp or trunk ever crosses a word, and never in front of the door or the windows.
 */
const LAYOUT = {
	/** [x, has a real light]. Three lights at most: each one costs every lit pixel. */
	nearLamps: [
		[-13.6, true],
		[8.9, true],
		[-27.9, false],
		[22.4, false],
		[34, false],
	] as [number, boolean][],
	farLamps: [
		[-6.8, true],
		[-39.4, false],
		[26, false],
	] as [number, boolean][],
	/** Plane trees on the restaurant's side stand where two houses meet. */
	nearTrees: [-25, -37.2, 20, 31.6, 40.9],
	farTrees: [-21.5, -33, -42.9, 15.5, 29, 38.9],
	nearBollards: [
		-10.4, -11.8, -16, -17.3, -18.6, -23.4, 10.6, 13.3, 14.6, 16, 17.4, 24.3,
		-30.5, 27.2,
	],
	/** Outside the restaurant's width: its front falls flat across the street, up to z = 12. */
	farBollards: [
		-9.2, -10.5, -11.8, -14.8, -16.1, 9.2, 10.3, 13.5, 17.2, 18.5, -24.6, 25.4,
	],
	crossing: 11.9,
};

export function buildStreet(): Street {
	const group = new THREE.Group();
	group.name = "street";
	const painter = new Painter();
	const layer = (name: string) => {
		const g = new THREE.Group();
		g.name = name;
		group.add(g);
		return g;
	};
	// From the closest to the restaurant to the farthest.
	const curb = layer("curb");
	const right = layer("right");
	const left = layer("left");
	const street = layer("street");
	const across = layer("across");
	const town = layer("town");
	const sky = layer("sky");

	buildRow(left, WEST_HOUSES, painter);
	buildRow(right, EAST_HOUSES, painter);
	const seats = buildTerrace(left, painter);
	const lamps = [
		...buildStreetSide(street, curb, painter),
		...buildQuay(across, painter),
	];
	buildTown(town);
	buildSky(sky, painter);

	// The signs are lettered in Recursive: paint them again once the font is in.
	void document.fonts?.load(font(800, 40)).then(
		() => painter.redraw(),
		() => undefined,
	);

	return {
		group,
		layers: [curb, right, left, street, across, town, sky],
		seats,
		walkways: [
			// Between the terrace and the lamps, in front of the door: the whole street.
			{ z: 7.3, fromX: WEST + 6, toX: EAST - 4 },
			// Closer to the houses: out of the café door, and out of the bookshop door.
			{ z: 6.4, fromX: -13.6, toX: WEST + 6 },
			{ z: 6.4, fromX: 13.4, toX: EAST - 4 },
		],
		lamps,
	};
}

/* Houses */

function buildRow(parent: THREE.Group, houses: House[], painter: Painter) {
	const walls = new Batch(true);
	const stone = new Batch(true);
	const roofs = new Batch(true);
	const chimneys = new Batch(true);
	const panes = new Batch(true);
	const railings: THREE.BufferGeometry[] = [];
	for (const spec of houses) {
		const rand = random(spec.seed * 97);
		const w = spec.x1 - spec.x0;
		const cx = (spec.x0 + spec.x1) / 2;
		const h = SHOP + 0.2 + spec.floors * STOREY;
		const zc = FRONT_Z - DEPTH / 2;
		const trim = mixHex(spec.plaster, 0xf4efe2, 0.55);

		// The body is a plain box; its elevation is painted on a plane just in front.
		walls.add(new THREE.BoxGeometry(w, h, DEPTH), cx, h / 2, zc, {
			color: spec.plaster,
			ink: 0.03,
		});
		const glows: Painting[] = [];
		const map = painter.texture(w, h, PX, (ctx) => {
			glows.length = 0;
			drawHouse(ctx, spec, w, h, (paint) => {
				paint(ctx);
				glows.push(paint);
			});
		});
		// Lit windows and shop fronts shine on their own at night.
		const glow = painter.texture(w, h, PX / 2, (ctx) => {
			fill(ctx, "#000", 0, 0, w, h);
			for (const paint of glows) paint(ctx);
		});
		const front = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			toon(0xffffff, { map, emissiveMap: glow, emissive: 0xffffff }),
		);
		front.position.set(cx, h / 2, FRONT_Z + 0.004);
		front.receiveShadow = true;
		parent.add(front);

		// Stone band over the shop, cornice under the roof.
		stone.add(new THREE.BoxGeometry(w, 0.2, 0.34), cx, SHOP + 0.1, FRONT_Z, {
			color: trim,
		});
		stone.add(
			new THREE.BoxGeometry(w, 0.28, 0.5),
			cx,
			h + 0.14,
			FRONT_Z - 0.1,
			{ color: trim },
		);

		// The first-floor balcony, on its stone slab.
		if (spec.balcony) {
			const bw = w - 0.8;
			stone.add(
				new THREE.BoxGeometry(bw, 0.12, 0.5),
				cx,
				SHOP + 0.36,
				FRONT_Z + 0.25,
				{ color: trim },
			);
			railings.push(railingGeometry(bw, cx, SHOP + 0.42, FRONT_Z + 0.46));
		}

		// Roof: low-pitched canal tiles, or a zinc mansard with dormers.
		const eave = h + 0.28;
		if (spec.roof === "tiles") {
			roofs.add(pitchedRoof(w + 0.06, 0.8), cx, eave, 0, {
				color: colors.tiles,
			});
		} else {
			roofs.add(mansardRoof(w + 0.06, 1.35), cx, eave, 0, {
				color: colors.zinc,
			});
			const n = Math.max(2, Math.round(w / 1.8));
			for (let i = 0; i < n; i++) {
				const x = spec.x0 + ((i + 0.5) * w) / n;
				roofs.add(new THREE.BoxGeometry(0.62, 0.78, 0.6), x, eave + 0.5, 5.6, {
					color: colors.zinc,
				});
				roofs.add(pitchedRoof(0.72, 0.28, 5.95, 5.25), x, eave + 0.89, 0, {
					color: colors.zinc,
				});
				const lit = rand() < spec.lit;
				const light = WARM_LIGHTS[Math.floor(rand() * WARM_LIGHTS.length)];
				panes.add(new THREE.PlaneGeometry(0.36, 0.46), x, eave + 0.5, 5.905, {
					color: lit ? light : colors.darkWindow,
					ink: 0,
				});
			}
		}

		// Chimney stacks: brick or plaster, capped with stone and pots.
		const stacks = Math.max(1, Math.round(w / 3.2));
		for (let i = 0; i < stacks; i++) {
			const x = spec.x0 + 0.8 + rand() * (w - 1.6);
			const z = spec.roof === "tiles" ? zc + (rand() - 0.5) : zc - 1.5;
			const tall = (spec.roof === "zinc" ? 2.1 : 1.4) + rand() * 0.7;
			const brick = rand() < 0.5 ? colors.brick : mixHex(spec.plaster, 0, 0.1);
			chimneys.add(
				new THREE.BoxGeometry(0.6, tall, 0.46),
				x,
				eave + tall / 2,
				z,
				{ color: brick },
			);
			chimneys.add(
				new THREE.BoxGeometry(0.72, 0.1, 0.58),
				x,
				eave + tall + 0.05,
				z,
				{ color: colors.stone },
			);
			for (const dx of [-0.14, 0.14]) {
				chimneys.add(
					new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8),
					x + dx,
					eave + tall + 0.23,
					z,
					{ color: colors.tiles, ink: 0.015 },
				);
			}
		}

		// Shop sign, lettered like the restaurant's: a board, and its painted face.
		const sign = SIGNS[spec.shop];
		if (sign) {
			const pharmacy = spec.shop === "pharmacy";
			const width = pharmacy ? w - 1.9 : w - 0.9;
			const x = pharmacy ? spec.x1 - 0.45 - width / 2 : cx;
			stone.add(
				new THREE.BoxGeometry(width, 0.48, 0.1),
				x,
				3.08,
				FRONT_Z + 0.06,
				{
					color: sign.ground,
					ink: 0.02,
				},
			);
			parent.add(signFace(painter, sign, width, x, 3.08));
		}
		if (spec.shop === "pharmacy") {
			// At the far corner, clear of the café's lamp and of the crowns across the street.
			const x = spec.x0 + 0.72;
			stone.add(
				new THREE.BoxGeometry(0.08, 0.08, 0.36),
				x,
				4.1,
				FRONT_Z + 0.18,
				{
					color: colors.iron,
					ink: 0.01,
				},
			);
			parent.add(pharmacyCross(x));
		}
	}
	const vertexColored = () => toon(0xffffff, { vertexColors: true });
	parent.add(
		walls.build(vertexColored()),
		stone.build(vertexColored()),
		roofs.build(vertexColored()),
		chimneys.build(vertexColored()),
		panes.build(new THREE.MeshBasicMaterial({ vertexColors: true })),
	);
	if (railings.length > 0) {
		parent.add(
			new THREE.Mesh(
				merge(railings),
				new THREE.MeshBasicMaterial({
					map: railingTexture(painter),
					alphaTest: 0.5,
					side: THREE.DoubleSide,
				}),
			),
		);
	}
}

/** A low roof, its ridge along the street. The profile is drawn in (z, y). */
function pitchedRoof(
	width: number,
	rise: number,
	front = FRONT_Z + 0.3,
	back = FRONT_Z - DEPTH - 0.1,
): THREE.BufferGeometry {
	const shape = new THREE.Shape([
		new THREE.Vector2(front, 0),
		new THREE.Vector2((front + back) / 2, rise),
		new THREE.Vector2(back, 0),
	]);
	return extrudeAlongX(shape, width);
}

/** A zinc mansard: a steep face on the street, then a flat top. */
function mansardRoof(width: number, rise: number): THREE.BufferGeometry {
	const front = FRONT_Z + 0.15;
	const back = FRONT_Z - DEPTH - 0.05;
	const shape = new THREE.Shape([
		new THREE.Vector2(front, 0),
		new THREE.Vector2(front - 0.6, rise),
		new THREE.Vector2(back + 0.6, rise),
		new THREE.Vector2(back, 0),
	]);
	return extrudeAlongX(shape, width);
}

/** Extrudes a profile drawn in (z, y) along x, centred on x = 0. */
function extrudeAlongX(shape: THREE.Shape, width: number) {
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: width,
		bevelEnabled: false,
	});
	// Profile x becomes world z, extrusion z becomes world x.
	geometry.rotateY(-Math.PI / 2);
	geometry.translate(width / 2, 0, 0);
	return geometry;
}

/** Wrought iron along a balcony: a plane whose texture repeats every unit. */
function railingGeometry(width: number, x: number, y: number, z: number) {
	const geometry = new THREE.PlaneGeometry(width, 0.55);
	const uv = geometry.attributes.uv;
	for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * width);
	geometry.translate(x, y + 0.275, z);
	return geometry;
}

function railingTexture(painter: Painter) {
	const texture = painter.texture(1, 0.55, 128, (ctx) => {
		ctx.strokeStyle = "#1d2022";
		ctx.lineWidth = 0.035;
		line(ctx, 0, 0.52, 1, 0.52);
		line(ctx, 0, 0.03, 1, 0.03);
		line(ctx, 0, 0.14, 1, 0.14);
		ctx.lineWidth = 0.018;
		for (let x = 0.0625; x < 1; x += 0.125) line(ctx, x, 0.03, x, 0.52);
		ctx.beginPath();
		ctx.arc(0.5, 0.33, 0.1, 0, Math.PI * 2);
		ctx.moveTo(0.1, 0.33);
		ctx.arc(0, 0.33, 0.1, 0, Math.PI * 2);
		ctx.moveTo(1.1, 0.33);
		ctx.arc(1, 0.33, 0.1, 0, Math.PI * 2);
		ctx.stroke();
	});
	texture.wrapS = THREE.RepeatWrapping;
	return texture;
}

function signFace(
	painter: Painter,
	sign: { text: string; ground: number; ink: number },
	width: number,
	x: number,
	y: number,
): THREE.Mesh {
	const pw = Math.round(width * 170);
	const face = painter.pixels(
		pw,
		80,
		(ctx) => {
			ctx.fillStyle = hex(sign.ground);
			ctx.fillRect(0, 0, pw, 80);
			ctx.strokeStyle = hex(sign.ink);
			ctx.globalAlpha = 0.7;
			ctx.lineWidth = 3;
			ctx.strokeRect(8, 8, pw - 16, 64);
			ctx.globalAlpha = 1;
			ctx.fillStyle = hex(sign.ink);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.letterSpacing = "5px";
			let size = 48;
			ctx.font = font(800, size);
			while (ctx.measureText(sign.text).width > pw - 50 && size > 18) {
				size -= 2;
				ctx.font = font(800, size);
			}
			ctx.fillText(sign.text, pw / 2, 43);
		},
		true,
	);
	const plane = new THREE.Mesh(
		new THREE.PlaneGeometry(width, 0.48),
		new THREE.MeshBasicMaterial({ map: face }),
	);
	plane.position.set(x, y, FRONT_Z + 0.112);
	return plane;
}

/** The green cross of a French pharmacy, lit at night. */
function pharmacyCross(x: number): THREE.Mesh {
	const a = 0.14;
	const b = 0.4;
	const shape = new THREE.Shape(
		[
			[-a, -b],
			[a, -b],
			[a, -a],
			[b, -a],
			[b, a],
			[a, a],
			[a, b],
			[-a, b],
			[-a, a],
			[-b, a],
			[-b, -a],
			[-a, -a],
		].map(([px, py]) => new THREE.Vector2(px, py)),
	);
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: 0.14,
		bevelEnabled: false,
	});
	geometry.center();
	const cross = outline(
		new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x3ddc6e })),
		0.025,
	);
	cross.castShadow = false;
	cross.position.set(x, 4.1, FRONT_Z + 0.42);
	return cross;
}

/* The elevation of a house, painted in world units with y up. */

function drawHouse(
	ctx: Ctx,
	spec: House,
	w: number,
	h: number,
	glow: (paint: Painting) => void,
) {
	const rand = random(spec.seed);
	const trim = mixHex(spec.plaster, 0xf4efe2, 0.55);
	fill(ctx, spec.plaster, 0, 0, w, h);
	// A few faint patches, so the render does not look like plastic.
	ctx.globalAlpha = 0.3;
	for (let i = 0; i < 12; i++) {
		fill(
			ctx,
			mix(spec.plaster, i % 2 ? 0x000000 : 0xffffff, 0.07),
			rand() * w,
			SHOP + rand() * (h - SHOP),
			0.4 + rand() * 1.6,
			0.3 + rand() * 1.2,
		);
	}
	ctx.globalAlpha = 1;
	// Stone quoins up both corners, a darker frieze under the cornice.
	for (let y = SHOP + 0.2, i = 0; y < h - 0.3; y += 0.34, i++) {
		const q = i % 2 ? 0.24 : 0.4;
		fill(ctx, trim, 0, y, q, 0.3);
		fill(ctx, trim, w - q, y, q, 0.3);
	}
	fill(ctx, mix(spec.plaster, 0x000000, 0.12), 0, h - 0.24, w, 0.24);

	const n = Math.max(2, Math.round(w / 1.62));
	for (let f = 0; f < spec.floors; f++) {
		const base = SHOP + 0.2 + f * STOREY;
		const french = Boolean(spec.balcony) && f === 0;
		for (let i = 0; i < n; i++) {
			drawWindow(ctx, spec, rand, glow, {
				cx: ((i + 0.5) * w) / n,
				bottom: french ? base + 0.18 : base + 0.44,
				height: french ? 1.72 : 1.42,
				railing: !french,
			});
		}
	}
	drawShop(ctx, spec, w, rand, glow);
}

function drawWindow(
	ctx: Ctx,
	spec: House,
	rand: () => number,
	glow: (paint: Painting) => void,
	at: { cx: number; bottom: number; height: number; railing: boolean },
) {
	const { cx, bottom, height } = at;
	const width = 0.76;
	const left = cx - width / 2;
	const top = bottom + height;
	const trim = mixHex(spec.plaster, 0xf4efe2, 0.55);
	const lit = rand() < spec.lit;
	const closed = !lit && rand() < 0.3;
	const figure = lit && rand() < 0.4;
	const lamp = lit && !figure && rand() < 0.5;
	const plant = rand() < 0.3;
	const figureX = cx + (rand() - 0.5) * 0.3;
	const light = WARM_LIGHTS[Math.floor(rand() * WARM_LIGHTS.length)];

	// Stone surround, sill and keystone.
	fill(ctx, trim, left - 0.09, bottom - 0.02, width + 0.18, height + 0.11);
	fill(
		ctx,
		mix(trim, 0x000000, 0.14),
		left - 0.15,
		bottom - 0.12,
		width + 0.3,
		0.1,
	);
	fill(ctx, trim, cx - 0.09, top + 0.09, 0.18, 0.14);

	const frame = (c: Ctx, color: string) => {
		c.strokeStyle = color;
		c.lineWidth = 0.035;
		line(c, cx, bottom, cx, top);
		for (const t of [0.36, 0.7]) {
			line(c, left, bottom + height * t, left + width, bottom + height * t);
		}
		c.strokeRect(left + 0.02, bottom + 0.02, width - 0.04, height - 0.04);
	};
	if (lit) {
		glow((c) => {
			fill(c, light, left, bottom, width, height);
			c.save();
			c.beginPath();
			c.rect(left, bottom, width, height);
			c.clip();
			if (lamp) {
				fill(c, "#6b4a2e", cx + 0.16, bottom + 0.1, 0.03, 0.42);
				c.fillStyle = "#fff6d8";
				c.beginPath();
				c.moveTo(cx + 0.06, bottom + 0.5);
				c.lineTo(cx + 0.29, bottom + 0.5);
				c.lineTo(cx + 0.24, bottom + 0.68);
				c.lineTo(cx + 0.11, bottom + 0.68);
				c.fill();
			}
			if (figure) silhouette(c, figureX, bottom + 0.3, 1);
			// Curtains, gathered at the sides.
			c.fillStyle = "rgba(255, 248, 230, 0.55)";
			c.fillRect(left, bottom + 0.2, 0.15, height - 0.2);
			c.fillRect(left + width - 0.15, bottom + 0.2, 0.15, height - 0.2);
			c.restore();
			frame(c, "#5a3b22");
		});
	} else {
		fill(ctx, colors.darkWindow, left, bottom, width, height);
		ctx.fillStyle = "rgba(160, 190, 215, 0.18)";
		ctx.beginPath();
		ctx.moveTo(left, bottom + height * 0.55);
		ctx.lineTo(left + width * 0.55, top);
		ctx.lineTo(left + width * 0.8, top);
		ctx.lineTo(left, bottom + height * 0.25);
		ctx.fill();
		frame(ctx, mix(trim, 0x22384d, 0.25));
	}

	// Shutters: closed over the glass, or open against the wall.
	const slats = (x: number, y: number, sw: number, sh: number) => {
		fill(ctx, spec.shutters, x, y, sw, sh);
		ctx.strokeStyle = mix(spec.shutters, 0x000000, 0.25);
		ctx.lineWidth = 0.018;
		for (let s = y + 0.07; s < y + sh - 0.03; s += 0.075) {
			line(ctx, x + 0.03, s, x + sw - 0.03, s);
		}
		ctx.lineWidth = 0.025;
		ctx.strokeStyle = mix(spec.shutters, 0x000000, 0.45);
		ctx.strokeRect(x, y, sw, sh);
	};
	if (closed) {
		slats(left, bottom, width / 2, height);
		slats(cx, bottom, width / 2, height);
	} else if (spec.leaves) {
		slats(left - 0.09 - 0.34, bottom - 0.02, 0.33, height + 0.04);
		slats(left + width + 0.1, bottom - 0.02, 0.33, height + 0.04);
	} else {
		// Metal shutters folded into the jamb: two thin strips.
		fill(ctx, spec.shutters, left, bottom, 0.07, height);
		fill(ctx, spec.shutters, left + width - 0.07, bottom, 0.07, height);
	}

	if (plant) {
		ctx.fillStyle = "#b5653a";
		ctx.fillRect(cx - 0.2, bottom - 0.02, 0.4, 0.1);
		for (const [dx, r, c] of [
			[-0.12, 0.09, "#3d6b3a"],
			[0.02, 0.11, "#4f7d3f"],
			[0.14, 0.08, "#3d6b3a"],
		] as const) {
			ctx.fillStyle = c;
			ctx.beginPath();
			ctx.arc(cx + dx, bottom + 0.14, r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	// A wrought-iron guard across the lower part of the window.
	if (at.railing) {
		ctx.strokeStyle = "#1d2022";
		ctx.lineWidth = 0.035;
		const l = left - 0.04;
		const r = left + width + 0.04;
		line(ctx, l, bottom + 0.44, r, bottom + 0.44);
		line(ctx, l, bottom + 0.02, r, bottom + 0.02);
		ctx.lineWidth = 0.016;
		for (let x = l + 0.06; x < r; x += 0.07) {
			line(ctx, x, bottom + 0.02, x, bottom + 0.44);
		}
		ctx.lineWidth = 0.022;
		ctx.beginPath();
		ctx.arc(cx, bottom + 0.23, 0.09, 0, Math.PI * 2);
		ctx.stroke();
	}
}

/** Head and shoulders against a lit window. */
function silhouette(c: Ctx, x: number, y: number, scale: number) {
	c.fillStyle = "#2b2530";
	c.beginPath();
	c.arc(x, y + 0.5 * scale, 0.11 * scale, 0, Math.PI * 2);
	c.fill();
	c.beginPath();
	c.ellipse(x, y, 0.23 * scale, 0.36 * scale, 0, 0, Math.PI);
	c.fill();
}

function drawShop(
	ctx: Ctx,
	spec: House,
	w: number,
	rand: () => number,
	glow: (paint: Painting) => void,
) {
	const trim = mixHex(spec.plaster, 0xf4efe2, 0.55);
	const woodwork = (color: number) => {
		fill(ctx, color, 0.15, 0, w - 0.3, SHOP - 0.05);
		ctx.strokeStyle = "rgba(224, 178, 74, 0.8)";
		ctx.lineWidth = 0.025;
		ctx.strokeRect(0.22, 0.06, w - 0.44, SHOP - 0.18);
	};
	const door = (x: number, width: number, color: number | string) => {
		fill(ctx, color, x, 0, width, 2.55);
		ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
		ctx.lineWidth = 0.03;
		ctx.strokeRect(x + 0.1, 0.15, width - 0.2, 1.0);
		ctx.strokeRect(x + 0.1, 1.3, width - 0.2, 1.1);
		fill(ctx, "#e0b24a", x + width - 0.18, 1.15, 0.06, 0.06);
	};
	// Closed for the night: an iron shutter, pulled down.
	const shutter = (x: number, width: number) => {
		fill(ctx, "#8b9194", x, 0.02, width, 2.6);
		ctx.lineWidth = 0.022;
		for (let y = 0.1, i = 0; y < 2.6; y += 0.09, i++) {
			ctx.strokeStyle = i % 2 ? "#6f7578" : "#a7adaf";
			line(ctx, x, y, x + width, y);
		}
		fill(ctx, "#5d6366", x, 0.02, width, 0.1);
		fill(ctx, "#4b5154", x + width / 2 - 0.05, 0.12, 0.1, 0.12);
	};
	const glazingBars = (c: Ctx, color: number, x0: number, x1: number) => {
		c.strokeStyle = hex(color);
		c.lineWidth = 0.07;
		for (let x = x0 + 1.2; x < x1 - 0.3; x += 1.2) line(c, x, 0.6, x, 2.64);
	};

	switch (spec.shop) {
		case "cafe": {
			const wood = 0x2c2622;
			woodwork(wood);
			glow((c) => {
				// The door, glazed and lit.
				fill(c, "#f6c874", 0.4, 0, 0.85, 2.55);
				c.strokeStyle = hex(wood);
				c.lineWidth = 0.06;
				c.strokeRect(0.43, 0.03, 0.79, 2.49);
				line(c, 0.43, 0.9, 1.22, 0.9);
				// The bar inside: warm wall, bottles, zinc counter, regulars.
				const x0 = 1.45;
				const x1 = w - 0.35;
				fill(c, "#f2c475", x0, 0.6, x1 - x0, 2.05);
				fill(c, "#d9a458", x0, 2.25, x1 - x0, 0.4);
				c.strokeStyle = "#8a5a3b";
				c.lineWidth = 0.04;
				line(c, x0, 1.72, x1, 1.72);
				line(c, x0, 2.12, x1, 2.12);
				const bottles = ["#3d6b3a", "#c8794b", "#e0b24a", "#7a4a2a", "#5f7d3a"];
				for (let x = x0 + 0.1, i = 0; x < x1 - 0.1; x += 0.13, i++) {
					fill(c, bottles[i % 5], x, 1.74, 0.07, 0.2 + (i % 3) * 0.04);
					if (i % 2 === 0) {
						fill(c, bottles[(i + 2) % 5], x + 0.03, 2.14, 0.07, 0.18);
					}
				}
				for (const [i, x] of [x0 + 0.9, x0 + 2.1, x1 - 0.5].entries()) {
					silhouette(c, x, 1.12, i === 1 ? 0.95 : 1.05);
				}
				fill(c, "#9aa3a6", x0, 0.6, x1 - x0, 0.62);
				fill(c, "#e4eaeb", x0, 1.17, x1 - x0, 0.06);
				c.strokeStyle = "#5a3b22";
				c.lineWidth = 0.015;
				c.fillStyle = "#fff3c4";
				for (let x = x0 + 0.5; x < x1; x += 1.3) {
					line(c, x, 2.65, x, 2.42);
					c.beginPath();
					c.arc(x, 2.38, 0.07, 0, Math.PI * 2);
					c.fill();
				}
				glazingBars(c, wood, x0, x1);
			});
			fill(ctx, mix(wood, 0xffffff, 0.08), 1.45, 0.08, w - 1.8, 0.45);
			break;
		}
		case "bookshop": {
			const wood = 0x1f4f55;
			woodwork(wood);
			glow((c) => {
				const x0 = 0.35;
				const x1 = w - 1.45;
				fill(c, "#f7d9a0", x0, 0.62, x1 - x0, 2.0);
				const spines = [
					"#c8794b",
					"#2f5d4e",
					"#e0b24a",
					"#8a5a3b",
					"#6e8b7f",
					"#d9a066",
					"#56605a",
					"#f2e6c9",
					"#3b5f7a",
				];
				for (let row = 0; row < 4; row++) {
					const y = 1.02 + row * 0.38;
					fill(c, "#8a5a3b", x0, y - 0.03, x1 - x0, 0.03);
					for (let x = x0 + 0.05, i = row * 3; x < x1 - 0.1; i++) {
						const sw = 0.045 + ((i * 7) % 5) * 0.012;
						const sh = 0.22 + ((i * 3) % 4) * 0.025;
						fill(c, spines[(i * 5 + row) % spines.length], x, y, sw, sh);
						x += sw + 0.01;
					}
				}
				// A table of new books, and a reader.
				fill(c, "#6b4a2e", x0 + 0.3, 0.62, 1.6, 0.3);
				for (let k = 0; k < 5; k++) {
					fill(
						c,
						spines[(k * 4) % spines.length],
						x0 + 0.4 + k * 0.3,
						0.92,
						0.25,
						0.08,
					);
				}
				silhouette(c, x1 - 0.7, 0.95, 1.05);
				glazingBars(c, wood, x0, x1);
				// The door.
				fill(c, "#f7d9a0", w - 1.25, 0, 0.85, 2.55);
				c.lineWidth = 0.06;
				c.strokeRect(w - 1.22, 0.03, 0.79, 2.49);
			});
			break;
		}
		case "pharmacy": {
			fill(ctx, 0xe4ebe5, 0.15, 0, w - 0.3, SHOP - 0.05);
			fill(ctx, 0x2f7a4a, 0.15, 2.64, w - 0.3, 0.06);
			glow((c) => {
				const x0 = 0.4;
				const x1 = w - 1.4;
				fill(c, "#9ed4ae", x0, 0.62, x1 - x0, 1.95);
				for (let row = 0; row < 3; row++) {
					const y = 1.0 + row * 0.5;
					fill(c, "#e9f5ec", x0, y - 0.03, x1 - x0, 0.03);
					for (let x = x0 + 0.1, i = row; x < x1 - 0.2; x += 0.26, i++) {
						fill(c, i % 3 ? "#f7f6f1" : "#2f7a4a", x, y, 0.18, 0.2);
					}
				}
				fill(c, "#9ed4ae", w - 1.2, 0, 0.8, 2.5);
			});
			ctx.strokeStyle = "#2f7a4a";
			ctx.lineWidth = 0.05;
			ctx.strokeRect(w - 1.2, 0, 0.8, 2.5);
			ctx.strokeRect(0.4, 0.62, w - 1.8, 1.95);
			break;
		}
		case "bakery": {
			woodwork(0x4a2e22);
			shutter(0.35, w - 1.7);
			door(w - 1.2, 0.85, 0x3f5a4e);
			break;
		}
		case "grocer": {
			const wood = 0x3d6b3a;
			woodwork(wood);
			glow((c) => {
				const x0 = 0.4;
				const x1 = w - 0.4;
				fill(c, "#fff1c8", x0, 0.6, x1 - x0, 2.0);
				const goods = ["#e0b24a", "#c8794b", "#5f7d3a", "#f2e6c9", "#8a5a3b"];
				for (let row = 0; row < 3; row++) {
					const y = 1.35 + row * 0.4;
					fill(c, "#8a5a3b", x0, y - 0.03, x1 - x0, 0.03);
					for (let x = x0 + 0.08, i = row * 2; x < x1 - 0.15; x += 0.17, i++) {
						fill(c, goods[(i * 3) % 5], x, y, 0.12, 0.16 + (i % 2) * 0.06);
					}
				}
				// Fruit crates in the window.
				for (let x = x0 + 0.1, k = 0; x < x1 - 0.5; x += 0.7, k++) {
					fill(c, "#a67a4a", x, 0.6, 0.6, 0.3);
					c.fillStyle = goods[k % 3];
					for (let j = 0; j < 4; j++) {
						c.beginPath();
						c.arc(x + 0.1 + j * 0.13, 0.95, 0.07, 0, Math.PI * 2);
						c.fill();
					}
				}
				silhouette(c, x0 + (x1 - x0) * 0.62, 1.0, 1.05);
				glazingBars(c, wood, x0, x1);
			});
			break;
		}
		case "carriage": {
			// Rusticated stone and a carriage door: the way into a traboule.
			fill(ctx, mix(trim, 0x000000, 0.06), 0, 0, w, SHOP);
			ctx.strokeStyle = mix(trim, 0x000000, 0.25);
			ctx.lineWidth = 0.025;
			for (let y = 0.42; y < SHOP; y += 0.42) line(ctx, 0, y, w, y);
			const c = w * (0.35 + rand() * 0.3);
			ctx.fillStyle = mix(trim, 0x000000, 0.12);
			ctx.fillRect(c - 1.02, 0, 2.04, 2.3);
			ctx.beginPath();
			ctx.arc(c, 2.3, 1.02, 0, Math.PI);
			ctx.fill();
			ctx.fillStyle = "#5b3a25";
			ctx.fillRect(c - 0.85, 0, 1.7, 2.3);
			ctx.beginPath();
			ctx.arc(c, 2.3, 0.85, 0, Math.PI);
			ctx.fill();
			ctx.strokeStyle = "#3b2618";
			ctx.lineWidth = 0.035;
			line(ctx, c, 0, c, 3.15);
			for (const dx of [-0.72, 0.12]) {
				ctx.strokeRect(c + dx, 0.2, 0.6, 0.9);
				ctx.strokeRect(c + dx, 1.3, 0.6, 0.85);
			}
			fill(ctx, "#e0b24a", c + 1.2, 1.5, 0.2, 0.14);
			// A small barred window beside it.
			const wx = c < w / 2 ? c + 1.6 : c - 2.4;
			if (wx > 0.3 && wx + 0.8 < w - 0.3) {
				fill(ctx, colors.darkWindow, wx, 1.0, 0.8, 1.2);
				ctx.strokeStyle = "#1d2022";
				for (let x = wx + 0.1; x < wx + 0.8; x += 0.15)
					line(ctx, x, 1.0, x, 2.2);
			}
			break;
		}
		case "shuttered": {
			const wood = [0x2f5d4e, 0x4a2e22, 0x3b4a5a, 0x5b3a25][spec.seed % 4];
			woodwork(wood);
			shutter(0.35, w - 1.7);
			door(w - 1.2, 0.85, mix(wood, 0x000000, 0.1));
			break;
		}
	}
}

/* The café terrace: an awning, round tables and rattan chairs facing the street. */

function buildTerrace(parent: THREE.Group, painter: Painter) {
	const x0 = -13.2;
	const x1 = -8.5;
	const width = x1 - x0 + 0.5;
	const cx = (x0 + x1) / 2;
	// Mustard and cream: red belongs to checks on this site.
	const stripes = painter.texture(0.6, 0.6, 64, (ctx) => {
		fill(ctx, "#f1e6c8", 0, 0, 0.6, 0.6);
		fill(ctx, "#d49a2e", 0, 0, 0.3, 0.6);
	});
	stripes.wrapS = THREE.RepeatWrapping;
	stripes.repeat.set(width / 0.6, 1);
	const canvas = toon(0xffffff, { map: stripes });
	const slope = 0.42;
	const reach = 1.3;
	const awning = outline(
		new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, reach), canvas),
		0.02,
	);
	awning.rotation.x = slope;
	awning.position.set(
		cx,
		2.8 - (reach / 2) * Math.sin(slope),
		FRONT_Z + (reach / 2) * Math.cos(slope),
	);
	const valance = outline(
		new THREE.Mesh(new THREE.BoxGeometry(width, 0.26, 0.03), canvas),
		0.02,
	);
	valance.position.set(
		cx,
		2.8 - reach * Math.sin(slope) - 0.13,
		FRONT_Z + reach * Math.cos(slope) + 0.02,
	);
	parent.add(awning, valance);

	const furniture = new Batch(true);
	const seats: Street["seats"] = [];
	const tableZ = 6.74;
	const chairZ = 6.22;
	for (const tx of [-12.3, -10.7, -9.1]) {
		furniture.add(
			new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20),
			tx,
			0.74,
			tableZ,
			{
				color: palette.marble,
			},
		);
		furniture.add(
			new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6),
			tx,
			0.37,
			tableZ,
			{
				color: colors.iron,
				ink: 0.015,
			},
		);
		furniture.add(
			new THREE.CylinderGeometry(0.19, 0.22, 0.03, 14),
			tx,
			0.015,
			tableZ,
			{ color: colors.iron, ink: 0.015 },
		);
		for (const side of [-1, 1]) {
			const x = tx + side * 0.36;
			furniture.add(
				new THREE.CylinderGeometry(0.2, 0.19, 0.05, 14),
				x,
				0.455,
				chairZ,
				{
					color: colors.rattan,
				},
			);
			furniture.add(
				new THREE.BoxGeometry(0.36, 0.3, 0.04),
				x,
				0.72,
				chairZ - 0.19,
				{
					rotation: new THREE.Euler(-0.12, 0, 0),
					color: colors.rattan,
				},
			);
			for (const [dx, dz] of [
				[-0.13, -0.13],
				[0.13, -0.13],
				[-0.13, 0.13],
				[0.13, 0.13],
			]) {
				furniture.add(
					new THREE.CylinderGeometry(0.014, 0.014, 0.44, 5),
					x + dx,
					0.22,
					chairZ + dz,
					{ color: colors.iron, ink: 0.01 },
				);
			}
			seats.push({
				position: new THREE.Vector3(x, 0.48, chairZ),
				facing: new THREE.Vector3(x - side * 0.2, 0.48, 9.5),
			});
		}
	}
	parent.add(furniture.build(toon(0xffffff, { vertexColors: true }), true));
	return seats;
}

/* The restaurant's side of the street: pavement, road and furniture. */

function buildStreetSide(
	street: THREE.Group,
	curb: THREE.Group,
	painter: Painter,
): THREE.PointLight[] {
	const width = EAST - WEST;
	const cx = (WEST + EAST) / 2;

	// Plain volumes in one batch; textured tops laid on them.
	const ground = new Batch(true);
	ground.add(
		new THREE.BoxGeometry(width, 0.7, CURB_Z - FRONT_Z),
		cx,
		-0.35,
		(FRONT_Z + CURB_Z) / 2,
		{ color: colors.kerb, ink: 0.02 },
	);
	ground.add(
		new THREE.BoxGeometry(width, 0.55, FAR_CURB_Z - CURB_Z),
		cx,
		ROAD_Y - 0.275,
		(CURB_Z + FAR_CURB_Z) / 2,
		{ color: 0x3b2a20, ink: 0 },
	);
	street.add(ground.build(toon(0xffffff, { vertexColors: true })));

	const slabs = pavementTexture(painter, false);
	slabs.repeat.set(width / 4, 1);
	street.add(
		groundPlane(
			width,
			CURB_Z - FRONT_Z,
			cx,
			0.003,
			(FRONT_Z + CURB_Z) / 2,
			slabs,
		),
	);
	// Cobbles between two granite gutters, and a zebra crossing.
	const cobbles = cobbleTexture(painter);
	cobbles.repeat.set(width / 3.2, 1);
	street.add(
		groundPlane(
			width,
			FAR_CURB_Z - CURB_Z,
			cx,
			ROAD_Y,
			(CURB_Z + FAR_CURB_Z) / 2,
			cobbles,
		),
	);
	const zebra = painter.texture(2.4, FAR_CURB_Z - CURB_Z, 40, (ctx) => {
		ctx.fillStyle = "#e9e6dc";
		for (let z = 0.35; z < 2.9; z += 0.62) ctx.fillRect(0, z, 2.4, 0.36);
	});
	const crossing = groundPlane(
		2.4,
		FAR_CURB_Z - CURB_Z,
		LAYOUT.crossing,
		ROAD_Y + 0.004,
		(CURB_Z + FAR_CURB_Z) / 2,
		zebra,
	);
	(crossing.material as THREE.MeshToonMaterial).alphaTest = 0.5;
	street.add(crossing);

	const lamps: THREE.PointLight[] = [];
	const furniture = new Batch(true);
	const glass = new Batch();
	const trunks = new Batch();
	const crowns = new Batch(true);
	for (const [x, lit] of LAYOUT.nearLamps) {
		const light = lampPost(furniture, glass, x, KERB_LINE, lit);
		if (light) lamps.push(light);
	}
	// Plane trees stand where two houses meet: the restaurant's own front falls onto its pavement.
	for (const [i, x] of LAYOUT.nearTrees.entries()) {
		planeTree(trunks, crowns, furniture, {
			x,
			z: KERB_LINE - 0.02,
			grateZ: CURB_Z - 0.32,
			height: 3.1 + (i % 3) * 0.25,
			seed: i,
		});
	}
	for (const x of LAYOUT.nearBollards) bollard(furniture, x, KERB_LINE);
	street.add(
		furniture.build(toon(0xffffff, { vertexColors: true }), true),
		glass.build(new THREE.MeshBasicMaterial({ color: colors.lantern })),
		trunks.build(toon(0xffffff, { map: barkTexture(painter) }), true),
		crowns.build(toon(0xffffff, { vertexColors: true }), true),
		...lamps,
	);

	// Lyon bollards in front of the restaurant: they go first when the house opens.
	const bollards = new Batch(true);
	for (let x = -7.6; x < CLEAR.x0; x += 1.35) bollard(bollards, x, KERB_LINE);
	for (let x = CLEAR.x1 + 1.2; x < HOUSE_X; x += 1.35) {
		bollard(bollards, x, KERB_LINE);
	}
	curb.add(bollards.build(toon(0xffffff, { vertexColors: true }), true));
	return lamps;
}

/** A flat textured rectangle on the ground, facing up. */
function groundPlane(
	width: number,
	depth: number,
	x: number,
	y: number,
	z: number,
	map: THREE.Texture,
): THREE.Mesh {
	const plane = new THREE.Mesh(
		new THREE.PlaneGeometry(width, depth),
		toon(0xffffff, { map }),
	);
	plane.rotation.x = -Math.PI / 2;
	plane.position.set(x, y, z);
	plane.receiveShadow = true;
	return plane;
}

/** A Lyon street lamp: cast-iron post, hexagonal lantern. Returns its light if it has one. */
function lampPost(
	iron: Batch,
	glass: Batch,
	x: number,
	z: number,
	lit: boolean,
): THREE.PointLight | undefined {
	const post = { color: colors.lampPost };
	iron.add(new THREE.CylinderGeometry(0.15, 0.19, 0.42, 10), x, 0.21, z, post);
	iron.add(new THREE.CylinderGeometry(0.055, 0.075, 3.1, 8), x, 1.97, z, post);
	iron.add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), x, 1.2, z, post);
	iron.add(new THREE.CylinderGeometry(0.12, 0.07, 0.14, 8), x, 3.58, z, post);
	glass.add(new THREE.CylinderGeometry(0.21, 0.13, 0.5, 6), x, 3.9, z, {
		ink: 0.02,
	});
	iron.add(new THREE.ConeGeometry(0.29, 0.28, 6), x, 4.29, z, post);
	iron.add(new THREE.SphereGeometry(0.05, 8, 6), x, 4.47, z, {
		...post,
		ink: 0.015,
	});
	if (!lit) return undefined;
	// Warm and short: it lights its own patch of pavement and the house behind.
	const light = new THREE.PointLight(0xffc46b, 8, 8.5, 1.5);
	light.position.set(x, 3.7, z + 0.1);
	return light;
}

/** The Lyon bollard: a black post with a round head. */
function bollard(batch: Batch, x: number, z: number) {
	const iron = { color: colors.iron };
	batch.add(new THREE.CylinderGeometry(0.07, 0.085, 0.72, 10), x, 0.36, z, {
		...iron,
		ink: 0.02,
	});
	batch.add(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 10), x, 0.63, z, {
		...iron,
		ink: 0.015,
	});
	batch.add(new THREE.SphereGeometry(0.095, 12, 8), x, 0.8, z, {
		...iron,
		ink: 0.02,
	});
}

/** A plane tree: mottled trunk, two boughs, a crown of round clumps, an iron grate. */
function planeTree(
	trunks: Batch,
	crowns: Batch,
	iron: Batch,
	at: { x: number; z: number; grateZ: number; height: number; seed: number },
) {
	const { x, z, height } = at;
	const rand = random(at.seed * 31 + 5);
	trunks.add(
		new THREE.CylinderGeometry(0.12, 0.17, height, 9),
		x,
		height / 2,
		z,
	);
	for (const side of [-1, 1]) {
		trunks.add(
			new THREE.CylinderGeometry(0.06, 0.09, 1.2, 7),
			x + side * 0.28,
			height + 0.4,
			z,
			{ rotation: new THREE.Euler(0, 0, -side * 0.55) },
		);
	}
	iron.add(new THREE.BoxGeometry(0.62, 0.02, 0.62), x, 0.01, at.grateZ, {
		color: colors.iron,
		ink: 0.01,
	});
	const greens = [0x3d6b3a, 0x4a7a3c, 0x365f35, 0x5d7f3a];
	const clumps: [number, number, number, number][] = [
		[0, 1.6, 0, 1.4],
		[-1.1, 1.15, 0.1, 1.05],
		[1.1, 1.25, -0.1, 1.1],
		[-0.5, 2.3, -0.2, 1.0],
		[0.6, 2.2, 0.25, 0.95],
	];
	for (const [dx, dy, dz, r] of clumps) {
		const geometry = new THREE.IcosahedronGeometry(r * (0.9 + rand() * 0.2), 2);
		geometry.scale(1, 0.82, 0.9);
		crowns.add(geometry, x + dx, height + dy, z + dz, {
			color: greens[Math.floor(rand() * greens.length)],
			ink: 0.03,
		});
	}
}

/* Across the street: the pavement along the quay, the Saône, and the foreground. */

function buildQuay(across: THREE.Group, painter: Painter): THREE.PointLight[] {
	const width = EAST - WEST;
	const cx = (WEST + EAST) / 2;
	const quayDepth = QUAY_Z - FAR_CURB_Z;
	const quayHeight = -WATER_Y + 0.3;

	const ground = new Batch(true);
	ground.add(
		new THREE.BoxGeometry(width, quayHeight, quayDepth),
		cx,
		-quayHeight / 2,
		(FAR_CURB_Z + QUAY_Z) / 2,
		{ color: colors.pavement, ink: 0.02 },
	);
	// The coping stone along the edge of the quay: the bottom of the picture.
	ground.add(new THREE.BoxGeometry(width, 0.16, 0.44), cx, 0, QUAY_Z - 0.1, {
		color: colors.coping,
	});
	across.add(ground.build(toon(0xffffff, { vertexColors: true })));

	const slabs = pavementTexture(painter, true);
	slabs.repeat.set(width / 4, 1);
	across.add(
		groundPlane(
			width,
			quayDepth - 0.3,
			cx,
			0.003,
			(FAR_CURB_Z + QUAY_Z - 0.3) / 2,
			slabs,
		),
	);
	const stone = quayTexture(painter, quayHeight);
	stone.repeat.set(width / 8, 1);
	const wall = new THREE.Mesh(
		new THREE.PlaneGeometry(width, quayHeight - 0.08),
		toon(0xffffff, { map: stone }),
	);
	wall.position.set(cx, -quayHeight / 2 - 0.04, QUAY_Z + 0.003);
	across.add(wall);

	// The Saône: ripples, and broken golden streaks under the lights.
	const ripples = painter.texture(6, 6, 48, (ctx) => {
		const rand = random(71);
		fill(ctx, colors.water, 0, 0, 6, 6);
		for (let i = 0; i < 70; i++) {
			ctx.fillStyle = i % 3 ? "#1b3a4a" : "#24495a";
			ctx.fillRect(
				rand() * 6,
				rand() * 6,
				0.25 + rand() * 0.8,
				0.09 + rand() * 0.08,
			);
		}
	});
	ripples.wrapS = THREE.RepeatWrapping;
	ripples.wrapT = THREE.RepeatWrapping;
	ripples.repeat.set(width / 6, (WATER_END_Z - QUAY_Z) / 6);
	const water = new THREE.Mesh(
		new THREE.PlaneGeometry(width, WATER_END_Z - QUAY_Z),
		new THREE.MeshBasicMaterial({ map: ripples }),
	);
	water.rotation.x = -Math.PI / 2;
	water.position.set(cx, WATER_Y, (QUAY_Z + WATER_END_Z) / 2);
	// Seen from this low, the far edge of the water would show the void: a wall of water closes it.
	const end = new THREE.Mesh(
		new THREE.PlaneGeometry(width, 12),
		new THREE.MeshBasicMaterial({ color: colors.water }),
	);
	end.position.set(cx, WATER_Y - 6, WATER_END_Z);
	across.add(water, end);

	// Each column sits right under its light as the street camera sees it, so it
	// drifts in x as it comes forward. [x, z, width, colour] of each source.
	const streaks = new Batch(true);
	const rand = random(5);
	const gold = 0xe8b24f;
	const sources: [number, number, number, number][] = [
		...LAYOUT.nearLamps.map(([x]): [number, number, number, number] => [
			x,
			KERB_LINE,
			0.8,
			gold,
		]),
		...LAYOUT.farLamps.map(([x]): [number, number, number, number] => [
			x,
			FAR_TREE_LINE,
			0.8,
			gold,
		]),
		[-3.8, FRONT_Z, 2.4, 0xf2c46a],
		[5.1, FRONT_Z, 1.9, 0xf2c46a],
		[-11, FRONT_Z, 1.8, 0xf2c46a],
		[11, FRONT_Z, 1.8, 0xf2c46a],
		[-18.5, FRONT_Z, 1.4, 0x7fcf98],
		[-28.2, FRONT_Z, 1.6, 0xf2c46a],
		[34.5, FRONT_Z, 1.6, 0xf2c46a],
	];
	const drift = VIEW.x / VIEW.z;
	for (const [x, z, width, color] of sources) {
		const count = 4 + Math.floor(rand() * 3);
		for (let k = 0; k < count; k++) {
			const zd = QUAY_Z + 0.25 + k * 0.75 + rand() * 0.3;
			const w = width * (1 - k * 0.13) * (0.55 + rand() * 0.5);
			streaks.add(
				new THREE.PlaneGeometry(w, 0.22 + rand() * 0.14),
				x + (zd - z) * drift + (rand() - 0.5) * 0.3,
				WATER_Y + 0.01,
				zd,
				{
					rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
					color:
						rand() < 0.2
							? 0xfff0c4
							: k % 2
								? mixHex(color, 0x0f2531, 0.3)
								: color,
					ink: 0,
				},
			);
		}
	}
	across.add(
		streaks.build(new THREE.MeshBasicMaterial({ vertexColors: true })),
	);

	// The foreground, on the sides only: never over the door or the windows.
	const lamps: THREE.PointLight[] = [];
	const furniture = new Batch(true);
	const glass = new Batch();
	const trunks = new Batch();
	const crowns = new Batch(true);
	for (const [x, lit] of LAYOUT.farLamps) {
		const light = lampPost(furniture, glass, x, FAR_TREE_LINE + 0.1, lit);
		if (light) lamps.push(light);
	}
	// Tall, pruned quay trees: their crowns ride above the shop signs.
	for (const [i, x] of LAYOUT.farTrees.entries()) {
		planeTree(trunks, crowns, furniture, {
			x,
			z: FAR_TREE_LINE,
			grateZ: FAR_TREE_LINE,
			height: 4.3 + (i % 2) * 0.3,
			seed: i + 7,
		});
	}
	for (const x of LAYOUT.farBollards) bollard(furniture, x, FAR_KERB_LINE);
	across.add(
		furniture.build(toon(0xffffff, { vertexColors: true }), true),
		glass.build(new THREE.MeshBasicMaterial({ color: colors.lantern })),
		trunks.build(toon(0xffffff, { map: barkTexture(painter) }), true),
		crowns.build(toon(0xffffff, { vertexColors: true }), true),
		...lamps,
	);
	return lamps;
}

/* Far away: the roofs of the next streets, then Fourvière hill against the night sky. */

/** A group facing the street camera: local x and y match the screen, whatever the depth. */
function backdrop(depth: number): THREE.Group {
	const g = new THREE.Group();
	g.position.copy(VIEW_TARGET).addScaledVector(VIEW, -depth);
	g.lookAt(g.position.clone().add(VIEW));
	return g;
}

function buildTown(parent: THREE.Group) {
	const plane = backdrop(24);
	parent.add(plane);
	const rand = random(29);
	const shapes: THREE.Shape[] = [];
	const windows = new Batch(true);
	const rect = (x0: number, y0: number, x1: number, y1: number) =>
		new THREE.Shape([
			new THREE.Vector2(x0, y0),
			new THREE.Vector2(x1, y0),
			new THREE.Vector2(x1, y1),
			new THREE.Vector2(x0, y1),
		]);
	for (let u = -80; u < 60; ) {
		const w = 1.4 + rand() * 2.6;
		const top = 5.1 + rand() * 0.7;
		const pitch = rand() < 0.6 ? 0.15 + rand() * 0.25 : 0;
		const block = rect(u, -8, u + w, top);
		if (pitch > 0) {
			shapes.push(
				new THREE.Shape([
					new THREE.Vector2(u, top),
					new THREE.Vector2(u + w, top),
					new THREE.Vector2(u + w / 2, top + pitch),
				]),
			);
		}
		shapes.push(block);
		if (rand() < 0.7) {
			const c = u + 0.3 + rand() * (w - 0.6);
			shapes.push(rect(c - 0.12, top - 0.1, c + 0.12, top + pitch + 0.3));
		}
		// A few lit windows in the top storey.
		for (let x = u + 0.35; x < u + w - 0.3; x += 0.55) {
			if (rand() < 0.28) {
				windows.add(new THREE.PlaneGeometry(0.16, 0.22), x, top - 0.45, 0.01, {
					color: WARM_LIGHTS[Math.floor(rand() * WARM_LIGHTS.length)],
					ink: 0,
				});
			}
		}
		u += w;
	}
	// The spire of Saint-Nizier, over the Presqu'île.
	shapes.push(
		new THREE.Shape([
			new THREE.Vector2(6.6, 4),
			new THREE.Vector2(7.4, 4),
			new THREE.Vector2(7.4, 5.9),
			new THREE.Vector2(7.0, 6.9),
			new THREE.Vector2(6.6, 5.9),
		]),
	);
	plane.add(
		new THREE.Mesh(
			new THREE.ShapeGeometry(shapes),
			new THREE.MeshBasicMaterial({ color: colors.town }),
		),
		windows.build(new THREE.MeshBasicMaterial({ vertexColors: true })),
	);
}

function buildSky(parent: THREE.Group, painter: Painter) {
	// The sky: night blue, a touch lighter near the horizon, where the city glows.
	const far = backdrop(64);
	parent.add(far);
	const gradient = painter.pixels(4, 128, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, 128);
		g.addColorStop(0, "#0b1824");
		g.addColorStop(0.55, "#0f2030");
		g.addColorStop(1, "#1f3749");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 4, 128);
	});
	const sky = new THREE.Mesh(
		new THREE.PlaneGeometry(150, 40),
		new THREE.MeshBasicMaterial({ map: gradient }),
	);
	sky.position.set(-10, 13, 0);
	far.add(sky);

	// Stars, and the moon over the left-hand roofs.
	const moonAt = new THREE.Vector2(-5.8, 8.1);
	const stars = new Batch(true);
	const rand = random(11);
	for (let i = 0; i < 150; i++) {
		const u = -48 + rand() * 90;
		const v = 6.9 + rand() * 9;
		const r = 0.025 + rand() * 0.045;
		const color = rand() < 0.8 ? colors.moon : 0xffffff;
		if (moonAt.distanceTo(new THREE.Vector2(u, v)) < 1.2) continue;
		stars.add(new THREE.CircleGeometry(r, 6), u, v, 0.1, { color, ink: 0 });
	}
	far.add(stars.build(new THREE.MeshBasicMaterial({ vertexColors: true })));
	const moon = new THREE.Mesh(
		new THREE.CircleGeometry(0.62, 40),
		new THREE.MeshBasicMaterial({ color: colors.moon }),
	);
	moon.position.set(moonAt.x, moonAt.y, 0.2);
	const halo = new THREE.Mesh(
		new THREE.CircleGeometry(0.95, 40),
		new THREE.MeshBasicMaterial({
			color: colors.moon,
			transparent: true,
			opacity: 0.12,
			depthWrite: false,
		}),
	);
	halo.position.set(moonAt.x, moonAt.y, 0.15);
	far.add(moon, halo);

	// Fourvière hill, wooded, with the lights of the old town at its foot.
	const hill = backdrop(50);
	parent.add(hill);
	const crest: [number, number][] = [
		[-85, 6.3],
		[-52, 6.7],
		[-38, 6.35],
		[-26, 6.55],
		[-15, 6.2],
		[-8, 5.7],
		[-4.8, 5.8],
		[1.6, 5.8],
		[4.8, 5.58],
		[8.5, 5.35],
		[12.5, 5.08],
		[18, 5.2],
		[27, 5.7],
		[38, 6.1],
		[70, 6.4],
	];
	const ridge = [new THREE.Vector2(-85, -10)];
	for (let u = -85; u <= 70; u += 0.3) {
		ridge.push(new THREE.Vector2(u, ridgeHeight(crest, u) + treeLine(u)));
	}
	ridge.push(new THREE.Vector2(70, -10));
	hill.add(
		new THREE.Mesh(
			new THREE.ShapeGeometry(new THREE.Shape(ridge)),
			new THREE.MeshBasicMaterial({ color: colors.hill }),
		),
	);
	const lights = new Batch(true);
	const lightRand = random(3);
	for (let i = 0; i < 260; i++) {
		const u = -45 + lightRand() * 80;
		// Most of the hillside hides behind the roofs: the lights gather under the crest.
		const top = ridgeHeight(crest, u) - 0.18;
		const v = top - lightRand() ** 2 * 1.6;
		const color = lightRand() < 0.75 ? 0xffc857 : 0xf3efe0;
		lights.add(new THREE.PlaneGeometry(0.06, 0.06), u, v, 0.05, {
			color,
			ink: 0,
		});
	}
	hill.add(lights.build(new THREE.MeshBasicMaterial({ vertexColors: true })));

	// The basilica, floodlit, and the metal tower beside it.
	const landmark = (map: THREE.Texture, w: number, h: number) =>
		new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshBasicMaterial({
				map,
				transparent: true,
				depthWrite: false,
			}),
		);
	const basilica = landmark(basilicaTexture(painter), 2.4, 1.3);
	// Low enough to clear the top of a phone screen, where the view ends at about v = 7.2.
	basilica.position.set(-1.6, 5.64 + 0.65, 0.1);
	const tower = landmark(towerTexture(painter), 0.6, 1.4);
	tower.position.set(3.4, 5.4 + 0.7, 0.1);
	hill.add(basilica, tower);
}

/** Smooth crest through the control points, eased between them. */
function ridgeHeight(points: [number, number][], u: number): number {
	for (let i = 0; i < points.length - 1; i++) {
		const [u0, v0] = points[i];
		const [u1, v1] = points[i + 1];
		if (u >= u0 && u <= u1) {
			const t = (1 - Math.cos(((u - u0) / (u1 - u0)) * Math.PI)) / 2;
			return v0 + (v1 - v0) * t;
		}
	}
	return points[points.length - 1][1];
}

/** Bumps along the crest: the trees of the hill. */
function treeLine(u: number): number {
	return 0.07 * Math.abs(Math.sin(u * 2.1)) + 0.04 * Math.sin(u * 5.3 + 1);
}

function basilicaTexture(painter: Painter) {
	return painter.texture(2.4, 1.3, 200, (ctx) => {
		const lit = "#efe3c2";
		const shade = "#cdbf9c";
		const slit = "#6d6a5a";
		// Body, a gabled nave, the apse on the right.
		fill(ctx, lit, 0.45, 0, 1.55, 0.52);
		ctx.fillStyle = shade;
		ctx.beginPath();
		ctx.moveTo(0.45, 0.52);
		ctx.lineTo(2.0, 0.52);
		ctx.lineTo(1.95, 0.64);
		ctx.lineTo(0.5, 0.64);
		ctx.fill();
		ctx.fillStyle = lit;
		ctx.beginPath();
		ctx.arc(2.0, 0, 0.3, 0, Math.PI / 2);
		ctx.lineTo(2.0, 0);
		ctx.fill();
		// Four octagonal towers, crenellated.
		for (const x of [0.42, 0.72, 1.72, 2.02]) {
			const tone = x === 0.72 || x === 1.72 ? shade : lit;
			fill(ctx, tone, x - 0.1, 0, 0.2, 0.9);
			fill(ctx, tone, x - 0.12, 0.86, 0.24, 0.06);
			for (const dx of [-0.09, -0.02, 0.05])
				fill(ctx, tone, x + dx, 0.92, 0.04, 0.05);
			fill(ctx, slit, x - 0.02, 0.45, 0.04, 0.22);
		}
		for (let x = 0.95; x < 1.6; x += 0.13) fill(ctx, slit, x, 0.2, 0.05, 0.2);
		// The old chapel's bell tower, and the golden Virgin on top.
		fill(ctx, lit, 0.02, 0, 0.2, 0.95);
		ctx.fillStyle = lit;
		ctx.beginPath();
		ctx.arc(0.12, 0.95, 0.1, 0, Math.PI);
		ctx.fill();
		fill(ctx, "#f2c230", 0.1, 1.05, 0.04, 0.16);
		ctx.fillStyle = "#f2c230";
		ctx.beginPath();
		ctx.arc(0.12, 1.23, 0.025, 0, Math.PI * 2);
		ctx.fill();
	});
}

function towerTexture(painter: Painter) {
	return painter.texture(0.6, 1.4, 200, (ctx) => {
		ctx.strokeStyle = "#d4d9da";
		ctx.lineWidth = 0.03;
		ctx.beginPath();
		ctx.moveTo(0.1, 0);
		ctx.lineTo(0.27, 1.1);
		ctx.moveTo(0.5, 0);
		ctx.lineTo(0.33, 1.1);
		ctx.stroke();
		// Lattice bracing between the legs.
		ctx.lineWidth = 0.015;
		for (let y = 0; y < 1.05; y += 0.15) {
			const a = 0.1 + (0.17 * y) / 1.1;
			const b = 0.1 + (0.17 * (y + 0.15)) / 1.1;
			ctx.beginPath();
			ctx.moveTo(a, y);
			ctx.lineTo(0.6 - b, y + 0.15);
			ctx.moveTo(0.6 - a, y);
			ctx.lineTo(b, y + 0.15);
			ctx.stroke();
		}
		fill(ctx, "#d4d9da", 0.2, 0.78, 0.2, 0.04);
		fill(ctx, "#d4d9da", 0.285, 1.1, 0.03, 0.2);
		// Its warning light, amber.
		ctx.fillStyle = "#ffc857";
		ctx.beginPath();
		ctx.arc(0.3, 1.32, 0.035, 0, Math.PI * 2);
		ctx.fill();
	});
}

/* Ground textures, in world units. */

/** Stone slabs. The kerb runs along the road: bottom edge near, top edge across. */
function pavementTexture(painter: Painter, across: boolean) {
	const depth = across ? QUAY_Z - FAR_CURB_Z - 0.3 : CURB_Z - FRONT_Z;
	const texture = painter.texture(4, depth, 64, (ctx) => {
		const rand = random(across ? 17 : 9);
		fill(ctx, "#a39c8c", 0, 0, 4, depth);
		const tones = ["#cbc4b3", "#c3bba9", "#d0c9b9", "#c7c0ae"];
		const kerb = 0.24;
		const y0 = across ? 0 : kerb;
		const y1 = across ? depth - kerb : depth;
		for (let y = y0, row = 0; y < y1; y += 0.62, row++) {
			const h = Math.min(0.6, y1 - y - 0.02);
			for (let x = row % 2 ? -0.45 : 0; x < 4; x += 0.9) {
				fill(
					ctx,
					tones[Math.floor(rand() * tones.length)],
					x + 0.02,
					y + 0.02,
					0.86,
					h,
				);
			}
		}
		// Granite kerb.
		const ky = across ? depth - kerb : 0;
		fill(ctx, "#b3afa6", 0, ky, 4, kerb);
		ctx.strokeStyle = "#8f8b82";
		ctx.lineWidth = 0.02;
		for (let x = 0.5; x < 4; x += 1) line(ctx, x, ky, x, ky + kerb);
	});
	texture.wrapS = THREE.RepeatWrapping;
	return texture;
}

function cobbleTexture(painter: Painter) {
	const depth = FAR_CURB_Z - CURB_Z;
	const texture = painter.texture(3.2, depth, 80, (ctx) => {
		const rand = random(23);
		fill(ctx, "#4b4845", 0, 0, 3.2, depth);
		const tones = ["#6d6a66", "#77726c", "#625f5b", "#7e7973"];
		const gutter = 0.3;
		for (
			let y = gutter + 0.02, row = 0;
			y < depth - gutter - 0.18;
			y += 0.2, row++
		) {
			for (let x = row % 2 ? -0.1 : 0; x < 3.2; x += 0.2) {
				ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
				ctx.beginPath();
				ctx.roundRect(x + 0.02, y + 0.02, 0.16, 0.16, 0.05);
				ctx.fill();
			}
		}
		// Smooth granite gutters along both kerbs.
		for (const y of [0, depth - gutter]) {
			fill(ctx, "#86837d", 0, y, 3.2, gutter);
			ctx.strokeStyle = "#5e5b56";
			ctx.lineWidth = 0.02;
			for (let x = 0.4; x < 3.2; x += 0.8) line(ctx, x, y, x, y + gutter);
		}
	});
	texture.wrapS = THREE.RepeatWrapping;
	return texture;
}

/** Dressed stone of the quay wall, darker and greener where the river touches it. */
function quayTexture(painter: Painter, height: number) {
	const texture = painter.texture(8, height, 40, (ctx) => {
		const rand = random(41);
		fill(ctx, "#8a7f6c", 0, 0, 8, height);
		const tones = ["#b3a68d", "#aa9d84", "#b9ad95", "#a5987f"];
		for (let y = 0, row = 0; y < height; y += 0.45, row++) {
			for (let x = row % 2 ? -0.5 : 0; x < 8; ) {
				const w = 0.9 + rand() * 0.7;
				const tone = tones[Math.floor(rand() * tones.length)];
				fill(ctx, tone, x + 0.025, y + 0.025, w - 0.05, 0.4);
				x += w;
			}
		}
		// Wet foot of the wall, and a mooring ring.
		ctx.fillStyle = "rgba(34, 52, 44, 0.55)";
		ctx.fillRect(0, 0, 8, 0.35);
		ctx.fillStyle = "rgba(34, 52, 44, 0.3)";
		for (let i = 0; i < 9; i++) {
			ctx.fillRect(rand() * 8, 0.3, 0.08 + rand() * 0.1, 0.2 + rand() * 0.4);
		}
		ctx.strokeStyle = "#2a2d2e";
		ctx.lineWidth = 0.05;
		ctx.beginPath();
		ctx.arc(4, height * 0.45, 0.14, 0, Math.PI * 2);
		ctx.stroke();
		fill(ctx, "#2a2d2e", 3.94, height * 0.45 + 0.14, 0.12, 0.1);
	});
	texture.wrapS = THREE.RepeatWrapping;
	return texture;
}

function barkTexture(painter: Painter) {
	return painter.texture(1, 2, 64, (ctx) => {
		const rand = random(61);
		fill(ctx, "#7f7c60", 0, 0, 1, 2);
		const patches = ["#bdb792", "#5f624b", "#a49f7c", "#948f6e"];
		for (let i = 0; i < 26; i++) {
			ctx.fillStyle = patches[i % patches.length];
			ctx.beginPath();
			ctx.ellipse(
				rand(),
				rand() * 2,
				0.06 + rand() * 0.12,
				0.08 + rand() * 0.14,
				rand() * 3,
				0,
				Math.PI * 2,
			);
			ctx.fill();
		}
	});
}

/* Helpers */

/** Canvas textures, drawn in world units (y up) or in pixels. Lettering can be redrawn. */
class Painter {
	private lettering: (() => void)[] = [];

	/** Draws in world units: `scale` pixels per unit, y pointing up from the bottom edge. */
	texture(
		width: number,
		height: number,
		scale: number,
		draw: Painting,
	): THREE.CanvasTexture {
		const w = Math.ceil(width * scale);
		const h = Math.ceil(height * scale);
		return this.pixels(w, h, (ctx) => {
			ctx.setTransform(w / width, 0, 0, -h / height, 0, h);
			draw(ctx);
		});
	}

	pixels(
		width: number,
		height: number,
		draw: Painting,
		lettered = false,
	): THREE.CanvasTexture {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = 4;
		const redraw = () => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, width, height);
			draw(ctx);
			texture.needsUpdate = true;
		};
		redraw();
		if (lettered) this.lettering.push(redraw);
		return texture;
	}

	redraw() {
		for (const redraw of this.lettering) redraw();
	}
}

const ink = new THREE.MeshBasicMaterial({
	color: palette.ink,
	side: THREE.BackSide,
});

/**
 * Many small parts merged into one mesh, and their ink shells into another:
 * two draw calls however many bollards, chairs or leaves.
 */
class Batch {
	private parts: THREE.BufferGeometry[] = [];
	private shells: THREE.BufferGeometry[] = [];

	constructor(private colored = false) {}

	add(
		geometry: THREE.BufferGeometry,
		x: number,
		y: number,
		z: number,
		options: { rotation?: THREE.Euler; color?: number; ink?: number } = {},
	): this {
		const matrix = new THREE.Matrix4().compose(
			new THREE.Vector3(x, y, z),
			new THREE.Quaternion().setFromEuler(
				options.rotation ?? new THREE.Euler(),
			),
			new THREE.Vector3(1, 1, 1),
		);
		const part = strip(geometry, ["position", "normal", "uv"]);
		part.applyMatrix4(matrix);
		if (this.colored) {
			const color = new THREE.Color(options.color ?? 0xffffff);
			const count = part.attributes.position.count;
			const data = new Float32Array(count * 3);
			for (let i = 0; i < count; i++) {
				data.set([color.r, color.g, color.b], i * 3);
			}
			part.setAttribute("color", new THREE.BufferAttribute(data, 3));
		}
		this.parts.push(part);
		// The shell is the part blown up around its own centre, as thick on every side.
		const thickness = options.ink ?? 0.025;
		if (thickness > 0) {
			const shell = strip(geometry, ["position"]);
			shell.computeBoundingBox();
			const box = shell.boundingBox ?? new THREE.Box3();
			const size = box.getSize(new THREE.Vector3());
			const centre = box.getCenter(new THREE.Vector3());
			const s = (v: number) => (v < 1e-4 ? 1 : (v + thickness * 2) / v);
			shell
				.translate(-centre.x, -centre.y, -centre.z)
				.scale(s(size.x), s(size.y), s(size.z))
				.translate(centre.x, centre.y, centre.z)
				.applyMatrix4(matrix);
			this.shells.push(shell);
		}
		geometry.dispose();
		return this;
	}

	build(material: THREE.Material, shadows = false): THREE.Mesh {
		const mesh = new THREE.Mesh(merge(this.parts), material);
		mesh.castShadow = shadows;
		mesh.receiveShadow = true;
		if (this.shells.length > 0) {
			const shell = new THREE.Mesh(merge(this.shells), ink);
			shell.raycast = () => {};
			mesh.add(shell);
		}
		return mesh;
	}
}

function strip(geometry: THREE.BufferGeometry, keep: string[]) {
	const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
	for (const name of Object.keys(g.attributes)) {
		if (!keep.includes(name)) g.deleteAttribute(name);
	}
	g.clearGroups();
	return g;
}

function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
	const merged = mergeGeometries(geometries);
	if (!merged) throw new Error("Street: parts could not be merged");
	return merged;
}

/** Deterministic noise, so the street is the same at every visit. */
function random(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Blends two colours in sRGB; t = 0 gives a. */
function mixHex(a: number, b: number, t: number): number {
	const channel = (s: number) => {
		const ca = (a >> s) & 255;
		const cb = (b >> s) & 255;
		return Math.round(ca + (cb - ca) * t) << s;
	};
	return channel(16) | channel(8) | channel(0);
}

const mix = (a: number, b: number, t: number) => hex(mixHex(a, b, t));

function fill(
	ctx: Ctx,
	color: number | string,
	x: number,
	y: number,
	w: number,
	h: number,
) {
	ctx.fillStyle = typeof color === "number" ? hex(color) : color;
	ctx.fillRect(x, y, w, h);
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number) {
	ctx.beginPath();
	ctx.moveTo(x0, y0);
	ctx.lineTo(x1, y1);
	ctx.stroke();
}

const font = (weight: number, size: number) =>
	`${weight} ${size}px Recursive, ui-sans-serif, system-ui, sans-serif`;
