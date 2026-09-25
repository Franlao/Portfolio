/**
 * « La mise en service », the game of the tools station.
 *
 * Part one: an AI service goes to production. The visitor fills a six-slot tray from ten cards
 * (six needed gestures, four traps), then the chef checks every card and says why.
 * Part two, « le banc d'essai »: three fictional code assistants are scored on four criteria;
 * the visitor sets how much each criterion matters and the ranking follows live.
 *
 * Everything here is pure and deterministic: randomness comes from a seeded generator,
 * so a hand can be replayed and tested. The cards are generic good practice, not a real system.
 * No word is displayed from here: the text lives in copy.ts and cards.ts, in French and English,
 * so both languages play exactly the same game.
 */

export type Family = "production" | "security" | "docs";

/** The three families mirror the real job: put in production, secure, document. */
export const FAMILIES: readonly Family[] = ["production", "security", "docs"];

export type CardId =
	| "tests"
	| "rollback"
	| "rate-limit"
	| "call-logs"
	| "alerts"
	| "fallback"
	| "shared-library"
	| "skip-tests"
	| "friday"
	| "auto-upgrade"
	| "vault"
	| "security-review"
	| "access"
	| "input-filter"
	| "key-in-code"
	| "clear-logs"
	| "admin"
	| "runbook"
	| "api-doc"
	| "known-limits"
	| "code-is-doc"
	| "doc-later";

/**
 * A card only carries what the rules need. Its words (label, reason, the chef's shout)
 * live in cards.ts, once per language, under the same id.
 */
export interface Card {
	id: CardId;
	family: Family;
	needed: boolean;
}

export const TRAY_SIZE = 6;
export const NEEDED_PER_FAMILY = 2;
export const TRAP_COUNT = 4;

export const pool: readonly Card[] = [
	{ id: "tests", family: "production", needed: true },
	{ id: "rollback", family: "production", needed: true },
	{ id: "rate-limit", family: "production", needed: true },
	{ id: "call-logs", family: "production", needed: true },
	{ id: "alerts", family: "production", needed: true },
	{ id: "fallback", family: "production", needed: true },
	{ id: "shared-library", family: "production", needed: true },
	{ id: "skip-tests", family: "production", needed: false },
	{ id: "friday", family: "production", needed: false },
	{ id: "auto-upgrade", family: "production", needed: false },
	{ id: "vault", family: "security", needed: true },
	{ id: "security-review", family: "security", needed: true },
	{ id: "access", family: "security", needed: true },
	{ id: "input-filter", family: "security", needed: true },
	{ id: "key-in-code", family: "security", needed: false },
	{ id: "clear-logs", family: "security", needed: false },
	{ id: "admin", family: "security", needed: false },
	{ id: "runbook", family: "docs", needed: true },
	{ id: "api-doc", family: "docs", needed: true },
	{ id: "known-limits", family: "docs", needed: true },
	{ id: "code-is-doc", family: "docs", needed: false },
	{ id: "doc-later", family: "docs", needed: false },
];

/** Mulberry32: a tiny seeded generator, enough for shuffling cards. */
export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher-Yates on a copy, so the pool is never mutated. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Deals the ten cards of a game: two needed gestures per family, and four traps.
 * Every family hides at least one trap, so no family can be picked blindly.
 */
export function deal(seed: number): Card[] {
	const random = mulberry32(seed);
	const needed = FAMILIES.flatMap((family) =>
		shuffle(
			pool.filter((card) => card.needed && card.family === family),
			random,
		).slice(0, NEEDED_PER_FAMILY),
	);
	const oneTrapEach = FAMILIES.map(
		(family) =>
			shuffle(
				pool.filter((card) => !card.needed && card.family === family),
				random,
			)[0],
	);
	const extraTraps = shuffle(
		pool.filter((card) => !card.needed && !oneTrapEach.includes(card)),
		random,
	).slice(0, TRAP_COUNT - oneTrapEach.length);
	return shuffle([...needed, ...oneTrapEach, ...extraTraps], random);
}

export interface PickResult {
	picked: string[];
	change: "added" | "removed" | "full";
}

/** Puts a card on the tray or takes it back. A full tray refuses a seventh card. */
export function togglePick(
	picked: readonly string[],
	id: string,
	size = TRAY_SIZE,
): PickResult {
	if (picked.includes(id)) {
		return { picked: picked.filter((p) => p !== id), change: "removed" };
	}
	if (picked.length >= size) return { picked: [...picked], change: "full" };
	return { picked: [...picked, id], change: "added" };
}

/**
 * kept: needed and on the tray. trap: a trap on the tray.
 * missed: needed but left on the counter. avoided: a trap left on the counter.
 */
export type VerdictKind = "kept" | "trap" | "missed" | "avoided";

export interface CardVerdict {
	card: Card;
	kind: VerdictKind;
	/** True when the visitor's choice for this card was the right one. */
	right: boolean;
}

export interface Audit {
	/** In the order the chef checks them: the tray first, then the cards left aside. */
	verdicts: CardVerdict[];
	/** Needed gestures on the tray. */
	right: number;
	/** Needed gestures in the hand. */
	total: number;
	/** Traps on the tray, in tray order. */
	traps: Card[];
	byFamily: Record<Family, { right: number; total: number }>;
	/** Ready for production: every needed gesture and no trap. */
	served: boolean;
}

export function audit(hand: readonly Card[], picked: readonly string[]): Audit {
	const onTray = picked
		.map((id) => hand.find((card) => card.id === id))
		.filter((card): card is Card => card !== undefined);
	const aside = hand.filter((card) => !picked.includes(card.id));
	const verdicts: CardVerdict[] = [
		...onTray.map((card) => ({
			card,
			kind: (card.needed ? "kept" : "trap") as VerdictKind,
			right: card.needed,
		})),
		...aside.map((card) => ({
			card,
			kind: (card.needed ? "missed" : "avoided") as VerdictKind,
			right: !card.needed,
		})),
	];
	const byFamily = Object.fromEntries(
		FAMILIES.map((family) => [
			family,
			{
				right: onTray.filter((c) => c.needed && c.family === family).length,
				total: hand.filter((c) => c.needed && c.family === family).length,
			},
		]),
	) as Record<Family, { right: number; total: number }>;
	const right = onTray.filter((card) => card.needed).length;
	const total = hand.filter((card) => card.needed).length;
	const traps = onTray.filter((card) => !card.needed);
	return {
		verdicts,
		right,
		total,
		traps,
		byFamily,
		served: right === total && traps.length === 0,
	};
}

// « Le banc d'essai » : a weighted comparison of three fictional code assistants.

export type Criterion = "quality" | "context" | "privacy" | "cost";
export const CRITERIA: readonly Criterion[] = [
	"quality",
	"context",
	"privacy",
	"cost",
];

export type Scores = Record<Criterion, number>;
export type Weights = Record<Criterion, number>;

/** Weights go from 0 (does not matter) to 3 (essential). */
export const WEIGHT_MAX = 3;
export const DEFAULT_WEIGHT = 2;

/**
 * Fictional scores out of 10. Each profile is the best somewhere, and all three add up
 * to the same total: with equal weights they tie, so only the team's priorities can decide.
 */
export const PROFILES: readonly Scores[] = [
	{ quality: 9, context: 6, privacy: 4, cost: 5 },
	{ quality: 6, context: 9, privacy: 5, cost: 4 },
	{ quality: 4, context: 4, privacy: 8, cost: 8 },
];

export const LETTERS = ["A", "B", "C"] as const;
export type Letter = (typeof LETTERS)[number];

export interface Assistant {
	letter: Letter;
	scores: Scores;
}

export function defaultWeights(): Weights {
	return {
		quality: DEFAULT_WEIGHT,
		context: DEFAULT_WEIGHT,
		privacy: DEFAULT_WEIGHT,
		cost: DEFAULT_WEIGHT,
	};
}

/** Gives the profiles to the letters A, B, C in a seeded order, so a replay differs. */
export function lineUp(seed: number): Assistant[] {
	// Offset the seed so the lineup does not follow the card deal.
	const profiles = shuffle(PROFILES, mulberry32(seed + 7919));
	return LETTERS.map((letter, i) => ({ letter, scores: profiles[i] }));
}

export interface Standing {
	letter: Letter;
	/** Weighted mean, out of 10. */
	score: number;
	/** Each criterion's share of a full bar (a perfect 10), between 0 and 1. */
	parts: Scores;
}

export function rank(
	assistants: readonly Assistant[],
	weights: Weights,
): Standing[] {
	const sum = CRITERIA.reduce((total, c) => total + weights[c], 0);
	return assistants
		.map((assistant) => {
			const points = (c: Criterion) => weights[c] * assistant.scores[c];
			const parts = Object.fromEntries(
				CRITERIA.map((c) => [c, sum ? points(c) / (sum * 10) : 0]),
			) as Scores;
			const score = sum
				? CRITERIA.reduce((total, c) => total + points(c), 0) / sum
				: 0;
			return { letter: assistant.letter, score, parts };
		})
		.sort((a, b) => b.score - a.score || a.letter.localeCompare(b.letter));
}

export type BenchState =
	| { kind: "lead"; letter: Letter }
	| { kind: "tie" }
	| { kind: "even" }
	| { kind: "none" };

const EPSILON = 1e-9;

/** Who leads, or why nobody does: no criterion counts, equal weights, or a tie at the top. */
export function benchStatus(
	weights: Weights,
	standings: readonly Standing[],
): BenchState {
	const values = CRITERIA.map((c) => weights[c]);
	if (values.every((v) => v === 0)) return { kind: "none" };
	const [first, second] = standings;
	if (!first) return { kind: "none" };
	if (second && first.score - second.score < EPSILON) {
		return values.every((v) => v === values[0])
			? { kind: "even" }
			: { kind: "tie" };
	}
	return { kind: "lead", letter: first.letter };
}
