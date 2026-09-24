import * as THREE from "three";

/**
 * Ligne claire in 3D: flat toon shading in three tones, plus a black outline
 * drawn with an inverted hull (a slightly larger copy rendered from the back).
 */

export const palette = {
	backdrop: 0x163229,
	ink: 0x1b1e1c,
	floorLight: 0xe9e6dc,
	floorDark: 0x8e9892,
	tile: 0xe8eeeb,
	grout: 0xbfcac6,
	band: 0x2f5d4e,
	steel: 0xaeb8bb,
	steelTop: 0xd6dcde,
	steelDark: 0x5f6a6d,
	wood: 0x8a5a3b,
	woodDark: 0x5b3a25,
	copper: 0xc8794b,
	whites: 0xf7f6f1,
	trousers: 0x2b2f2d,
	model: 0x2c5f9e,
	check: 0xc0392b,
	lamp: 0xffc857,
	marble: 0xf2f1ec,
	glass: 0xbfe3e6,
	skins: [0x8d5524, 0xc68642, 0xe0ac69, 0x5c3a21],
} as const;

const gradientMap = (() => {
	const texture = new THREE.DataTexture(
		new Uint8Array([110, 185, 255]),
		3,
		1,
		THREE.RedFormat,
	);
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
})();

const outlineMaterial = new THREE.MeshBasicMaterial({
	color: palette.ink,
	side: THREE.BackSide,
});

export function toon(
	color: number,
	options: THREE.MeshToonMaterialParameters = {},
): THREE.MeshToonMaterial {
	return new THREE.MeshToonMaterial({ color, gradientMap, ...options });
}

/** Adds the ink outline around a centered geometry, with the same thickness on every side. */
export function outline<T extends THREE.Mesh>(mesh: T, thickness = 0.03): T {
	mesh.geometry.computeBoundingBox();
	const size = new THREE.Vector3();
	mesh.geometry.boundingBox?.getSize(size);
	const scale = (s: number) => (s < 1e-4 ? 1 : (s + thickness * 2) / s);
	const shell = new THREE.Mesh(mesh.geometry, outlineMaterial);
	shell.scale.set(scale(size.x), scale(size.y), scale(size.z));
	shell.raycast = () => {};
	mesh.add(shell);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

/** A box whose base sits at y. */
export function block(
	w: number,
	h: number,
	d: number,
	color: number,
	x: number,
	z: number,
	y = 0,
	material?: THREE.Material,
): THREE.Mesh {
	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(w, h, d),
		material ?? toon(color),
	);
	mesh.position.set(x, y + h / 2, z);
	return outline(mesh);
}

export function cylinder(
	radius: number,
	h: number,
	color: number,
	x: number,
	z: number,
	y = 0,
	segments = 20,
): THREE.Mesh {
	const mesh = new THREE.Mesh(
		new THREE.CylinderGeometry(radius, radius, h, segments),
		toon(color),
	);
	mesh.position.set(x, y + h / 2, z);
	return outline(mesh, 0.025);
}

/** Canvas-drawn textures: the illustration is code, so it stays crisp and weighs nothing. */
export function checkerTexture(cells: number): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = `#${palette.floorLight.toString(16).padStart(6, "0")}`;
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = `#${palette.floorDark.toString(16).padStart(6, "0")}`;
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillRect(32, 32, 32, 32);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(cells, cells);
	texture.magFilter = THREE.NearestFilter;
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export function metroTileTexture(
	repeatX: number,
	repeatY: number,
): THREE.CanvasTexture {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = `#${palette.grout.toString(16).padStart(6, "0")}`;
		ctx.fillRect(0, 0, 128, 64);
		ctx.fillStyle = `#${palette.tile.toString(16).padStart(6, "0")}`;
		const tile = (x: number, y: number) => ctx.fillRect(x + 2, y + 2, 60, 28);
		tile(0, 0);
		tile(64, 0);
		tile(-32, 32);
		tile(32, 32);
		tile(96, 32);
	}
	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(repeatX, repeatY);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
