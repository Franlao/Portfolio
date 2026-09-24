import { describe, expect, it } from "vitest";
import { copy } from "./copy";
import { type Crate, crates, type ShelfId, shelves } from "./data";
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
	NOT_FOUND,
	type Reserve,
	SUMMARY_NODES,
	score,
	seeded,
	shelfSummary,
	tally,
} from "./logic";

const NBSP = String.fromCharCode(0x00a0);
const crate = (id: string) => crates.find((c) => c.id === id) as Crate;

/** Plays a whole game: each crate goes where `choose` says. */
function play(
	deck: Crate[],
	choose: (crate: Crate, index: number) => ShelfId,
): { reserve: Reserve; filings: Filing[] } {
	let reserve = initialReserve();
	const filings: Filing[] = [];
	deck.forEach((c, i) => {
		const step = file(reserve, c, choose(c, i));
		reserve = step.reserve;
		filings.push(step.filing);
	});
	return { reserve, filings };
}

describe("la réserve qui se range seule", () => {
	it("deals the configured number of crates, without duplicates, every shelf served", () => {
		for (const seed of [1, 7, 42, 2026, 99999]) {
			const deck = deal(seeded(seed));
			expect(deck).toHaveLength(DELIVERIES);
			expect(new Set(deck.map((c) => c.id)).size).toBe(DELIVERIES);
			for (const shelf of shelves) {
				expect(deck.some((c) => c.shelf === shelf.id)).toBe(true);
			}
		}
	});

	it("replays the same game for a seed, and another one for another seed", () => {
		const ids = (seed: number) => deal(seeded(seed)).map((c) => c.id);
		expect(ids(12)).toEqual(ids(12));
		expect(ids(12)).not.toEqual(ids(13));
	});

	it("starts with an empty Montants shelf and a summary for every node", () => {
		const reserve = initialReserve();
		expect(Object.keys(reserve.summaries)).toHaveLength(SUMMARY_NODES);
		expect(reserve.summaries.amounts).toBe(
			shelves.find((s) => s.id === "amounts")?.emptyGist,
		);
		expect(reserve.summaries.file).toContain("Montants : rien de chiffré.");
	});

	it("rewrites only the summaries between the shelf and the top", () => {
		const before = initialReserve();
		const { reserve, filing } = file(before, crate("floor-quote"), "amounts");
		expect(filing.rewritten).toEqual(["amounts", "file"]);
		expect(filing.right).toBe(true);
		for (const shelf of shelves) {
			if (shelf.id === "amounts") continue;
			expect(reserve.summaries[shelf.id]).toBe(before.summaries[shelf.id]);
		}
		expect(reserve.summaries.amounts).toBe(
			"Parquet à refaire, devis de 3 480 €.",
		);
		expect(reserve.summaries.file).toContain("Montants : parquet à 3 480 €.");
	});

	it("keeps the index a full reindex would build, whatever the visitor does", () => {
		for (const seed of [3, 5, 8, 13, 21]) {
			const random = seeded(seed);
			let reserve = initialReserve();
			for (const c of deal(random)) {
				const shelf = shelves[Math.floor(random() * shelves.length)].id;
				reserve = file(reserve, c, shelf).reserve;
				expect(reserve.summaries).toEqual(fullReindex(reserve.placements));
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
		const { reserve, filing } = file(
			initialReserve(),
			crate("floor-quote"),
			"followup",
		);
		expect(filing.right).toBe(false);
		expect(reserve.summaries.followup).toBe(
			"Dossier ouvert le 3 mars ; parquet à refaire, devis de 3 480 €.",
		);
		expect(reserve.summaries.file).toContain(
			"Suivi : ouvert le 3 mars, parquet à 3 480 €.",
		);
		expect(reserve.summaries.file).toContain("Montants : rien de chiffré.");
	});

	it("keeps summaries short once a shelf fills up", () => {
		const { reserve } = play(
			crates.filter((c) => c.shelf === "damage"),
			() => "damage",
		);
		expect(shelfSummary(reserve.placements, "damage")).toBe(
			`Parquet du séjour gondolé sur 6${NBSP}m² ; placard de l'entrée moisi, cartons perdus ; deux prises du séjour hors service. Et 1 pièce plus ancienne.`,
		);
		expect(fileSummary(reserve.placements).split("\n")[0]).toBe(
			"Dégâts : 4 pièces, dont placard moisi, prises hors service.",
		);
	});

	it("fails the control question of a misfiled piece, and asks it first", () => {
		const deck = deal(seeded(10));
		const wrong = deck[4];
		const { reserve, filings } = play(deck, (c) =>
			c === wrong ? (c.shelf === "amounts" ? "damage" : "amounts") : c.shelf,
		);
		const checks = control(reserve, filings);
		expect(checks).toHaveLength(CHECKS);
		expect(checks[0].crate).toBe(wrong);
		expect(checks[0]).toMatchObject({
			found: false,
			target: wrong.shelf,
			reply: NOT_FOUND,
		});
		expect(checks[0].placedIn).not.toBe(wrong.shelf);
		expect(checks.slice(1).every((c) => c.found)).toBe(true);
		expect(checks[1].reply).toBe(checks[1].crate.answer);
	});

	it("answers every question when the reserve is well kept", () => {
		const { reserve, filings } = play(deal(seeded(77)), (c) => c.shelf);
		const checks = control(reserve, filings);
		expect(checks.every((c) => c.found && c.reply === c.crate.answer)).toBe(
			true,
		);
		expect(score(filings, checks)).toEqual({
			filed: DELIVERIES,
			total: DELIVERIES,
			found: CHECKS,
			asked: CHECKS,
			full: DELIVERIES * SUMMARY_NODES,
			incremental: DELIVERIES * 2,
		});
	});

	it("scores a messy reserve", () => {
		const { reserve, filings } = play(deal(seeded(5)), () => "followup");
		const result = score(filings, control(reserve, filings));
		const onFollowup = filings.filter((f) => f.crate.shelf === "followup");
		expect(result.filed).toBe(onFollowup.length);
		expect(result.found).toBe(0);
	});

	it("has one distinct question per crate, and short labels for small screens", () => {
		expect(new Set(crates.map((c) => c.question)).size).toBe(crates.length);
		for (const c of crates) {
			expect(c.answer.length, c.id).toBeGreaterThan(0);
			expect(c.label.length, c.id).toBeLessThanOrEqual(30);
			expect(c.excerpt.length, c.id).toBeLessThanOrEqual(75);
		}
		for (const shelf of shelves) {
			expect(crates.filter((c) => c.shelf === shelf.id).length).toBeGreaterThan(
				0,
			);
		}
	});

	it("agrees the counters in French, singular for 0 and 1", () => {
		expect(copy.fullCount(0)).toBe("0 résumé recalculé");
		expect(copy.incrementalCount(1)).toBe("1 résumé réécrit");
		expect(copy.fullCount(35)).toBe("35 résumés recalculés");
		expect(copy.cost(2, 3)).toBe("2 résumés réécrits, 3 inchangés.");
	});

	it("keeps every chef line short enough for the bubble", () => {
		const { start, right, wrong, perfect, holes } = copy.chef;
		for (const line of [start, ...right, ...wrong, perfect, holes]) {
			expect(line.length, line).toBeLessThan(30);
		}
	});
});
