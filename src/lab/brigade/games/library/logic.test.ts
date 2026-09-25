import { describe, expect, it } from "vitest";
import type { Lang } from "../types";
import { cases } from "./cases";
import { copy, typeset, typo } from "./copy";
import { figureAlt, MAX_POINTS, pencilLoop, renderFigure } from "./figures";
import { game } from "./game";
import {
	type Case,
	deal,
	factsOf,
	inspect,
	type Kind,
	kindOf,
	note,
	type Page,
	type Result,
	ROUNDS,
	roundOf,
	score,
	spotLabel,
	trap,
	verify,
} from "./logic";

const langs: Lang[] = ["fr", "en"];
// Written as char codes so the invisible characters stay readable in the source.
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);

const byId = (lang: Lang, id: string): Case => {
	const found = cases[lang].find((item) => item.id === id);
	if (!found) throw new Error(`No case ${id} in ${lang}`);
	return found;
};

const claimsOf = (pool: readonly Case[]) =>
	pool.flatMap((item) =>
		item.claims.map((pair, position) => ({ item, pair, position })),
	);

/** The shape of a value, all the way down: keys, array lengths, leaf types and function arity. */
function shape(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(shape);
	if (typeof value === "function") return `function(${value.length})`;
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((key) => [key, shape(record[key])]),
		);
	}
	return typeof value;
}

/** Every string a value can show: its strings, and what its functions return for sample arguments. */
function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (typeof value === "function") {
		return strings(value(...Array.from({ length: value.length }, () => 2)));
	}
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value !== null && typeof value === "object") {
		return Object.values(value).flatMap(strings);
	}
	return [];
}

const digits = (text: string) => text.replace(/\D/g, "");
const pageText = (page: Page) =>
	page.text
		.map((segment) => (typeof segment === "string" ? segment : segment.value))
		.join("");

/**
 * What must not change with the language: ids, page numbers, keys, spots, the numbers written
 * everywhere, and what the verifier finds for each invention.
 */
function skeleton(item: Case) {
	return {
		id: item.id,
		question: digits(item.question),
		pages: item.pages.map((page) => ({
			number: page.number,
			figure:
				page.figure.kind === "points"
					? `${page.figure.shape}/${page.figure.mark}`
					: page.figure.kind,
			text: digits(pageText(page)),
			facts: factsOf(page).map((fact) => ({
				key: fact.key,
				where: fact.where,
				spot: typeof fact.spot === "string" ? fact.spot : "row",
				value: digits(fact.value),
			})),
		})),
		claims: item.claims.map((pair) =>
			[pair.truth, pair.fake].map((claim) => ({
				page: claim.page,
				key: claim.key,
				text: digits(claim.text),
				value: digits(claim.value),
			})),
		),
		inventions: item.claims.map((pair) => {
			const finding = verify(pair.fake, item.pages);
			return {
				kind: kindOf(finding),
				misread:
					!finding.ok && finding.reason === "mismatch"
						? (finding.other?.key ?? null)
						: null,
			};
		}),
	};
}

describe("both languages", () => {
	it("give the interface the same shape in French and English", () => {
		expect(shape(copy.en)).toEqual(shape(copy.fr));
	});

	it("give the fictional documentation the same shape in French and English", () => {
		expect(shape(cases.en)).toEqual(shape(cases.fr));
	});

	it("tell the same story: same pages, numbers, citations and inventions", () => {
		expect(cases.en.map(skeleton)).toEqual(cases.fr.map(skeleton));
	});

	it("keep each language's own quotes, and no French left in English", () => {
		for (const line of [...strings(copy.en), ...strings(cases.en)]) {
			expect(line, line).not.toMatch(/[«»'"àâçéèêëîïôûùœ]/);
		}
		for (const line of [...strings(copy.fr), ...strings(cases.fr)]) {
			expect(line, line).not.toMatch(/[“”’]/);
		}
	});

	it("give the panel a typeset title and intro in each language", () => {
		expect(game.title.fr).toBe(typo("Chasse à l'hallucination"));
		expect(game.intro.fr).toContain(`inventée${NBSP}:`);
		expect(game.title.en).toBe("Spot the hallucination");
		expect(game.intro.en).not.toContain(NBSP);
	});

	it("sets English without French spacing, but keeps units on their number", () => {
		expect(typeset.en("Torque: 25 N·m [p. 14]")).toBe(
			`Torque: 25${NBSP}N·m [p.${NBSP}14]`,
		);
		expect(typeset.en("Well spotted!")).toBe("Well spotted!");
		expect(typeset.en("One reading every 10 s.")).toBe(
			`One reading every 10${NBSP}s.`,
		);
	});
});

describe.each(langs)("the fictional documentation (%s)", (lang) => {
	const pool = cases[lang];
	const everyClaim = claimsOf(pool);

	it.each(everyClaim.map((c) => [`${c.item.id} #${c.position + 1}`, c]))(
		"backs the faithful claim and catches the invented one (%s)",
		(_, { item, pair }) => {
			expect(verify(pair.truth, item.pages).ok).toBe(true);
			expect(verify(pair.fake, item.pages).ok).toBe(false);
		},
	);

	it("states in each sentence the value it is checked on", () => {
		for (const { pair } of everyClaim) {
			for (const claim of [pair.truth, pair.fake]) {
				expect(claim.text.toLowerCase(), claim.text).toContain(
					claim.value.toLowerCase(),
				);
			}
		}
	});

	it("gives each value of a page its own key", () => {
		for (const item of pool) {
			for (const page of item.pages) {
				const keys = factsOf(page).map((fact) => fact.key);
				expect(new Set(keys).size, `p. ${page.number}`).toBe(keys.length);
			}
		}
	});

	it("serves three pages and three claims per question", () => {
		for (const item of pool) {
			expect(item.pages, item.id).toHaveLength(3);
			expect(item.claims, item.id).toHaveLength(3);
		}
	});

	it("hides at least one invention per question in a figure", () => {
		for (const item of pool) {
			const kinds = item.claims.map((pair) =>
				kindOf(verify(pair.fake, item.pages)),
			);
			expect(kinds, item.id).toContain("figure");
		}
	});

	it("uses every kind of invention somewhere", () => {
		const kinds = new Set(
			everyClaim.map(({ item, pair }) => kindOf(verify(pair.fake, item.pages))),
		);
		expect([...kinds].sort()).toEqual(["absent", "figure", "ghost", "text"]);
	});
});

describe.each(langs)("the figures (%s)", (lang) => {
	const pool = cases[lang];

	it("draws every figure value inside the group the verifier circles", () => {
		for (const item of pool) {
			for (const page of item.pages) {
				const svg = renderFigure(page, lang);
				for (const fact of factsOf(page).filter((f) => f.where === "figure")) {
					const group = svg
						.split(`data-fact="${fact.key}"`)[1]
						?.split("</g>")[0];
					expect(group, `${fact.key} on p. ${page.number}`).toBeDefined();
					// A count is drawn, not written: the next test counts the items instead.
					if (page.figure.kind === "points") continue;
					expect(group, fact.key).toContain(typeset[lang](fact.value));
				}
			}
		}
	});

	it("draws as many items as a count says", () => {
		for (const item of pool) {
			for (const page of item.pages) {
				if (page.figure.kind !== "points") continue;
				const count = Number.parseInt(page.figure.count.value, 10);
				expect(count).toBeGreaterThan(0);
				expect(count).toBeLessThanOrEqual(MAX_POINTS[page.figure.shape]);
				const group =
					renderFigure(page, lang)
						.split(`data-fact="${page.figure.count.key}"`)[1]
						?.split("</g>")[0] ?? "";
				const drawn =
					page.figure.mark === "sensor"
						? (group.match(/class="fill"/g) ?? []).length
						: (group.match(/class="line paper"/g) ?? []).length;
				expect(drawn, `p. ${page.number}`).toBe(count);
			}
		}
	});

	it("describes every figure value to screen readers", () => {
		for (const item of pool) {
			for (const page of item.pages) {
				const alt = figureAlt(page.figure, lang);
				for (const fact of factsOf(page).filter((f) => f.where === "figure")) {
					const expected =
						page.figure.kind === "points"
							? String(Number.parseInt(fact.value, 10))
							: fact.value;
					expect(alt, fact.key).toContain(expected);
				}
			}
		}
	});

	it("groups the thousands of the timeline the way the language writes them", () => {
		const page = byId(lang, "gearbox").pages[2];
		const expected = lang === "fr" ? typo("120 000") : "120,000";
		expect(renderFigure(page, lang)).toContain(`>${expected}<`);
	});
});

describe("the pencil loop", () => {
	it("keeps the pencil loop around its box, and its sign inside the drawing", () => {
		const box = { x: 20, y: 30, width: 60, height: 20 };
		const { d, tip } = pencilLoop(box, 3);
		const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
		expect(numbers.length).toBeGreaterThan(40);
		expect(numbers.every(Number.isFinite)).toBe(true);
		const xs = numbers.filter((_, i) => i % 2 === 0);
		expect(Math.min(...xs)).toBeLessThan(box.x);
		expect(Math.max(...xs)).toBeGreaterThan(box.x + box.width);
		expect(tip.x).toBeLessThanOrEqual(192);
		expect(tip.y).toBeGreaterThanOrEqual(12);
		expect(pencilLoop(box, 3).d).toBe(d);
	});
});

/** The verifier's exact words for the same findings, in each language. */
const words: Record<
	Lang,
	{
		misread: string;
		misreadTrap: string;
		screws: string;
		gasket: string;
		absent: string;
		neighbour: RegExp;
	}
> = {
	fr: {
		misread:
			"✗ p. 14, tableau, ligne « trappe B » : 25 N·m, pas 18 N·m. 18 N·m, c'est la ligne « trappe A ».",
		misreadTrap: "une valeur lue sur la mauvaise ligne",
		screws: "✓ p. 12, schéma, vis comptées : 4 vis.",
		gasket: "✓ p. 15, texte : « à chaque démontage ».",
		absent: "✗ p. 15 : rien sur ce point, ni dans le texte ni dans le schéma.",
		neighbour: /^ligne /,
	},
	en: {
		misread:
			"✗ p. 14, table, “hatch B” row: 25 N·m, not 18 N·m. 18 N·m is on the “hatch A” row.",
		misreadTrap: "a value read off the wrong line",
		screws: "✓ p. 12, diagram, screw count: 4 screws.",
		gasket: "✓ p. 15, text: “each time it is removed”.",
		absent: "✗ p. 15: nothing on this, in the text or the diagram.",
		neighbour: / (row|line)$/,
	},
};

describe.each(langs)("the verifier (%s)", (lang) => {
	const pool = cases[lang];
	const everyClaim = claimsOf(pool);
	const expected = words[lang];

	it("finds exactly one invention per answer, where it was hidden", () => {
		for (const item of pool) {
			for (let fake = 0; fake < item.claims.length; fake++) {
				const failing = inspect(roundOf(item, fake))
					.map((finding, i) => (finding.ok ? -1 : i))
					.filter((i) => i >= 0);
				expect(failing, `${item.id} #${fake + 1}`).toEqual([fake]);
			}
		}
	});

	it("names the line a wrong value was read from", () => {
		const hatch = byId(lang, "hatch");
		const finding = verify(hatch.claims[1].fake, hatch.pages);
		expect(note(finding, hatch.claims[1].fake, lang)).toBe(expected.misread);
		expect(trap(finding, lang)).toBe(expected.misreadTrap);
	});

	it("says where a faithful value sits, in the text or the figure", () => {
		const hatch = byId(lang, "hatch");
		const [screws, , gasket] = hatch.claims.map((pair) => pair.truth);
		expect(note(verify(screws, hatch.pages), screws, lang)).toBe(
			expected.screws,
		);
		expect(note(verify(gasket, hatch.pages), gasket, lang)).toBe(
			expected.gasket,
		);
	});

	it("flags a page that the search never brought back", () => {
		const bracket = byId(lang, "bracket");
		const fake = bracket.claims[2].fake;
		const finding = verify(fake, bracket.pages);
		expect(kindOf(finding)).toBe("ghost");
		expect(note(finding, fake, lang)).toContain("p. 19");
	});

	it("flags a claim its page does not contain, text and figure alike", () => {
		const hatch = byId(lang, "hatch");
		const fake = hatch.claims[2].fake;
		expect(note(verify(fake, hatch.pages), fake, lang)).toBe(expected.absent);
	});

	it("never relies on colour alone: every note starts with ✓ or ✗", () => {
		for (const { item, pair } of everyClaim) {
			for (const claim of [pair.truth, pair.fake]) {
				expect(note(verify(claim, item.pages), claim, lang)).toMatch(/^[✓✗] /);
			}
		}
	});

	it("labels the neighbouring line as a line, so the note reads well", () => {
		let seen = 0;
		for (const { item, pair } of everyClaim) {
			const finding = verify(pair.fake, item.pages);
			if (!finding.ok && finding.reason === "mismatch" && finding.other) {
				expect(spotLabel(finding.other, lang)).toMatch(expected.neighbour);
				seen++;
			}
		}
		expect(seen).toBeGreaterThan(0);
	});

	it("names a trap for every invention", () => {
		for (const { item, pair } of everyClaim) {
			const kind = trap(verify(pair.fake, item.pages), lang);
			expect(kind, pair.fake.text).not.toBe(copy[lang].traps.none);
		}
	});
});

describe("dealing a game", () => {
	const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);
	const signature = (seed: number, lang: Lang = "fr") =>
		deal(seed, cases[lang])
			.map((r) => `${r.item.id}:${r.fake}`)
			.join(" ");

	it("serves three different questions with one invention each", () => {
		for (const seed of seeds) {
			const rounds = deal(seed, cases.fr);
			expect(rounds).toHaveLength(ROUNDS);
			expect(new Set(rounds.map((r) => r.item.id)).size).toBe(ROUNDS);
			for (const round of rounds) {
				expect(inspect(round).filter((f) => !f.ok)).toHaveLength(1);
			}
		}
	});

	it("always hides one invention in a figure, and mixes kinds and positions", () => {
		for (const seed of seeds) {
			const rounds = deal(seed, cases.fr);
			const kinds = rounds.map((round) =>
				kindOf(inspect(round)[round.fake]),
			) as Kind[];
			expect(kinds, `seed ${seed}`).toContain("figure");
			expect(new Set(kinds).size, `seed ${seed}`).toBeGreaterThanOrEqual(2);
			expect(new Set(rounds.map((r) => r.fake)).size).toBeGreaterThanOrEqual(2);
		}
	});

	it("replays the same game for the same seed", () => {
		expect(signature(42)).toBe(signature(42));
		expect(new Set(seeds.map((seed) => signature(seed))).size).toBeGreaterThan(
			30,
		);
	});

	it("deals the same game in French and English for the same seed", () => {
		for (const seed of seeds) {
			expect(signature(seed, "en"), `seed ${seed}`).toBe(signature(seed, "fr"));
		}
	});

	it("brings at least one new question when the visitor plays again", () => {
		for (const lang of langs) {
			for (const seed of seeds) {
				const first = deal(seed, cases[lang]).map((r) => r.item.id);
				const second = deal(seed + 1, cases[lang], first).map((r) => r.item.id);
				expect(
					second.some((id) => !first.includes(id)),
					`${lang} seed ${seed}`,
				).toBe(true);
			}
		}
	});
});

describe("the score", () => {
	it("counts the inventions the visitor pointed at", () => {
		const rounds = deal(7, cases.fr);
		const results: Result[] = rounds.map((round, i) => ({
			round,
			picked: i === 0 ? round.fake : (round.fake + 1) % 3,
		}));
		expect(score(results)).toEqual({ right: 1, total: 3 });
	});

	it("words the end of the game in French typography", () => {
		expect(copy.fr.score(3, 3)).toBe(
			"Sans faute : 3 hallucinations démasquées sur 3.",
		);
		expect(copy.fr.score(1, 3)).toBe("1 hallucination démasquée sur 3.");
		expect(typo("Couple : 25 N·m [p. 14]")).toBe(
			`Couple${NBSP}: 25${NBSP}N·m [p.${NBSP}14]`,
		);
		expect(typo("tous les 60 000 km")).toBe(
			`tous les 60${NARROW_NBSP}000${NBSP}km`,
		);
	});

	it("words the end of the game in English, with English plurals", () => {
		expect(copy.en.score(3, 3)).toBe(
			"Clean sheet: you caught 3 hallucinations out of 3.",
		);
		expect(copy.en.score(1, 3)).toBe("You caught 1 hallucination out of 3.");
		expect(copy.en.score(0, 3)).toBe("You caught 0 hallucinations out of 3.");
	});

	it.each(langs)("keeps the chef's lines under 30 characters (%s)", (lang) => {
		for (const line of Object.values(copy[lang].say)) {
			expect(line.length, line).toBeLessThan(30);
		}
	});
});
