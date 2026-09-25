import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

/**
 * Hand-drawn paths from Rough.js, computed without a DOM so they render the same
 * on the server and in the browser. A fixed seed keeps each drawing stable.
 * Colors come from CSS (stroke: currentColor), not from Rough.js.
 */
const generator = rough.generator();

const base: Options = { roughness: 1.1, bowing: 1.2, strokeWidth: 1.4 };

function toPaths(drawable: ReturnType<typeof generator.line>): string[] {
	return generator.toPaths(drawable).map((p) => p.d);
}

export function sketchRect(
	width: number,
	height: number,
	seed: number,
	inset = 2,
): string[] {
	return toPaths(
		generator.rectangle(inset, inset, width - inset * 2, height - inset * 2, {
			...base,
			seed,
		}),
	);
}

export function sketchLine(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	seed: number,
): string[] {
	return toPaths(
		generator.line(x1, y1, x2, y2, { ...base, seed, roughness: 1.4 }),
	);
}

export function sketchCheck(seed: number): string[] {
	return toPaths(
		generator.linearPath(
			[
				[2, 9],
				[6, 14],
				[15, 2],
			],
			{ ...base, seed, roughness: 0.9, strokeWidth: 1.8 },
		),
	);
}

export function sketchCross(seed: number): string[] {
	return [
		...toPaths(
			generator.line(3, 3, 13, 13, { ...base, seed, strokeWidth: 1.8 }),
		),
		...toPaths(
			generator.line(13, 3, 3, 13, {
				...base,
				seed: seed + 1,
				strokeWidth: 1.8,
			}),
		),
	];
}

export function sketchWave(width: number, seed: number): string[] {
	const points: [number, number][] = [];
	for (let x = 0; x <= width; x += width / 6) {
		points.push([x, 6 + Math.sin(x / 4) * 2]);
	}
	return toPaths(generator.curve(points, { ...base, seed, roughness: 1.3 }));
}

/** A loose ellipse around a word, as a pencil circles it. */
export function sketchEllipse(
	width: number,
	height: number,
	seed: number,
): string[] {
	return toPaths(
		generator.ellipse(width / 2, height / 2, width - 4, height - 4, {
			...base,
			seed,
			roughness: 1.6,
			strokeWidth: 1.6,
		}),
	);
}
