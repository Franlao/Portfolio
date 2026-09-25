import { describe, expect, it } from "vitest";
import type { Lang } from "../types";
import { type Copy, copies, enNumber, frNumber } from "./copy";
import {
	alternate,
	BENCH_SIZE,
	balanceZone,
	bandMeans,
	countBumps,
	deal,
	type FlawId,
	flaws,
	glitches,
	makeBench,
	measure,
	outOfLimits,
	RESEMBLANCE_MIN,
	RISK_MAX,
	ROUNDS,
	type Round,
	START_FIDELITY,
	score,
	seeded,
	shuffle,
	type VariableId,
	variables,
	viewOf,
} from "./logic";

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 1);
const LANGS: Lang[] = ["fr", "en"];

/** Every round dealt over many seeds, grouped by flaw. */
const byFlaw = (() => {
	const groups = new Map<FlawId, Round[]>();
	for (const seed of SEEDS) {
		for (const round of deal(seed)) {
			groups.set(round.flaw, [...(groups.get(round.flaw) ?? []), round]);
		}
	}
	return groups;
})();

describe("seeded generator", () => {
	it("replays the same sequence for the same seed", () => {
		const a = seeded(42);
		const b = seeded(42);
		expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
	});

	it("draws in [0, 1)", () => {
		const random = seeded(7);
		for (let i = 0; i < 1000; i++) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("dealing a game", () => {
	it("deals five different flaws, the same way for the same seed", () => {
		const rounds = deal(123);
		expect(rounds).toHaveLength(ROUNDS);
		expect(new Set(rounds.map((r) => r.flaw)).size).toBe(ROUNDS);
		expect(deal(123)).toEqual(rounds);
	});

	it("deals another game with another seed", () => {
		const games = new Set(
			SEEDS.slice(0, 20).map((seed) =>
				deal(seed)
					.map((r) => `${r.flaw}-${r.synthetic}`)
					.join(),
			),
		);
		expect(games.size).toBeGreaterThan(10);
	});

	it("puts the synthetic batch on both sides", () => {
		for (const seed of SEEDS) {
			const sides = deal(seed).map((r) => r.synthetic);
			expect(
				sides.filter((side) => side === "a").length,
			).toBeGreaterThanOrEqual(2);
			expect(
				sides.filter((side) => side === "b").length,
			).toBeGreaterThanOrEqual(2);
		}
	});

	it("never shows the same kind of chart twice in a row", () => {
		for (const seed of SEEDS.slice(0, 40)) {
			for (const left of flaws) {
				const picked = shuffle(
					flaws.filter((flaw) => flaw !== left),
					seeded(seed),
				);
				const ordered = alternate(picked);
				expect(new Set(ordered)).toEqual(new Set(picked));
				for (let i = 1; i < ordered.length; i++) {
					expect(viewOf[ordered[i]]).not.toBe(viewOf[ordered[i - 1]]);
				}
			}
		}
	});
});

describe("every flaw can be spotted, whatever the seed", () => {
	const rounds = (flaw: FlawId) => byFlaw.get(flaw) ?? [];

	it("deals every flaw", () => {
		for (const flaw of flaws)
			expect(rounds(flaw).length, flaw).toBeGreaterThan(50);
	});

	it("narrow: the synthetic spread is less than half the real one", () => {
		for (const round of rounds("narrow")) {
			expect(round.check.fake).toBeLessThan(round.check.real * 0.5);
		}
	});

	it("bumps: two bumps in the real blood sugar, one in the synthetic", () => {
		for (const round of rounds("bumps")) {
			expect(round.check).toEqual({ real: 2, fake: 1 });
		}
	});

	it("skew: the real BMI leans right, the synthetic bell does not", () => {
		for (const round of rounds("skew")) {
			expect(round.check.real).toBeGreaterThan(0.3);
			expect(Math.abs(round.check.fake)).toBeLessThan(0.15);
		}
	});

	it("link: age and blood pressure are linked in the real batch only", () => {
		for (const round of rounds("link")) {
			expect(round.check.real).toBeGreaterThan(0.4);
			expect(Math.abs(round.check.fake)).toBeLessThanOrEqual(0.12);
		}
	});

	it("collapse: real patients span the ages, synthetic ones are all alike", () => {
		for (const round of rounds("collapse")) {
			expect(round.check.real).toBeGreaterThanOrEqual(30);
			expect(round.check.fake).toBeLessThanOrEqual(2);
		}
	});

	it("impossible: exactly one out-of-limits value, in the synthetic batch", () => {
		for (const round of rounds("impossible")) {
			expect(round.check).toEqual({ real: 0, fake: 1 });
			if (round.fake.view !== "cards" || !round.faulty) {
				throw new Error("an impossible round shows cards and a faulty cell");
			}
			const { row, field } = round.faulty;
			const value = round.fake.patients[row][field];
			expect(glitches).toContainEqual({ field, value });
		}
	});

	it("draws both batches of a histogram round on the same axis, with as many patients", () => {
		for (const flaw of ["narrow", "bumps", "skew"] as const) {
			for (const round of rounds(flaw)) {
				if (
					round.real.view !== "histogram" ||
					round.fake.view !== "histogram"
				) {
					throw new Error("a histogram round shows histograms");
				}
				const total = (counts: number[]) => counts.reduce((a, b) => a + b, 0);
				expect(round.fake.counts).toHaveLength(round.real.counts.length);
				expect(total(round.fake.counts)).toBeGreaterThan(
					total(round.real.counts) * 0.95,
				);
			}
		}
	});
});

describe("controls", () => {
	it("counts bumps, not noise", () => {
		expect(countBumps([0, 5, 10, 5, 0, 5, 10, 5, 0])).toBe(2);
		expect(countBumps([1, 3, 6, 9, 6, 3, 1])).toBe(1);
		expect(countBumps([2, 5, 9, 8, 9, 5, 2])).toBe(1);
	});

	it("flags values no patient can have", () => {
		expect(outOfLimits([{ age: 40, tension: 130, bmi: 24 }])).toBe(0);
		expect(outOfLimits([{ age: 146, tension: 130, bmi: 3.4 }])).toBe(2);
	});
});

describe("the bench, between fidelity and privacy", () => {
	it("serves nothing useful at the start, and only copies at the end", () => {
		for (const seed of SEEDS) {
			const bench = makeBench(seed);
			expect(measure(bench, START_FIDELITY).verdict).toBe("bland");
			const copyShop = measure(bench, 100);
			expect(copyShop.verdict).toBe("leak");
			expect(copyShop.risk).toBe(1);
			expect(copyShop.resemblance).toBeGreaterThan(0.99);
		}
	});

	it("always has a balance zone wide enough to find", () => {
		for (const seed of SEEDS) {
			const zone = balanceZone(makeBench(seed));
			expect(zone, `seed ${seed}`).not.toBeNull();
			if (!zone) continue;
			expect(zone.to - zone.from).toBeGreaterThanOrEqual(8);
			expect(zone.from).toBeGreaterThan(START_FIDELITY);
			const middle = measure(
				makeBench(seed),
				Math.round((zone.from + zone.to) / 2),
			);
			expect(middle.resemblance).toBeGreaterThanOrEqual(RESEMBLANCE_MIN);
			expect(middle.risk).toBeLessThanOrEqual(RISK_MAX);
		}
	});

	it("gets riskier as fidelity rises", () => {
		const bench = makeBench(99);
		const risks = [0, 25, 50, 75, 100].map((f) => measure(bench, f).risk);
		expect(risks[4]).toBeGreaterThan(risks[2]);
		expect(risks[3]).toBeGreaterThan(risks[1]);
		const resemblances = [0, 25, 50].map((f) => measure(bench, f).resemblance);
		expect(resemblances[2]).toBeGreaterThan(resemblances[0]);
	});

	it("keeps every synthetic patient on the chart", () => {
		for (const fidelity of [0, 30, 60, 100]) {
			for (const point of measure(makeBench(5), fidelity).points) {
				expect(point.x).toBeGreaterThanOrEqual(0);
				expect(point.x).toBeLessThanOrEqual(1);
				expect(point.y).toBeGreaterThanOrEqual(0);
				expect(point.y).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("score and copy", () => {
	it("counts the synthetic batches found", () => {
		expect(
			score([
				{ flaw: "narrow", right: true },
				{ flaw: "link", right: false },
				{ flaw: "skew", right: true },
			]),
		).toEqual({ right: 2, total: 3 });
	});

	it("writes numbers the French way", () => {
		expect(frNumber(0.664, 2)).toBe("0,66");
		expect(frNumber(-3)).toBe("−3");
		expect(frNumber(-0.02, 1)).toBe("0,0");
	});

	it("writes numbers the British way", () => {
		expect(enNumber(0.664, 2)).toBe("0.66");
		expect(enNumber(-3)).toBe("-3");
		expect(enNumber(-0.02, 1)).toBe("0.0");
		expect(enNumber(1234.56, 1)).toBe("1,234.6");
	});

	it("keeps the chef's bubbles under 30 characters, in both languages", () => {
		for (const lang of LANGS) {
			const copy = copies[lang];
			const bubbles = [
				copy.start,
				copy.shoutRight,
				...flaws.map((flaw) => copy.flaws[flaw].shout),
				copy.bench.shoutStart,
				copy.bench.shoutBland,
				copy.bench.shoutLeak,
				copy.bench.shoutServed,
				copy.end.shout,
			];
			for (const bubble of bubbles)
				expect(bubble.length, bubble).toBeLessThan(30);
		}
	});

	it("names the impossible value in the clue", () => {
		const glitch = { field: "age", value: 146 } as const;
		expect(copies.fr.flaws.impossible.text("age", glitch)).toMatch(
			/^Un patient de 146.ans/,
		);
		expect(copies.en.flaws.impossible.text("age", glitch)).toMatch(
			/^A 146-year-old patient/,
		);
	});
});

/* Two languages, one game. */

/** The shape of a copy: its keys all the way down, with the kind of each leaf. */
function shape(value: unknown): unknown {
	if (typeof value === "function") return "function";
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, shape(entry)]),
		);
	}
	return typeof value;
}

/**
 * Every string a copy can display, keyed by path: its plain strings, and each of its
 * functions called with values from real dealt games, so both languages get the same input.
 */
function rendered(copy: Copy): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (value: unknown, path: string) => {
		if (typeof value === "string") out.set(path, value);
		else if (value && typeof value === "object") {
			for (const [key, entry] of Object.entries(value)) {
				walk(entry, `${path}.${key}`);
			}
		}
	};
	walk(copy, "copy");

	const add = (key: string, text: string) => out.set(key, text);
	add("progress", copy.progress(0, ROUNDS));
	add("batch", copy.batch("a"));
	add("choice", copy.choice("b"));
	add("right", copy.right("a"));
	add("wrong", copy.wrong("b"));
	add("caption", copy.chart.cards.caption("a"));
	add("resemblance", copy.bench.resemblance.detail(80));
	add("risk.one", copy.bench.risk.detail(1, BENCH_SIZE, 10));
	add("risk.many", copy.bench.risk.detail(7, BENCH_SIZE, 10));
	add("percent", copy.bench.percent(85));
	add("valueText", copy.bench.valueText(50, 85, 5));
	add("bland", copy.bench.bland(62, 80));
	add("leak", copy.bench.leak(7, BENCH_SIZE));
	add("served", copy.bench.served(85, 5));
	add("score.one", copy.end.score(1, ROUNDS));
	add("score.many", copy.end.score(3, ROUNDS));
	add("setting", copy.end.setting(85, 5));
	for (const variable of Object.keys(variables) as VariableId[]) {
		add(`axis.${variable}`, Object.values(copy.chart.axis(variable)).join(" "));
	}
	for (const glitch of glitches) {
		add(
			`glitch.${glitch.field}.${glitch.value}`,
			copy.flaws.impossible.text(glitch.field, glitch),
		);
		add(
			`card.${glitch.field}.${glitch.value}`,
			copy.chart.cardValue(glitch.field, glitch.value),
		);
	}
	for (const seed of SEEDS.slice(0, 12)) {
		for (const [i, round] of deal(seed).entries()) {
			const key = `${seed}.${i}`;
			const flaw = copy.flaws[round.flaw];
			add(`${key}.text`, flaw.text(round.variable));
			add(
				`${key}.proof`,
				flaw.proof(round.check.real, round.check.fake, round.variable),
			);
			if (round.real.view === "histogram") {
				add(
					`${key}.histogram`,
					copy.chart.histogram(round.variable, round.real.counts),
				);
			}
			if (round.real.view === "scatter") {
				const { points } = round.real;
				add(
					`${key}.scatter`,
					copy.chart.scatter(points.length, bandMeans(points)),
				);
			}
		}
	}
	return out;
}

/** The numbers a text shows, however its language writes them. */
function numbers(text: string, lang: Lang): number[] {
	const plain =
		lang === "fr"
			? text
					.replace(/(\d)[  ](\d{3})/g, "$1$2")
					.replace(/(\d),(\d)/g, "$1.$2")
					.replace(/−/g, "-")
			: text.replace(/(\d),(\d{3})/g, "$1$2");
	return (plain.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe("French and English", () => {
	const fr = rendered(copies.fr);
	const en = rendered(copies.en);

	it("have the same keys, all the way down", () => {
		expect(shape(copies.en)).toEqual(shape(copies.fr));
		expect(shape(copies.en.chart.axis("age"))).toEqual(
			shape(copies.fr.chart.axis("age")),
		);
		expect([...en.keys()]).toEqual([...fr.keys()]);
	});

	it("show the same numbers: only the words change", () => {
		for (const [key, text] of fr) {
			const english = en.get(key) ?? "";
			expect(numbers(english, "en"), `${key}: ${english}`).toEqual(
				numbers(text, "fr"),
			);
		}
	});

	it("set French with French typography", () => {
		for (const [key, text] of fr) {
			expect(text, key).not.toMatch(/ [:;?!%»]|« |[“”]/);
		}
	});

	it("leave English free of French typography and French words", () => {
		for (const [key, text] of en) {
			expect(text, key).not.toMatch(/[«»  ]/);
			expect(text, key).not.toMatch(/ [:;?!%]/);
			expect(text, key).not.toMatch(/[àâçéèêëîïôùûœ]/i);
		}
	});

	it("title and introduce the game in both languages", () => {
		expect(copies.fr.title).toBe("Vrai ou synthétique ?");
		expect(copies.en.title).toBe("Real or synthetic?");
		for (const lang of LANGS)
			expect(copies[lang].intro.length).toBeGreaterThan(20);
	});
});
