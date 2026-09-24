import { describe, expect, it } from "vitest";
import { copy, fr } from "./copy";
import {
	audit,
	benchStatus,
	type Card,
	CRITERIA,
	type Criterion,
	DEFAULT_WEIGHT,
	deal,
	defaultWeights,
	FAMILIES,
	LETTERS,
	lineUp,
	mulberry32,
	NEEDED_PER_FAMILY,
	PROFILES,
	pool,
	rank,
	shuffle,
	TRAP_COUNT,
	TRAY_SIZE,
	togglePick,
	WEIGHT_MAX,
	type Weights,
} from "./logic";

const ids = (cards: readonly Card[]) => cards.map((card) => card.id);

describe("the card pool", () => {
	it("has unique ids", () => {
		expect(new Set(ids(pool)).size).toBe(pool.length);
	});

	it("has enough needed cards and traps in every family", () => {
		for (const family of FAMILIES) {
			const cards = pool.filter((card) => card.family === family);
			expect(
				cards.filter((card) => card.needed).length,
				family,
			).toBeGreaterThanOrEqual(NEEDED_PER_FAMILY);
			expect(
				cards.filter((card) => !card.needed).length,
				family,
			).toBeGreaterThanOrEqual(1);
		}
	});

	it("explains every card, and gives every trap a short shout", () => {
		for (const card of pool) {
			expect(card.reason.length, card.id).toBeGreaterThan(10);
			expect(card.short.length, card.id).toBeLessThanOrEqual(20);
			if (!card.needed) {
				expect(card.shout, card.id).toBeDefined();
				expect(fr(card.shout ?? "").length, card.id).toBeLessThan(30);
			}
		}
	});
});

describe("dealing a hand", () => {
	it("deals six needed gestures, two per family, and four traps", () => {
		for (let seed = 0; seed < 50; seed++) {
			const hand = deal(seed);
			expect(hand).toHaveLength(TRAY_SIZE + TRAP_COUNT);
			expect(new Set(ids(hand)).size).toBe(hand.length);
			expect(hand.filter((card) => !card.needed)).toHaveLength(TRAP_COUNT);
			for (const family of FAMILIES) {
				const inFamily = hand.filter((card) => card.family === family);
				expect(inFamily.filter((card) => card.needed)).toHaveLength(
					NEEDED_PER_FAMILY,
				);
				// Every family hides at least one trap.
				expect(
					inFamily.filter((card) => !card.needed).length,
				).toBeGreaterThanOrEqual(1);
			}
		}
	});

	it("is deterministic for a seed", () => {
		expect(ids(deal(42))).toEqual(ids(deal(42)));
	});

	it("changes from one game to the next", () => {
		// A replay uses seed + 1: the hand (or at least its order) must differ.
		for (let seed = 0; seed < 20; seed++) {
			expect(ids(deal(seed + 1))).not.toEqual(ids(deal(seed)));
		}
		const sets = new Set(
			Array.from({ length: 20 }, (_, seed) => ids(deal(seed)).sort().join()),
		);
		expect(sets.size).toBeGreaterThan(5);
	});

	it("shuffles without touching the source", () => {
		const source = [1, 2, 3, 4, 5];
		const out = shuffle(source, mulberry32(3));
		expect(source).toEqual([1, 2, 3, 4, 5]);
		expect([...out].sort()).toEqual(source);
	});

	it("draws numbers in [0, 1)", () => {
		const random = mulberry32(7);
		for (let i = 0; i < 1000; i++) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("filling the tray", () => {
	it("adds, removes, and refuses a seventh card", () => {
		let picked: string[] = [];
		for (const id of ["a", "b", "c", "d", "e", "f"]) {
			const result = togglePick(picked, id);
			expect(result.change).toBe("added");
			picked = result.picked;
		}
		expect(togglePick(picked, "g")).toEqual({ picked, change: "full" });
		const removed = togglePick(picked, "c");
		expect(removed.change).toBe("removed");
		expect(removed.picked).toEqual(["a", "b", "d", "e", "f"]);
		expect(togglePick(removed.picked, "g").change).toBe("added");
	});
});

describe("the chef's check", () => {
	const hand = deal(12);
	const needed = hand.filter((card) => card.needed);
	const traps = hand.filter((card) => !card.needed);

	it("serves a perfect tray", () => {
		const result = audit(hand, ids(needed));
		expect(result.served).toBe(true);
		expect(result.right).toBe(TRAY_SIZE);
		expect(result.total).toBe(TRAY_SIZE);
		expect(result.traps).toEqual([]);
		expect(result.verdicts.every((v) => v.right)).toBe(true);
		for (const family of FAMILIES) {
			expect(result.byFamily[family]).toEqual({
				right: NEEDED_PER_FAMILY,
				total: NEEDED_PER_FAMILY,
			});
		}
	});

	it("refuses traps and names what was forgotten", () => {
		const tray = [...ids(needed.slice(0, 4)), ...ids(traps.slice(0, 2))];
		const result = audit(hand, tray);
		expect(result.served).toBe(false);
		expect(result.right).toBe(4);
		expect(ids(result.traps)).toEqual(ids(traps.slice(0, 2)));
		const kinds = result.verdicts.map((v) => v.kind);
		expect(kinds.filter((k) => k === "kept")).toHaveLength(4);
		expect(kinds.filter((k) => k === "trap")).toHaveLength(2);
		expect(kinds.filter((k) => k === "missed")).toHaveLength(2);
		expect(kinds.filter((k) => k === "avoided")).toHaveLength(2);
		expect(result.verdicts.filter((v) => !v.right)).toHaveLength(4);
	});

	it("checks the tray first, in tray order, then the cards left aside", () => {
		const tray = [...ids(traps.slice(0, 1)), ...ids(needed.slice(0, 5))];
		const result = audit(hand, tray);
		expect(ids(result.verdicts.map((v) => v.card)).slice(0, 6)).toEqual(tray);
		expect(result.verdicts).toHaveLength(hand.length);
	});

	it("counts right answers per family", () => {
		const missing = needed[0];
		const tray = [...ids(needed.slice(1)), traps[0].id];
		const result = audit(hand, tray);
		expect(result.byFamily[missing.family].right).toBe(NEEDED_PER_FAMILY - 1);
		const total = FAMILIES.reduce(
			(sum, f) => sum + result.byFamily[f].right,
			0,
		);
		expect(total).toBe(result.right);
	});
});

describe("the bench", () => {
	const assistants = lineUp(5);
	const all = (value: number): Weights =>
		Object.fromEntries(CRITERIA.map((c) => [c, value])) as Weights;
	const only = (criterion: Criterion): Weights => ({
		...all(0),
		[criterion]: WEIGHT_MAX,
	});

	it("gives each letter one profile", () => {
		expect(assistants.map((a) => a.letter)).toEqual([...LETTERS]);
		expect(new Set(assistants.map((a) => a.scores)).size).toBe(PROFILES.length);
	});

	it("changes who is who from one game to the next", () => {
		const firstLetters = new Set(
			Array.from({ length: 12 }, (_, seed) =>
				PROFILES.indexOf(lineUp(seed)[0].scores),
			),
		);
		expect(firstLetters.size).toBeGreaterThan(1);
	});

	it("ties with equal weights: only priorities can decide", () => {
		const standings = rank(assistants, defaultWeights());
		expect(new Set(standings.map((s) => s.score)).size).toBe(1);
		expect(benchStatus(defaultWeights(), standings)).toEqual({ kind: "even" });
	});

	it("lets every assistant win with some weights", () => {
		const leaders = new Set<string>();
		const levels = Array.from({ length: WEIGHT_MAX + 1 }, (_, i) => i);
		for (const q of levels)
			for (const c of levels)
				for (const p of levels)
					for (const k of levels) {
						const weights = { quality: q, context: c, privacy: p, cost: k };
						const state = benchStatus(weights, rank(assistants, weights));
						if (state.kind === "lead") leaders.add(state.letter);
					}
		expect([...leaders].sort()).toEqual([...LETTERS]);
	});

	it("crowns someone as soon as one slider moves off the default", () => {
		for (const criterion of CRITERIA) {
			for (const value of [DEFAULT_WEIGHT - 1, DEFAULT_WEIGHT + 1]) {
				const weights = { ...defaultWeights(), [criterion]: value };
				const state = benchStatus(weights, rank(assistants, weights));
				expect(state.kind, `${criterion}=${value}`).toBe("lead");
			}
		}
	});

	it("puts the specialist first when a single criterion counts", () => {
		const best = (criterion: Criterion) =>
			[...assistants].sort(
				(a, b) => b.scores[criterion] - a.scores[criterion],
			)[0].letter;
		for (const criterion of ["quality", "context", "privacy"] as const) {
			const standings = rank(assistants, only(criterion));
			expect(standings[0].letter, criterion).toBe(best(criterion));
			expect(standings[0].score).toBe(
				assistants.find((a) => a.letter === best(criterion))?.scores[criterion],
			);
		}
	});

	it("computes a weighted mean out of 10, and bar shares that add up to it", () => {
		const weights = { quality: 3, context: 1, privacy: 0, cost: 2 };
		for (const standing of rank(assistants, weights)) {
			const scores = assistants.find(
				(a) => a.letter === standing.letter,
			)?.scores;
			if (!scores) throw new Error("unknown assistant");
			const mean = (3 * scores.quality + scores.context + 2 * scores.cost) / 6;
			expect(standing.score).toBeCloseTo(mean);
			const shares = CRITERIA.reduce((sum, c) => sum + standing.parts[c], 0);
			expect(shares).toBeCloseTo(mean / 10);
			expect(standing.parts.privacy).toBe(0);
		}
	});

	it("says when nothing counts, or when the top is tied", () => {
		expect(benchStatus(all(0), rank(assistants, all(0)))).toEqual({
			kind: "none",
		});
		// Quality and context at the top: the two specialists tie.
		const weights = { quality: 3, context: 3, privacy: 2, cost: 2 };
		expect(benchStatus(weights, rank(assistants, weights))).toEqual({
			kind: "tie",
		});
	});
});

describe("the copy", () => {
	it("keeps every chef bubble under 30 characters", () => {
		const bubbles = [
			copy.say.start,
			copy.say.served,
			copy.say.refused,
			copy.say.bench,
			copy.say.allFound,
			copy.say.perfect,
			copy.say.end,
			...LETTERS.map(copy.say.lead),
		];
		for (const bubble of bubbles)
			expect(fr(bubble).length, bubble).toBeLessThan(30);
	});

	it("applies French typography, hours included", () => {
		expect(fr("Service !")).toBe("Service !");
		expect(fr("vendredi à 18 h, sans retour")).toBe(
			"vendredi à 18 h, sans retour",
		);
		expect(fr("18 heures")).toBe("18 heures");
	});

	it("agrees in number", () => {
		expect(copy.end.tray(1, 6)).toBe("Plateau : 1 geste juste sur 6.");
		expect(copy.end.tray(5, 6)).toBe("Plateau : 5 gestes justes sur 6.");
		expect(copy.end.bench(3, 3)).toBe(
			"Banc d'essai : 3 assistants sur 3 passés en tête.",
		);
		expect(copy.pick.remaining(1)).toBe("Encore 1 carte.");
	});
});
