import { describe, expect, it } from "vitest";
import { cases } from "./cases";
import { copy, typo } from "./copy";
import { figureAlt, MAX_POINTS, pencilLoop, renderFigure } from "./figures";
import {
	type Case,
	deal,
	factsOf,
	inspect,
	type Kind,
	kindOf,
	note,
	type Result,
	ROUNDS,
	roundOf,
	score,
	trap,
	verify,
} from "./logic";

const byId = (id: string): Case => {
	const found = cases.find((item) => item.id === id);
	if (!found) throw new Error(`No case ${id}`);
	return found;
};

const everyClaim = cases.flatMap((item) =>
	item.claims.map((pair, position) => ({ item, pair, position })),
);

describe("the fictional documentation", () => {
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
		for (const item of cases) {
			for (const page of item.pages) {
				const keys = factsOf(page).map((fact) => fact.key);
				expect(new Set(keys).size, `p. ${page.number}`).toBe(keys.length);
			}
		}
	});

	it("serves three pages and three claims per question", () => {
		for (const item of cases) {
			expect(item.pages, item.id).toHaveLength(3);
			expect(item.claims, item.id).toHaveLength(3);
		}
	});

	it("hides at least one invention per question in a figure", () => {
		for (const item of cases) {
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

describe("the figures", () => {
	it("draws every figure value inside the group the verifier circles", () => {
		for (const item of cases) {
			for (const page of item.pages) {
				const svg = renderFigure(page);
				for (const fact of factsOf(page).filter((f) => f.where === "figure")) {
					const group = svg
						.split(`data-fact="${fact.key}"`)[1]
						?.split("</g>")[0];
					expect(group, `${fact.key} on p. ${page.number}`).toBeDefined();
					// A count is drawn, not written: the next test counts the items instead.
					if (page.figure.kind === "points") continue;
					expect(group, fact.key).toContain(typo(fact.value));
				}
			}
		}
	});

	it("draws as many items as a count says", () => {
		for (const item of cases) {
			for (const page of item.pages) {
				if (page.figure.kind !== "points") continue;
				const count = Number.parseInt(page.figure.count.value, 10);
				expect(count).toBeGreaterThan(0);
				expect(count).toBeLessThanOrEqual(MAX_POINTS[page.figure.shape]);
				const group =
					renderFigure(page)
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
		for (const item of cases) {
			for (const page of item.pages) {
				const alt = figureAlt(page.figure);
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

describe("the verifier", () => {
	it("finds exactly one invention per answer, where it was hidden", () => {
		for (const item of cases) {
			for (let fake = 0; fake < item.claims.length; fake++) {
				const failing = inspect(roundOf(item, fake))
					.map((finding, i) => (finding.ok ? -1 : i))
					.filter((i) => i >= 0);
				expect(failing, `${item.id} #${fake + 1}`).toEqual([fake]);
			}
		}
	});

	it("names the line a wrong value was read from", () => {
		const hatch = byId("hatch");
		const finding = verify(hatch.claims[1].fake, hatch.pages);
		expect(note(finding, hatch.claims[1].fake)).toBe(
			"✗ p. 14, tableau, ligne « trappe B » : 25 N·m, pas 18 N·m. 18 N·m, c'est la ligne « trappe A ».",
		);
		expect(trap(finding)).toBe("une valeur lue sur la mauvaise ligne");
	});

	it("says where a faithful value sits, in the text or the figure", () => {
		const hatch = byId("hatch");
		const [screws, , joint] = hatch.claims.map((pair) => pair.truth);
		expect(note(verify(screws, hatch.pages), screws)).toBe(
			"✓ p. 12, schéma, vis comptées : 4 vis.",
		);
		expect(note(verify(joint, hatch.pages), joint)).toBe(
			"✓ p. 15, texte : « à chaque démontage ».",
		);
	});

	it("flags a page that the search never brought back", () => {
		const bracket = byId("bracket");
		const fake = bracket.claims[2].fake;
		const finding = verify(fake, bracket.pages);
		expect(kindOf(finding)).toBe("ghost");
		expect(note(finding, fake)).toContain("p. 19");
	});

	it("flags a claim its page does not contain, text and figure alike", () => {
		const hatch = byId("hatch");
		const fake = hatch.claims[2].fake;
		expect(note(verify(fake, hatch.pages), fake)).toBe(
			"✗ p. 15 : rien sur ce point, ni dans le texte ni dans le schéma.",
		);
	});

	it("never relies on colour alone: every note starts with ✓ or ✗", () => {
		for (const { item, pair } of everyClaim) {
			for (const claim of [pair.truth, pair.fake]) {
				expect(note(verify(claim, item.pages), claim)).toMatch(/^[✓✗] /);
			}
		}
	});

	it("labels the neighbouring line as a line, so the note reads well", () => {
		for (const { item, pair } of everyClaim) {
			const finding = verify(pair.fake, item.pages);
			if (!finding.ok && finding.reason === "mismatch" && finding.other) {
				expect(finding.other.label).toMatch(/^ligne /);
			}
		}
	});
});

describe("dealing a game", () => {
	const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

	it("serves three different questions with one invention each", () => {
		for (const seed of seeds) {
			const rounds = deal(seed);
			expect(rounds).toHaveLength(ROUNDS);
			expect(new Set(rounds.map((r) => r.item.id)).size).toBe(ROUNDS);
			for (const round of rounds) {
				expect(inspect(round).filter((f) => !f.ok)).toHaveLength(1);
			}
		}
	});

	it("always hides one invention in a figure, and mixes kinds and positions", () => {
		for (const seed of seeds) {
			const rounds = deal(seed);
			const kinds = rounds.map((round) =>
				kindOf(inspect(round)[round.fake]),
			) as Kind[];
			expect(kinds, `seed ${seed}`).toContain("figure");
			expect(new Set(kinds).size, `seed ${seed}`).toBeGreaterThanOrEqual(2);
			expect(new Set(rounds.map((r) => r.fake)).size).toBeGreaterThanOrEqual(2);
		}
	});

	it("replays the same game for the same seed", () => {
		const signature = (seed: number) =>
			deal(seed)
				.map((r) => `${r.item.id}:${r.fake}`)
				.join(" ");
		expect(signature(42)).toBe(signature(42));
		expect(new Set(seeds.map(signature)).size).toBeGreaterThan(30);
	});

	it("brings at least one new question when the visitor plays again", () => {
		for (const seed of seeds) {
			const first = deal(seed).map((r) => r.item.id);
			const second = deal(seed + 1, first).map((r) => r.item.id);
			expect(
				second.some((id) => !first.includes(id)),
				`seed ${seed}`,
			).toBe(true);
		}
	});
});

describe("the score", () => {
	it("counts the inventions the visitor pointed at", () => {
		const rounds = deal(7);
		const results: Result[] = rounds.map((round, i) => ({
			round,
			picked: i === 0 ? round.fake : (round.fake + 1) % 3,
		}));
		expect(score(results)).toEqual({ right: 1, total: 3 });
	});

	it("words the end of the game in French typography", () => {
		expect(copy.score(3, 3)).toBe(
			"Sans faute : 3 hallucinations démasquées sur 3.",
		);
		expect(copy.score(1, 3)).toBe("1 hallucination démasquée sur 3.");
		expect(typo("Couple : 25 N·m [p. 14]")).toBe("Couple : 25 N·m [p. 14]");
		expect(typo("tous les 60 000 km")).toBe("tous les 60 000 km");
	});

	it("keeps the chef's lines under 30 characters", () => {
		for (const line of Object.values(copy.say)) {
			expect(line.length, line).toBeLessThan(30);
		}
	});
});
