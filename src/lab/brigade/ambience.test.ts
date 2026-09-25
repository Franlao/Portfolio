import { describe, expect, it } from "vitest";
import {
	curveAt,
	engineAt,
	fadeCurve,
	noiseLoop,
	offscreen,
	passBy,
	TAXI_IDLE,
} from "./ambience";

/** A seeded generator, so the noise tests never flake. */
function seeded(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe("ambience", () => {
	it("crossfades at equal power", () => {
		const rising = fadeCurve(0, 1);
		const falling = fadeCurve(1, 0);
		expect(rising[0]).toBe(0);
		expect(rising.at(-1)).toBeCloseTo(1, 12);
		expect(falling[0]).toBe(1);
		expect(falling.at(-1)).toBeCloseTo(0, 12);
		for (let i = 0; i < rising.length; i++)
			expect(rising[i] ** 2 + falling[i] ** 2).toBeCloseTo(1, 12);
	});

	it("fades out from wherever a fade-in was cut short", () => {
		const rising = fadeCurve(0, 1);
		const midway = curveAt(rising, 10, 1.5, 10.6);
		expect(midway).toBeGreaterThan(0.4);
		expect(midway).toBeLessThan(1);
		const falling = fadeCurve(midway, 0);
		expect(falling[0]).toBeCloseTo(midway, 12);
		expect(falling.at(-1)).toBeCloseTo(0, 12);
		expect(curveAt(rising, 10, 1.5, 9)).toBe(0);
		expect(curveAt(rising, 10, 1.5, 12)).toBeCloseTo(1, 12);
	});

	it("brings a far car in and out of silence, from one side to the other", () => {
		expect(passBy(0).level).toBeCloseTo(0, 12);
		expect(passBy(1).level).toBeCloseTo(0, 12);
		expect(passBy(0.5).level).toBeCloseTo(1, 12);
		expect(passBy(0).pan).toBeCloseTo(-1, 12);
		expect(passBy(1).pan).toBeCloseTo(1, 12);
		expect(passBy(0.25).pitch).toBeGreaterThan(1);
		expect(passBy(0.75).pitch).toBeLessThan(1);
		let pan = -Infinity;
		for (let i = 0; i <= 20; i++) {
			const next = passBy(i / 20).pan;
			expect(next).toBeGreaterThan(pan);
			pan = next;
		}
	});

	it("revs the taxi louder and higher, with tyres only once it rolls", () => {
		expect(engineAt(0).gain).toBe(0);
		expect(engineAt(TAXI_IDLE).road).toBe(0);
		expect(engineAt(1).road).toBeGreaterThan(0);
		expect(engineAt(1).frequency).toBeGreaterThan(
			engineAt(TAXI_IDLE).frequency,
		);
		expect(engineAt(1).gain).toBeGreaterThan(engineAt(TAXI_IDLE).gain);
		expect(engineAt(2)).toEqual(engineAt(1));
	});

	it("quietens what is off-screen with the distance", () => {
		expect(offscreen(0)).toBe(1);
		expect(offscreen(-1)).toBe(1);
		expect(offscreen(2)).toBeLessThan(1);
		expect(offscreen(-3)).toBeLessThan(offscreen(2));
	});

	it.each(["white", "pink", "brown"] as const)(
		"loops %s noise at unit RMS, without a tick at the seam",
		(color) => {
			const data = noiseLoop(color, 48000, seeded(7));
			let mean = 0;
			let power = 0;
			let step = 0;
			for (let i = 0; i < data.length; i++) {
				mean += data[i];
				power += data[i] ** 2;
				if (i > 0) step += Math.abs(data[i] - data[i - 1]);
			}
			expect(mean / data.length).toBeCloseTo(0, 6);
			expect(Math.sqrt(power / data.length)).toBeCloseTo(1, 4);
			const seam = Math.abs(data[0] - data[data.length - 1]);
			expect(seam).toBeLessThan((4 * step) / (data.length - 1));
		},
	);
});
