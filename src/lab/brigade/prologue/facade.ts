import * as THREE from "three";
import { block, cylinder, outline, palette, toon } from "../toon";

/**
 * The outside of the restaurant, drawn in code like the kitchen: a Lyon shop front
 * (bottle-green woodwork, ochre plaster upstairs, zinc roof), and what stands at its door.
 * The street around it is in street.ts.
 * The walls are hinged at their base, so they can fall open like the front of a doll's house.
 */

const colors = {
	plaster: 0xd9a066,
	stone: 0xd8cfbb,
	shutter: 0x6e8b7f,
	zinc: 0x7f8b8f,
	brick: 0xa4553a,
	gold: 0xe0b24a,
	slate: 0x2b302e,
	terracotta: 0xb5653a,
	leaf: 0x3d6b3a,
	warmGlass: 0xffcf7d,
	litWindow: 0xffd27a,
	darkWindow: 0x22384d,
};

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Building footprint: it wraps the kitchen diorama exactly. */
const FRONT_Z = 5.8;
const RIGHT_X = 8.3;
const GROUND_FLOOR = 3.4;
const TOP = 6;
/** The door opens right in front of the pass, where the chef stands. */
const DOOR = { x0: 0.7, x1: 1.9, height: 2.4 };

export interface FacadeText {
	name: string;
	tagline: string;
	windowLeft: string;
	windowRight: string[];
	doorPlate: string;
	board: string[];
}

export interface Facade {
	/** Everything outside the kitchen. */
	group: THREE.Group;
	/** Shop front and first floor, hinged on the pavement. */
	front: THREE.Group;
	/** Right-hand wall, hinged on its base. */
	side: THREE.Group;
	roof: THREE.Group;
	/** What stands on the pavement at the door: the chalkboard and two bay trees. */
	props: THREE.Group;
	door: THREE.Group;
	points: {
		/** In front of the door, on the pavement. */
		door: THREE.Vector3;
		/** The menu framed next to the door. */
		menu: THREE.Vector3;
		/** Where the camera looks at the shop front. */
		view: THREE.Vector3;
	};
	/** Redraws the painted lettering once the web font is ready. */
	redraw(): void;
}

/** A canvas texture that can be redrawn, e.g. once the font has loaded. */
function paint(
	width: number,
	height: number,
	draw: (ctx: CanvasRenderingContext2D) => void,
) {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	const redraw = () => {
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, width, height);
		draw(ctx);
		texture.needsUpdate = true;
	};
	redraw();
	return { texture, redraw };
}

const font = (weight: number, size: number) =>
	`${weight} ${size}px Recursive, ui-sans-serif, system-ui, sans-serif`;

export function buildFacade(text: FacadeText): Facade {
	const group = new THREE.Group();
	const painted: (() => void)[] = [];
	const texture = (
		width: number,
		height: number,
		draw: (ctx: CanvasRenderingContext2D) => void,
	) => {
		const t = paint(width, height, draw);
		painted.push(t.redraw);
		return t.texture;
	};

	// Shop front and first floor. The pivot sits on the pavement edge, so the whole
	// front can fall forward. Children use z relative to the outer face of the wall.
	const front = new THREE.Group();
	front.position.set(0, 0, FRONT_Z);
	group.add(front);
	const wall = -0.15;
	const wood = palette.band;

	// Woodwork of the shop front, around the door and the two windows.
	front.add(
		block(DOOR.x0 + RIGHT_X, 0.7, 0.3, wood, (DOOR.x0 - RIGHT_X) / 2, wall),
	);
	front.add(
		block(RIGHT_X - DOOR.x1, 0.7, 0.3, wood, (DOOR.x1 + RIGHT_X) / 2, wall),
	);
	for (const [x0, x1] of [
		[-RIGHT_X, -7.3],
		[-0.3, DOOR.x0],
		[DOOR.x1, 2.6],
		[7.6, RIGHT_X],
	]) {
		front.add(block(x1 - x0, 1.7, 0.3, wood, (x0 + x1) / 2, wall, 0.7));
	}
	front.add(block(RIGHT_X * 2, 1.0, 0.3, wood, 0, wall, DOOR.height));

	// The two windows: warm glass, gold lettering, and red-checked café curtains,
	// as in a Lyon bouchon. The kitchen shows through above the curtains.
	const glass = new THREE.MeshBasicMaterial({
		color: colors.warmGlass,
		transparent: true,
		opacity: 0.3,
		depthWrite: false,
	});
	const gingham = ginghamTexture();
	const windows: [number, number, number[]][] = [
		[-7.3, -0.3, [-4.97, -2.63]],
		[2.6, 7.6, [5.1]],
	];
	for (const [index, [x0, x1, mullions]] of windows.entries()) {
		const w = x1 - x0;
		const cx = (x0 + x1) / 2;
		const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.7), glass);
		pane.position.set(cx, 1.55, -0.06);
		front.add(pane);
		for (const x of mullions)
			front.add(block(0.08, 1.7, 0.08, wood, x, -0.06, 0.7));
		const curtain = new THREE.Mesh(
			new THREE.PlaneGeometry(w, 0.75),
			new THREE.MeshBasicMaterial({ map: gingham, color: 0xffe6c4 }),
		);
		curtain.position.set(cx, 1.08, -0.22);
		gingham.repeat.set(w * 3, 2);
		front.add(curtain);
		const rod = new THREE.Mesh(
			new THREE.CylinderGeometry(0.025, 0.025, w, 8),
			toon(colors.gold),
		);
		rod.rotation.z = Math.PI / 2;
		rod.position.set(cx, 1.46, -0.2);
		front.add(rod);
		const lines = index === 0 ? [text.windowLeft] : text.windowRight;
		const lettering = new THREE.Mesh(
			new THREE.PlaneGeometry(w, 0.8),
			new THREE.MeshBasicMaterial({
				map: letteringTexture(texture, lines, w / 0.8),
				transparent: true,
				depthWrite: false,
			}),
		);
		lettering.position.set(cx, 1.95, -0.01);
		front.add(lettering);
	}

	// The sign, lit by three swan-neck lamps.
	const signFace = new THREE.MeshBasicMaterial({
		map: texture(1900, 100, (ctx) => {
			ctx.fillStyle = hex(wood);
			ctx.fillRect(0, 0, 1900, 100);
			ctx.strokeStyle = hex(colors.gold);
			ctx.lineWidth = 4;
			ctx.strokeRect(10, 10, 1880, 80);
			ctx.fillStyle = hex(colors.gold);
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = font(800, 58);
			ctx.letterSpacing = "14px";
			ctx.fillText(text.name.toUpperCase(), 950, 46);
			ctx.letterSpacing = "3px";
			ctx.font = font(600, 22);
			ctx.textAlign = "left";
			ctx.fillText(text.tagline, 40, 52);
			ctx.textAlign = "right";
			ctx.fillText("Lyon", 1860, 52);
		}),
	});
	const woodMaterial = toon(wood);
	const sign = outline(
		new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.78, 0.1), [
			woodMaterial,
			woodMaterial,
			woodMaterial,
			woodMaterial,
			signFace,
			woodMaterial,
		]),
		0.02,
	);
	sign.position.set(0, 2.9, 0.05);
	front.add(sign);
	for (const x of [-5, 0, 5]) {
		front.add(block(0.05, 0.05, 0.45, palette.ink, x, 0.22, 3.36));
		const shade = new THREE.Mesh(
			new THREE.ConeGeometry(0.13, 0.14, 12, 1, true),
			toon(palette.ink, { side: THREE.DoubleSide }),
		);
		shade.position.set(x, 3.36, 0.45);
		shade.rotation.x = 0.5;
		front.add(shade);
		const bulb = new THREE.Mesh(
			new THREE.SphereGeometry(0.05, 8, 8),
			new THREE.MeshBasicMaterial({ color: palette.lamp }),
		);
		bulb.position.set(x, 3.3, 0.48);
		front.add(bulb);
	}

	// The door, hinged on its left edge. It opens inwards, towards the pass.
	const door = new THREE.Group();
	door.position.set(DOOR.x0 + 0.02, 0, -0.1);
	door.add(block(1.16, DOOR.height - 0.04, 0.08, wood, 0.58, 0.02));
	const doorGlass = new THREE.Mesh(
		new THREE.PlaneGeometry(0.8, 1.2),
		new THREE.MeshBasicMaterial({ color: colors.warmGlass }),
	);
	doorGlass.position.set(0.58, 1.55, 0.065);
	door.add(doorGlass);
	const handle = new THREE.Mesh(
		new THREE.SphereGeometry(0.05, 10, 10),
		toon(colors.gold),
	);
	handle.position.set(1.0, 1.05, 0.1);
	door.add(outline(handle, 0.01));
	const plate = new THREE.Mesh(
		new THREE.PlaneGeometry(0.5, 0.2),
		new THREE.MeshBasicMaterial({
			map: texture(200, 80, (ctx) => {
				ctx.fillStyle = hex(palette.ink);
				ctx.fillRect(0, 0, 200, 80);
				ctx.strokeStyle = hex(colors.gold);
				ctx.lineWidth = 4;
				ctx.strokeRect(5, 5, 190, 70);
				ctx.fillStyle = "#f7f6f1";
				ctx.font = font(700, 34);
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(text.doorPlate, 100, 42);
			}),
		}),
	);
	plate.position.set(0.58, 0.82, 0.07);
	door.add(plate);
	front.add(door);

	// The menu, framed next to the door, as French law requires.
	const menu = block(0.5, 0.66, 0.06, colors.gold, 2.25, 0.03, 1.1);
	const menuPage = new THREE.Mesh(
		new THREE.PlaneGeometry(0.42, 0.58),
		new THREE.MeshBasicMaterial({
			map: texture(84, 116, (ctx) => {
				ctx.fillStyle = "#fbf6e9";
				ctx.fillRect(0, 0, 84, 116);
				ctx.fillStyle = "#56605a";
				for (let i = 0; i < 8; i++)
					ctx.fillRect(12, 16 + i * 12, 60 - (i % 3) * 12, 4);
			}),
		}),
	);
	menuPage.position.set(2.25, 1.43, 0.065);
	front.add(menu, menuPage);

	// First floor: ochre plaster, stone cornices, shuttered windows.
	front.add(
		block(
			RIGHT_X * 2,
			TOP - GROUND_FLOOR,
			0.3,
			colors.plaster,
			0,
			wall,
			GROUND_FLOOR,
		),
	);
	front.add(block(16.9, 0.18, 0.45, colors.stone, 0, -0.05, GROUND_FLOOR));
	front.add(block(17, 0.3, 0.6, colors.stone, 0, 0, TOP - 0.15));
	const lit = [true, false, true, true, false];
	for (const [i, x] of [-6.2, -3.1, 0, 3.1, 6.2].entries()) {
		front.add(block(1.1, 1.62, 0.05, colors.stone, x, 0.025, 3.84));
		const pane = new THREE.Mesh(
			new THREE.PlaneGeometry(0.9, 1.44),
			new THREE.MeshBasicMaterial({
				color: lit[i] ? colors.litWindow : colors.darkWindow,
			}),
		);
		pane.position.set(x, 4.65, 0.055);
		front.add(pane);
		front.add(block(0.9, 0.05, 0.03, colors.stone, x, 0.07, 4.6));
		for (const side of [-1, 1])
			front.add(
				block(0.46, 1.5, 0.05, colors.shutter, x + side * 0.8, 0.04, 3.9),
			);
		if (i % 2 === 0) {
			front.add(block(1.0, 0.2, 0.26, colors.terracotta, x, 0.14, 3.68));
			for (const dx of [-0.3, 0, 0.3]) {
				const flower = new THREE.Mesh(
					new THREE.SphereGeometry(0.1, 10, 8),
					toon(dx === 0 ? palette.check : colors.leaf),
				);
				flower.position.set(x + dx, 3.95, 0.14);
				front.add(outline(flower, 0.015));
			}
		}
	}

	// The right-hand wall, hinged at its base so it can fall outwards.
	const side = new THREE.Group();
	side.position.set(RIGHT_X, 0, 0);
	group.add(side);
	side.add(block(0.3, TOP, 11.3, colors.plaster, -0.15, -0.15));
	side.add(block(0.34, 0.7, 11.3, wood, -0.15, -0.15));
	side.add(block(0.45, 0.18, 11.3, colors.stone, -0.1, -0.15, GROUND_FLOOR));
	for (const z of [-3, 1]) {
		side.add(block(0.05, 1.62, 1.1, colors.stone, 0.025, z, 3.84));
		const pane = new THREE.Mesh(
			new THREE.PlaneGeometry(0.9, 1.44),
			new THREE.MeshBasicMaterial({ color: colors.darkWindow }),
		);
		pane.rotation.y = Math.PI / 2;
		pane.position.set(0.055, 4.65, z);
		side.add(pane);
	}

	// Roof: zinc, two chimneys, and the upper half of the left wall.
	const roof = new THREE.Group();
	group.add(roof);
	const zinc = toon(0xffffff, { map: zincTexture() });
	roof.add(block(16.9, 0.25, 11.9, 0, 0, 0, TOP, zinc));
	for (const [x, z, h] of [
		[-5, -2, 1.1],
		[4.2, -3.5, 0.9],
	]) {
		roof.add(block(0.7, h, 0.5, colors.brick, x, z, TOP + 0.25));
		roof.add(block(0.8, 0.1, 0.6, colors.stone, x, z, TOP + 0.25 + h));
	}
	roof.add(
		block(
			0.3,
			TOP - GROUND_FLOOR,
			11.6,
			colors.plaster,
			-8.15,
			0,
			GROUND_FLOOR,
		),
	);
	roof.add(
		block(
			16.6,
			TOP - GROUND_FLOOR,
			0.3,
			colors.plaster,
			0,
			-5.65,
			GROUND_FLOOR,
		),
	);

	// At the door: the chalkboard and two bay trees in pots.
	const props = new THREE.Group();
	group.add(props);

	// The chalkboard on the pavement: two slates leaning against each other.
	const board = texture(256, 320, (ctx) => {
		ctx.fillStyle = hex(colors.slate);
		ctx.fillRect(0, 0, 256, 320);
		ctx.fillStyle = "#f4f1e8";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const [first = "", ...rest] = text.board;
		ctx.font = font(800, 46);
		ctx.fillText(first, 128, 70);
		ctx.font = font(600, 36);
		rest.forEach((line, i) => {
			ctx.fillText(line, 128, 150 + i * 56);
		});
		ctx.strokeStyle = "#f4f1e8";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(60, 105);
		ctx.lineTo(196, 105);
		ctx.stroke();
	});
	const boardGroup = new THREE.Group();
	boardGroup.position.set(3.7, 0, 6.9);
	boardGroup.rotation.y = -0.35;
	const slate = new THREE.MeshBasicMaterial({ map: board });
	const woodFrame = toon(palette.wood);
	for (const side of [1, -1]) {
		const face = outline(
			new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.05), [
				woodFrame,
				woodFrame,
				woodFrame,
				woodFrame,
				side === 1 ? slate : woodFrame,
				side === -1 ? slate : woodFrame,
			]),
			0.02,
		);
		face.position.set(0, 0.56, side * 0.2);
		face.rotation.x = side * -0.2;
		boardGroup.add(face);
	}
	props.add(boardGroup);

	for (const x of [0.25, 2.35]) {
		props.add(cylinder(0.2, 0.36, colors.terracotta, x, 6.15, 0, 16));
		const bush = new THREE.Mesh(
			new THREE.SphereGeometry(0.3, 16, 12),
			toon(colors.leaf),
		);
		bush.position.set(x, 0.66, 6.15);
		props.add(outline(bush, 0.02));
	}

	return {
		group,
		front,
		side,
		roof,
		props,
		door,
		points: {
			door: new THREE.Vector3((DOOR.x0 + DOOR.x1) / 2, 0, FRONT_Z + 0.6),
			// The tag floats just right of the frame, its arrow pointing back at it.
			menu: new THREE.Vector3(3.2, 1.43, FRONT_Z + 0.1),
			view: new THREE.Vector3(0.6, 2.7, FRONT_Z),
		},
		redraw: () => {
			for (const redraw of painted) redraw();
		},
	};
}

/** Gold lettering painted on the glass, on a transparent background. */
function letteringTexture(
	texture: (
		w: number,
		h: number,
		draw: (ctx: CanvasRenderingContext2D) => void,
	) => THREE.Texture,
	lines: string[],
	aspect: number,
): THREE.Texture {
	const height = 200;
	const width = Math.round(height * aspect);
	return texture(width, height, (ctx) => {
		ctx.fillStyle = hex(colors.gold);
		ctx.strokeStyle = "rgba(27, 30, 28, 0.6)";
		ctx.lineWidth = 4;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const size = lines.length > 1 ? 56 : 72;
		ctx.font = font(800, size);
		lines.forEach((line, i) => {
			const y = height / 2 + (i - (lines.length - 1) / 2) * size * 1.1;
			ctx.strokeText(line, width / 2, y);
			ctx.fillText(line, width / 2, y);
		});
	});
}

function ginghamTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 16;
	canvas.height = 16;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#f7f1e6";
		ctx.fillRect(0, 0, 16, 16);
		ctx.fillStyle = "rgba(192, 57, 43, 0.55)";
		ctx.fillRect(0, 0, 8, 16);
		ctx.fillRect(0, 0, 16, 8);
		ctx.fillStyle = "rgba(160, 40, 30, 0.9)";
		ctx.fillRect(0, 0, 8, 8);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.magFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

function zincTexture(): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 16;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = hex(colors.zinc);
		ctx.fillRect(0, 0, 128, 16);
		ctx.fillStyle = "#65706f";
		for (let x = 0; x < 128; x += 16) ctx.fillRect(x, 0, 2, 16);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(8, 6);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
