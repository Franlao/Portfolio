import { describe, expect, it } from "vitest";
import type { Lang } from "../types";
import { copy } from "./copy";
import { type Crate, crates, type ShelfId, shelves, texts } from "./data";
import {
	CHECKS,
	control,
	DELIVERIES,
	deal,
	type Filing,
	file,
	fileSummary,
	fullReindex,
	initialReserve,
	type Reserve,
	SUMMARY_NODES,
	score,
	seeded,
	shelfSummary,
	tally,
} from "./logic";

const NBSP = String.fromCharCode(0x00a0);
const langs: Lang[] = ["fr", "en"];
const crate = (id: string) => crates.find((c) => c.id === id) as Crate;

/** Plays a whole game: each crate goes where `choose` says. */
function play(
	deck: Crate[],
	choose: (crate: Crate, index: number) => ShelfId,
	lang: Lang = "fr",
): { reserve: Reserve; filings: Filing[] } {
	let reserve = initialReserve(lang);
	const filings: Filing[] = [];
	deck.forEach((c, i) => {
		const step = file(reserve, c, choose(c, i));
		reserve = step.reserve;
		filings.push(step.filing);
	});
	return { reserve, filings };
}

/** The shape of a value: its keys in depth, its array lengths, its function arities. */
function shape(value: unknown): unknown {
	if (typeof value === "function") return `function/${value.length}`;
	if (Array.isArray(value)) return value.map(shape);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, shape(entry)]),
		);
	}
	return typeof value;
}

/** Every string a text object can display, functions called with sample numbers. */
function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (typeof value === "function") {
		return strings(
			value(...Array.from({ length: value.length }, (_, i) => i + 2)),
		);
	}
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(strings);
	}
	return [];
}

describe("la réserve qui se range seule", () => {
	it("deals the configured number of crates, without duplicates, every shelf served", () => {
		for (const seed of [1, 7, 42, 2026, 99999]) {
			const deck = deal(seeded(seed));
			expect(deck).toHaveLength(DELIVERIES);
			expect(new Set(deck.map((c) => c.id)).size).toBe(DELIVERIES);
			for (const shelf of shelves) {
				expect(deck.some((c) => c.shelf === shelf)).toBe(true);
			}
		}
	});

	it("replays the same game for a seed, and another one for another seed", () => {
		const ids = (seed: number) => deal(seeded(seed)).map((c) => c.id);
		expect(ids(12)).toEqual(ids(12));
		expect(ids(12)).not.toEqual(ids(13));
	});

	it("plays the same game in French and in English", () => {
		for (const seed of [2, 10, 31]) {
			const deck = deal(seeded(seed));
			// Every other crate goes to the wrong shelf, the same way in both languages.
			const choose = (c: Crate, i: number): ShelfId =>
				i % 2 ? c.shelf : c.shelf === "damage" ? "followup" : "damage";
			const games = langs.map((lang) => {
				const { reserve, filings } = play(deck, choose, lang);
				const checks = control(reserve, filings);
				return {
					filings: filings.map(({ crate, shelf, right, rewritten }) => ({
						id: crate.id,
						shelf,
						right,
						rewritten,
					})),
					checks: checks.map(({ crate, target, placedIn, found }) => ({
						id: crate.id,
						target,
						placedIn,
						found,
					})),
					score: score(filings, checks),
				};
			});
			expect(games[1]).toEqual(games[0]);
		}
	});

	it("starts with an empty amounts shelf and a summary for every node", () => {
		const empty: Record<Lang, string> = {
			fr: "Montants : rien de chiffré.",
			en: "Costs: nothing costed.",
		};
		for (const lang of langs) {
			const reserve = initialReserve(lang);
			expect(Object.keys(reserve.summaries)).toHaveLength(SUMMARY_NODES);
			expect(reserve.summaries.amounts).toBe(
				texts[lang].shelves.amounts.emptyGist,
			);
			expect(reserve.summaries.file).toContain(empty[lang]);
		}
	});

	it("rewrites only the summaries between the shelf and the top", () => {
		const expected: Record<Lang, { shelf: string; line: string }> = {
			fr: {
				shelf: "Parquet à refaire, devis de 3 480 €.",
				line: "Montants : parquet à 3 480 €.",
			},
			en: {
				shelf: "Parquet to be relaid, quoted at €3,480.",
				line: "Costs: parquet €3,480.",
			},
		};
		for (const lang of langs) {
			const before = initialReserve(lang);
			const { reserve, filing } = file(before, crate("floor-quote"), "amounts");
			expect(filing.rewritten).toEqual(["amounts", "file"]);
			expect(filing.right).toBe(true);
			for (const shelf of shelves) {
				if (shelf === "amounts") continue;
				expect(reserve.summaries[shelf]).toBe(before.summaries[shelf]);
			}
			expect(reserve.summaries.amounts).toBe(expected[lang].shelf);
			expect(reserve.summaries.file).toContain(expected[lang].line);
		}
	});

	it("keeps the index a full reindex would build, whatever the visitor does", () => {
		for (const lang of langs) {
			for (const seed of [3, 5, 8, 13, 21]) {
				const random = seeded(seed);
				let reserve = initialReserve(lang);
				for (const c of deal(random)) {
					const shelf = shelves[Math.floor(random() * shelves.length)];
					reserve = file(reserve, c, shelf).reserve;
					expect(reserve.summaries).toEqual(
						fullReindex(reserve.placements, lang),
					);
				}
			}
		}
	});

	it("counts what a full reindex would have cost", () => {
		const { filings } = play(deal(seeded(4)), (c) => c.shelf);
		expect(tally(filings)).toEqual({
			full: DELIVERIES * SUMMARY_NODES,
			incremental: DELIVERIES * 2,
		});
	});

	it("carries a misfiled piece up to the file summary", () => {
		const expected: Record<Lang, [string, string, string]> = {
			fr: [
				"Dossier ouvert le 3 mars ; parquet à refaire, devis de 3 480 €.",
				"Suivi : ouvert le 3 mars, parquet à 3 480 €.",
				"Montants : rien de chiffré.",
			],
			en: [
				"Claim opened on 3 March; parquet to be relaid, quoted at €3,480.",
				"Follow-up: opened 3 March, parquet €3,480.",
				"Costs: nothing costed.",
			],
		};
		for (const lang of langs) {
			const [shelf, line, empty] = expected[lang];
			const { reserve, filing } = file(
				initialReserve(lang),
				crate("floor-quote"),
				"followup",
			);
			expect(filing.right).toBe(false);
			expect(reserve.summaries.followup).toBe(shelf);
			expect(reserve.summaries.file).toContain(line);
			expect(reserve.summaries.file).toContain(empty);
		}
	});

	it("keeps summaries short once a shelf fills up", () => {
		const expected: Record<Lang, [string, string]> = {
			fr: [
				`Parquet du séjour gondolé sur 6${NBSP}m² ; placard de l'entrée moisi, cartons perdus ; deux prises du séjour hors service. Et 1 pièce plus ancienne.`,
				"Dégâts : 4 pièces, dont placard moisi, prises hors service.",
			],
			en: [
				`Living-room parquet buckled over 6${NBSP}m²; hall cupboard gone mouldy, boxes ruined; two living-room sockets out of order. Plus 1 older document.`,
				"Damage: 4 documents, including mouldy cupboard, dead sockets.",
			],
		};
		for (const lang of langs) {
			const { reserve } = play(
				crates.filter((c) => c.shelf === "damage"),
				() => "damage",
				lang,
			);
			expect(shelfSummary(reserve.placements, "damage", lang)).toBe(
				expected[lang][0],
			);
			expect(fileSummary(reserve.placements, lang).split("\n")[0]).toBe(
				expected[lang][1],
			);
		}
	});

	it("agrees the count of older pieces in each language", () => {
		expect(texts.fr.model.older(2)).toBe("Et 2 pièces plus anciennes.");
		expect(texts.en.model.older(2)).toBe("Plus 2 older documents.");
	});

	it("fails the control question of a misfiled piece, and asks it first", () => {
		for (const lang of langs) {
			const deck = deal(seeded(10));
			const wrong = deck[4];
			const { reserve, filings } = play(
				deck,
				(c) =>
					c === wrong
						? c.shelf === "amounts"
							? "damage"
							: "amounts"
						: c.shelf,
				lang,
			);
			const checks = control(reserve, filings);
			expect(checks).toHaveLength(CHECKS);
			expect(checks[0].crate).toBe(wrong);
			expect(checks[0]).toMatchObject({
				found: false,
				target: wrong.shelf,
				reply: texts[lang].model.notFound,
			});
			expect(checks[0].placedIn).not.toBe(wrong.shelf);
			expect(checks.slice(1).every((c) => c.found)).toBe(true);
			expect(checks[1].reply).toBe(
				texts[lang].pieces[checks[1].crate.id].answer,
			);
		}
	});

	it("answers every question when the reserve is well kept", () => {
		for (const lang of langs) {
			const { reserve, filings } = play(deal(seeded(77)), (c) => c.shelf, lang);
			const checks = control(reserve, filings);
			expect(
				checks.every(
					(c) => c.found && c.reply === texts[lang].pieces[c.crate.id].answer,
				),
			).toBe(true);
			expect(score(filings, checks)).toEqual({
				filed: DELIVERIES,
				total: DELIVERIES,
				found: CHECKS,
				asked: CHECKS,
				full: DELIVERIES * SUMMARY_NODES,
				incremental: DELIVERIES * 2,
			});
		}
	});

	it("scores a messy reserve", () => {
		const { reserve, filings } = play(deal(seeded(5)), () => "followup");
		const result = score(filings, control(reserve, filings));
		const onFollowup = filings.filter((f) => f.crate.shelf === "followup");
		expect(result.filed).toBe(onFollowup.length);
		expect(result.found).toBe(0);
	});

	it("has one distinct question per crate, and short labels for small screens", () => {
		for (const lang of langs) {
			const pieces = texts[lang].pieces;
			expect(new Set(crates.map((c) => pieces[c.id].question)).size).toBe(
				crates.length,
			);
			for (const c of crates) {
				expect(pieces[c.id].answer.length, c.id).toBeGreaterThan(0);
			}
			for (const [id, piece] of Object.entries(pieces)) {
				expect(piece.label.length, `${lang} ${id}`).toBeLessThanOrEqual(30);
				expect(piece.excerpt.length, `${lang} ${id}`).toBeLessThanOrEqual(75);
			}
		}
		for (const shelf of shelves) {
			expect(crates.filter((c) => c.shelf === shelf).length).toBeGreaterThan(0);
		}
	});

	it("agrees the counters in French, singular for 0 and 1", () => {
		expect(copy.fr.fullCount(0)).toBe("0 résumé recalculé");
		expect(copy.fr.incrementalCount(1)).toBe("1 résumé réécrit");
		expect(copy.fr.fullCount(35)).toBe("35 résumés recalculés");
		expect(copy.fr.cost(2, 3)).toBe("2 résumés réécrits, 3 inchangés.");
	});

	it("agrees the counters in English, singular for 1 only", () => {
		expect(copy.en.fullCount(0)).toBe("0 summaries recomputed");
		expect(copy.en.incrementalCount(1)).toBe("1 summary rewritten");
		expect(copy.en.fullCount(35)).toBe("35 summaries recomputed");
		expect(copy.en.cost(1, 4)).toBe("1 summary rewritten, 4 unchanged.");
		expect(copy.en.scoreSavings(1400, 3500)).toBe(
			"Summaries rewritten: 1,400, against 3,500 for a full reindex.",
		);
	});

	it("keeps every chef line short enough for the bubble", () => {
		for (const lang of langs) {
			const { start, right, wrong, perfect, holes } = copy[lang].chef;
			for (const line of [start, ...right, ...wrong, perfect, holes]) {
				expect(line.length, line).toBeLessThan(30);
			}
		}
	});

	it("has the same keys in French and in English, in depth", () => {
		expect(shape(copy.en)).toEqual(shape(copy.fr));
		expect(shape(texts.en)).toEqual(shape(texts.fr));
	});

	it("uses each language's own quotes and punctuation", () => {
		for (const text of strings([copy.en, texts.en])) {
			expect(text, text).not.toMatch(/[«»]| [:;?!]/);
		}
		for (const text of strings([copy.fr, texts.fr])) {
			expect(text, text).not.toMatch(/[“”]/);
		}
	});
});
