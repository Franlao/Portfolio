import type { Lang } from "../types";
import { copy } from "./copy";

/**
 * « Chasse à l'hallucination » (“Spot the hallucination”): a writer agent answers an engineer's question
 * from retrieved pages, and cites a page for every claim. One claim is invented. The verifier confronts
 * each claim with the page it cites, text and figure alike. Everything here is pure: the game only
 * renders what it decides.
 *
 * The documents exist in French and English (cases.ts). Facts are matched by key, and a claim's value is
 * compared with its page in the same language, so the verifier behaves identically in both.
 */

export const ROUNDS = 3;

/** A value printed somewhere on a page, under a key the claims refer to. */
export interface Datum {
	key: string;
	value: string;
}

/** Page text: plain runs, and the values a claim may rely on. */
export type Segment = string | Datum;

export type Mark = "order" | "sensor" | "bolt";

/**
 * The figure of a page, described rather than drawn, so the tests can check what it shows.
 * Values live here once: the drawing and the verifier both read them.
 */
export type Figure =
	| {
			kind: "table";
			head: [string, string];
			rows: (Datum & { label: string })[];
	  }
	| {
			kind: "points";
			shape: "plate" | "carter";
			mark: Mark;
			caption: string;
			/** A count, such as « 4 vis » : the drawing shows that many items. */
			count: Datum;
	  }
	| { kind: "section"; joint: Datum }
	| { kind: "bracket"; hole: Datum; spacing: Datum }
	| { kind: "curve"; peak: Datum; limit: Datum }
	| { kind: "bend"; radius: Datum }
	| { kind: "clamps"; spacing: Datum }
	| { kind: "level"; level: Datum }
	| { kind: "interval"; every: Datum };

export interface Page {
	number: number;
	doc: string;
	title: string;
	text: Segment[];
	figure: Figure;
}

/** Named spots of a page, the same in every language. */
export type SpotName =
	| "text"
	| Mark
	| "joint"
	| "hole"
	| "holeSpacing"
	| "peak"
	| "limit"
	| "radius"
	| "clampSpacing"
	| "level"
	| "interval";

/** Where a value sits: a named spot, or a table row known by its label. */
export type Spot = SpotName | { row: string };

export interface Fact extends Datum {
	where: "text" | "figure";
	/** A tag rather than words, so the logic does not depend on the language: copy.ts words it. */
	spot: Spot;
}

/** One sentence of the writer's answer, reduced to what can be checked. */
export interface Claim {
	text: string;
	/** The page the writer cites. */
	page: number;
	/** The fact the sentence relies on. */
	key: string;
	/** The value the sentence states for that fact. */
	value: string;
}

export interface Case {
	id: string;
	question: string;
	pages: Page[];
	/** Each position has a faithful version and an invented one; a round uses one invention. */
	claims: { truth: Claim; fake: Claim }[];
}

/** Every value a figure shows, with where it shows it. */
export function figureFacts(figure: Figure): Fact[] {
	const fact = ({ key, value }: Datum, spot: Spot): Fact => ({
		key,
		value,
		where: "figure",
		spot,
	});
	switch (figure.kind) {
		case "table":
			return figure.rows.map((row) => fact(row, { row: row.label }));
		case "points":
			return [fact(figure.count, figure.mark)];
		case "section":
			return [fact(figure.joint, "joint")];
		case "bracket":
			return [fact(figure.hole, "hole"), fact(figure.spacing, "holeSpacing")];
		case "curve":
			return [fact(figure.peak, "peak"), fact(figure.limit, "limit")];
		case "bend":
			return [fact(figure.radius, "radius")];
		case "clamps":
			return [fact(figure.spacing, "clampSpacing")];
		case "level":
			return [fact(figure.level, "level")];
		case "interval":
			return [fact(figure.every, "interval")];
	}
}

export function factsOf(page: Page): Fact[] {
	const inText = page.text
		.filter((segment): segment is Datum => typeof segment !== "string")
		.map(
			({ key, value }): Fact => ({ key, value, where: "text", spot: "text" }),
		);
	return [...inText, ...figureFacts(page.figure)];
}

/** What the verifier finds when it opens the cited page. */
export type Finding =
	| { ok: true; page: Page; fact: Fact }
	| {
			ok: false;
			reason: "mismatch";
			page: Page;
			fact: Fact;
			/** Another value of the same page that matches the claim: the writer read the wrong line. */
			other?: Fact;
	  }
	| { ok: false; reason: "absent"; page: Page }
	| { ok: false; reason: "ghost"; cited: number };

export function verify(claim: Claim, pages: readonly Page[]): Finding {
	const page = pages.find((p) => p.number === claim.page);
	if (!page) return { ok: false, reason: "ghost", cited: claim.page };
	const facts = factsOf(page);
	const fact = facts.find((f) => f.key === claim.key);
	if (!fact) return { ok: false, reason: "absent", page };
	if (fact.value === claim.value) return { ok: true, page, fact };
	const other = facts.find((f) => f !== fact && f.value === claim.value);
	return { ok: false, reason: "mismatch", page, fact, other };
}

export type Kind = "figure" | "text" | "absent" | "ghost";

export function kindOf(finding: Finding): Kind | null {
	if (finding.ok) return null;
	if (finding.reason === "mismatch") return finding.fact.where;
	return finding.reason;
}

export interface Round {
	item: Case;
	/** Position of the invented claim. */
	fake: number;
	claims: Claim[];
}

export function roundOf(item: Case, fake: number): Round {
	return {
		item,
		fake,
		claims: item.claims.map((pair, i) => (i === fake ? pair.fake : pair.truth)),
	};
}

/** The verifier's pass over a whole answer, claim by claim. */
export function inspect(round: Round): Finding[] {
	return round.claims.map((claim) => verify(claim, round.item.pages));
}

/** Mulberry32: a tiny seeded generator, so a deal can be replayed in the tests. */
export function rng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/** Every way to hide one invention per question. */
function combos(items: readonly Case[]): number[][] {
	return items.reduce<number[][]>(
		(acc, item) =>
			acc.flatMap((prefix) => item.claims.map((_, i) => [...prefix, i])),
		[[]],
	);
}

/**
 * A fair game hides at least one invention in a figure (the multimodal point),
 * mixes at least two kinds of invention, and does not always use the same position.
 */
function fair(items: readonly Case[], fakes: number[]): boolean {
	const kinds = fakes.map((fake, i) =>
		kindOf(verify(items[i].claims[fake].fake, items[i].pages)),
	);
	return (
		kinds.includes("figure") &&
		new Set(kinds).size >= 2 &&
		new Set(fakes).size >= 2
	);
}

/**
 * Picks the questions of a game and where each invention hides, from the documents of one language.
 * `avoid` holds the questions of the previous game, so a replay always brings something new.
 * Both languages share ids and structure, so a seed deals the same game in either.
 */
export function deal(
	seed: number,
	pool: readonly Case[],
	avoid: readonly string[] = [],
): Round[] {
	const random = rng(seed);
	const order = shuffle(pool, random);
	let picked = order.slice(0, ROUNDS);
	if (avoid.length > 0 && picked.every((item) => avoid.includes(item.id))) {
		const fresh = order.slice(ROUNDS).find((item) => !avoid.includes(item.id));
		if (fresh) picked = [...picked.slice(0, -1), fresh];
	}
	const all = combos(picked);
	const fairOnes = all.filter((fakes) => fair(picked, fakes));
	const options = fairOnes.length > 0 ? fairOnes : all;
	const fakes = options[Math.floor(random() * options.length)];
	return picked.map((item, i) => roundOf(item, fakes[i]));
}

export interface Result {
	round: Round;
	/** Position the player pointed at. */
	picked: number;
}

export function isRight(result: Result): boolean {
	return result.picked === result.round.fake;
}

export function score(results: readonly Result[]) {
	return {
		right: results.filter(isRight).length,
		total: results.length,
	};
}

// The verifier's words, in the language of the pages. Raw: the game typesets them when it shows them.

/** How a spot reads: « ligne « trappe B » », “limit line”… */
export function spotLabel(fact: Fact, lang: Lang): string {
	const words = copy[lang].check;
	return typeof fact.spot === "string"
		? words.spots[fact.spot]
		: words.row(fact.spot.row);
}

/** « texte » or « tableau, ligne « trappe B » » : the exact spot of a value on its page. */
export function place(fact: Fact, page: Page, lang: Lang): string {
	return fact.where === "text"
		? spotLabel(fact, lang)
		: `${copy[lang].check.figures[page.figure.kind].noun}, ${spotLabel(fact, lang)}`;
}

/** The verifier's note under a claim: always starts with ✓ or ✗, never colour alone. */
export function note(finding: Finding, claim: Claim, lang: Lang): string {
	const words = copy[lang].check;
	// Words lifted from the text are quoted; values read off a figure are not.
	const quoted = (value: string, where: Fact["where"]) =>
		where === "text" ? copy[lang].quote(value) : value;
	if (finding.ok) {
		const { page, fact } = finding;
		return words.ok(
			page.number,
			place(fact, page, lang),
			quoted(fact.value, fact.where),
		);
	}
	switch (finding.reason) {
		case "mismatch": {
			const { page, fact, other } = finding;
			const found = words.mismatch(
				page.number,
				place(fact, page, lang),
				quoted(fact.value, fact.where),
				quoted(claim.value, fact.where),
			);
			return other
				? `${found} ${words.other(claim.value, spotLabel(other, lang))}`
				: found;
		}
		case "absent":
			return words.absent(
				finding.page.number,
				words.figures[finding.page.figure.kind].definite,
			);
		case "ghost":
			return words.ghost(finding.cited);
	}
}

/** What kind of invention it was, for the verdict and the recap. */
export function trap(finding: Finding, lang: Lang): string {
	const words = copy[lang].traps;
	if (finding.ok) return words.none;
	switch (finding.reason) {
		case "mismatch":
			if (finding.other) return words.misread;
			return finding.fact.where === "text"
				? words.text
				: words.figure(
						copy[lang].check.figures[finding.page.figure.kind].definite,
					);
		case "absent":
			return words.absent;
		case "ghost":
			return words.ghost;
	}
}
