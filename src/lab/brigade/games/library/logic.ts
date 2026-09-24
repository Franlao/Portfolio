import { cases } from "./cases";

/**
 * « Chasse à l'hallucination » : a writer agent answers an engineer's question from retrieved pages,
 * and cites a page for every claim. One claim is invented. The verifier confronts each claim with the
 * page it cites, text and figure alike. Everything here is pure: the game only renders what it decides.
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

export interface Fact extends Datum {
	where: "text" | "figure";
	/** Where the value sits, for the verifier's note: « ligne « trappe B » », « pic »… */
	label: string;
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

const countLabel: Record<Mark, string> = {
	order: "vis comptées",
	sensor: "capteurs comptés",
	bolt: "boulons comptés",
};

/** Every value a figure shows, with where it shows it. */
export function figureFacts(figure: Figure): Fact[] {
	const fact = (datum: Datum, label: string): Fact => ({
		...datum,
		where: "figure",
		label,
	});
	switch (figure.kind) {
		case "table":
			return figure.rows.map((row) => fact(row, `ligne « ${row.label} »`));
		case "points":
			return [fact(figure.count, countLabel[figure.mark])];
		case "section":
			return [fact(figure.joint, "cote du joint")];
		case "bracket":
			return [
				fact(figure.hole, "cote des trous"),
				fact(figure.spacing, "entraxe coté"),
			];
		case "curve":
			return [fact(figure.peak, "pic"), fact(figure.limit, "ligne de limite")];
		case "bend":
			return [fact(figure.radius, "rayon coté")];
		case "clamps":
			return [fact(figure.spacing, "cote entre colliers")];
		case "level":
			return [fact(figure.level, "voyant")];
		case "interval":
			return [fact(figure.every, "intervalle coté")];
	}
}

export function factsOf(page: Page): Fact[] {
	const inText = page.text
		.filter((segment): segment is Datum => typeof segment !== "string")
		.map((datum): Fact => ({ ...datum, where: "text", label: "texte" }));
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
 * Picks the questions of a game and where each invention hides.
 * `avoid` holds the questions of the previous game, so a replay always brings something new.
 */
export function deal(
	seed: number,
	avoid: readonly string[] = [],
	pool: readonly Case[] = cases,
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

// The verifier's words. Raw French: the game applies the typography when it displays them.

const figureNames: Record<Figure["kind"], [string, string]> = {
	table: ["tableau", "le tableau"],
	points: ["schéma", "le schéma"],
	section: ["schéma", "le schéma"],
	bracket: ["plan", "le plan"],
	curve: ["courbe", "la courbe"],
	bend: ["schéma", "le schéma"],
	clamps: ["schéma", "le schéma"],
	level: ["schéma", "le schéma"],
	interval: ["frise", "la frise"],
};

/** « texte » or « tableau, ligne « trappe B » » : the exact spot of a value on its page. */
export function place(fact: Fact, page: Page): string {
	return fact.where === "text"
		? "texte"
		: `${figureNames[page.figure.kind][0]}, ${fact.label}`;
}

function quoted(value: string, where: Fact["where"]): string {
	return where === "text" ? `« ${value} »` : value;
}

/** The verifier's note under a claim: always starts with ✓ or ✗, never colour alone. */
export function note(finding: Finding, claim: Claim): string {
	if (finding.ok) {
		const { page, fact } = finding;
		return `✓ p. ${page.number}, ${place(fact, page)} : ${quoted(fact.value, fact.where)}.`;
	}
	switch (finding.reason) {
		case "mismatch": {
			const { page, fact, other } = finding;
			const found = `✗ p. ${page.number}, ${place(fact, page)} : ${quoted(fact.value, fact.where)}, pas ${quoted(claim.value, fact.where)}.`;
			return other
				? `${found} ${claim.value}, c'est la ${other.label}.`
				: found;
		}
		case "absent":
			return `✗ p. ${finding.page.number} : rien sur ce point, ni dans le texte ni dans ${figureNames[finding.page.figure.kind][1]}.`;
		case "ghost":
			return `✗ p. ${finding.cited} : cette page ne fait pas partie des pages retrouvées.`;
	}
}

/** What kind of invention it was, for the verdict and the recap. */
export function trap(finding: Finding): string {
	if (finding.ok) return "aucune";
	switch (finding.reason) {
		case "mismatch":
			if (finding.other) return "une valeur lue sur la mauvaise ligne";
			return finding.fact.where === "text"
				? "une valeur démentie par le texte"
				: `une valeur démentie par ${figureNames[finding.page.figure.kind][1]}`;
		case "absent":
			return "une affirmation absente de la page citée";
		case "ghost":
			return "une page citée qui n'est pas dans les sources";
	}
}
