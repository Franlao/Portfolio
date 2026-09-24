import { describe, expect, it } from "vitest";
import { deal, judge, ROUNDS, rushCases, score } from "./rush";

describe("coup de feu au passe", () => {
	it.each(rushCases.map((c) => [c.id, c]))(
		"the chef agrees with the rules for %s",
		(_, rushCase) => {
			expect(judge(rushCase.file).outcome).toBe(rushCase.expected);
		},
	);

	it("explains every verdict", () => {
		for (const rushCase of rushCases) {
			expect(judge(rushCase.file).reasons.length, rushCase.id).toBeGreaterThan(
				0,
			);
		}
	});

	it("names the missing document", () => {
		const verdict = judge(
			rushCases.find((c) => c.id === "no-quote")?.file ?? rushCases[0].file,
		);
		expect(verdict.reasons).toEqual(["Pièce manquante : devis de réparation"]);
	});

	it("deals the configured number of rounds, without duplicates", () => {
		const rounds = deal(() => 0.3);
		expect(rounds).toHaveLength(ROUNDS);
		expect(new Set(rounds.map((r) => r.id)).size).toBe(ROUNDS);
	});

	it("scores right answers against the chef", () => {
		const cases = rushCases.slice(0, 2);
		const rounds = cases.map((rushCase, i) => {
			const verdict = judge(rushCase.file);
			return {
				rushCase,
				verdict,
				choice: i === 0 ? verdict.outcome : null,
				seconds: 4,
			};
		});
		expect(score(rounds)).toMatchObject({
			right: 1,
			total: 2,
			playerSeconds: 8,
		});
	});
});
