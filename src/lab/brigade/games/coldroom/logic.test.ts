import { describe, expect, it } from "vitest";
import {
	type Answer,
	endTexts,
	FIELDS,
	feedback,
	fr,
	judge,
	modelAnswer,
	passagesOf,
	pickReport,
	plainText,
	REVIEW_BELOW,
	ROLE_PHRASE,
	reportBytes,
	requestExit,
	seeded,
	summarize,
	temptAfter,
	tokenize,
} from "./logic";
import { REPORTS } from "./reports";

const byId = (id: string) =>
	REPORTS.find((report) => report.id === id) ?? REPORTS[0];

const allRight = (): Answer[] =>
	FIELDS.map((field) => ({ field: field.id, role: field.id, right: true }));

describe("rien ne sort : the reports", () => {
	describe.each(REPORTS.map((report) => [report.id, report] as const))(
		"%s",
		(_, report) => {
			const passages = passagesOf(report);
			const roles = passages.map((passage) => passage.role);

			it("has exactly one passage for each field of the sheet", () => {
				for (const field of FIELDS) {
					expect(
						roles.filter((role) => role === field.id),
						field.id,
					).toHaveLength(1);
				}
			});

			it("uses known roles only, once each, all with a value", () => {
				expect(new Set(roles).size).toBe(roles.length);
				for (const role of roles) {
					expect(Object.keys(ROLE_PHRASE)).toContain(role);
					expect(report.values[role], role).toBeTruthy();
				}
			});

			it("hides at least four traps among the passages", () => {
				const fields = FIELDS.map((field) => field.id as string);
				expect(
					roles.filter((role) => !fields.includes(role)).length,
				).toBeGreaterThanOrEqual(4);
			});

			it("keeps passages short enough for a 360 px screen", () => {
				for (const passage of passages) {
					expect(passage.text.length, passage.text).toBeLessThanOrEqual(32);
				}
			});

			it("replays a model that picks existing passages, and flags its mistakes", () => {
				for (const field of FIELDS) {
					const guess = modelAnswer(report, field.id);
					expect(roles).toContain(guess.role);
					expect(guess.confidence).toBeGreaterThan(0);
					expect(guess.confidence).toBeLessThanOrEqual(1);
					if (!guess.right) expect(guess.review, field.id).toBe(true);
				}
			});

			it("writes the model's sheet in field order, within ten seconds", () => {
				expect(report.modelSeconds).toHaveLength(FIELDS.length);
				const sorted = [...report.modelSeconds].sort((a, b) => a - b);
				expect(report.modelSeconds).toEqual(sorted);
				expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(10);
			});

			it("sends a plain text without markers, counted in UTF-8 bytes", () => {
				const text = plainText(report);
				expect(text).not.toMatch(/[[\]|]/);
				expect(text).toContain("document fictif");
				// Accents take two bytes: the count is bytes, not characters.
				expect(reportBytes(report)).toBeGreaterThan(text.length);
			});
		},
	);

	it("lets the model get something wrong in some reports, not in all", () => {
		const scores = REPORTS.map((report) => summarize(report, []).model);
		expect(Math.min(...scores)).toBeLessThan(FIELDS.length);
		expect(Math.max(...scores)).toBe(FIELDS.length);
	});
});

describe("rien ne sort : a click", () => {
	const report = byId("pneumo");

	it("splits a paragraph into text and passages", () => {
		expect(tokenize("Sortie [le 16 mars|exit], enfin.")).toEqual([
			{ text: "Sortie " },
			{ text: "le 16 mars", role: "exit" },
			{ text: ", enfin." },
		]);
	});

	it("is right only on the passage that answers the field", () => {
		expect(judge(report, "entry", "entry").right).toBe(true);
		expect(judge(report, "entry", "consult")).toEqual({
			right: false,
			expected: "12 mars",
			chosen: "9 mars",
		});
	});

	it("explains a wrong click with what the passage really is", () => {
		const result = feedback(report, "discharge", "usual", true);
		expect(result.right).toBe(false);
		expect(result.player).toContain("le traitement habituel");
		expect(result.player).toContain("« amoxicilline »");
	});

	it("reports the model's answer, its confidence, and when to reread it", () => {
		expect(feedback(report, "entry", "entry", true).model).toBe(
			"Le modèle a écrit la même chose, confiance 94 %.",
		);
		expect(feedback(report, "dosage", "dosage", true).model).toBe(
			"Le modèle s'est trompé : « 500 mg × 2 par jour », confiance 44 %, à relire.",
		);
		expect(feedback(report, "dosage", "usualDose", true).model).toContain(
			"la même erreur",
		);
		expect(feedback(report, "entry", "exit", true).model).toContain(
			"avait vu juste",
		);
		expect(feedback(report, "entry", "entry", false).model).toContain(
			"lit encore",
		);
	});

	it("flags the model below the review threshold only", () => {
		const digest = byId("digest");
		expect(modelAnswer(digest, "history").review).toBe(true);
		expect(modelAnswer(digest, "history").confidence).toBeLessThan(
			REVIEW_BELOW,
		);
		expect(modelAnswer(digest, "entry").review).toBe(false);
	});
});

describe("rien ne sort : the door", () => {
	it("never lets a byte out, whatever is asked", () => {
		for (const bytes of [0, 1, 512, reportBytes(REPORTS[0]), 1e9]) {
			const request = requestExit(bytes);
			expect(request.allowed).toBe(false);
			expect(request.bytesOut).toBe(0);
			expect(request.refused).toBe(bytes);
		}
	});
});

describe("rien ne sort : a game", () => {
	it("is deterministic for a given seed", () => {
		const a = seeded(42);
		const b = seeded(42);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it("never deals the same report twice in a row, and deals them all", () => {
		const random = seeded(7);
		let previous: string | null = null;
		const seen = new Set<string>();
		for (let i = 0; i < 40; i++) {
			const report = pickReport(previous, random);
			expect(report.id).not.toBe(previous);
			seen.add(report.id);
			previous = report.id;
		}
		expect(seen.size).toBe(REPORTS.length);
	});

	it("shows the online shortcut after the first, second or third field", () => {
		const random = seeded(3);
		const seen = new Set<number>();
		for (let i = 0; i < 60; i++) seen.add(temptAfter(random));
		expect([...seen].sort()).toEqual([1, 2, 3]);
	});

	it("scores the visitor, the model and their agreement", () => {
		const report = byId("cardio");
		const answers: Answer[] = [
			{ field: "entry", role: "consult", right: false },
			{ field: "reason", role: "reason", right: true },
			{ field: "history", role: "family", right: false },
			{ field: "discharge", role: "discharge", right: true },
			{ field: "dosage", role: "dosage", right: true },
		];
		expect(summarize(report, answers)).toEqual({
			player: 3,
			model: 4,
			agree: 4,
			total: 5,
			weakest: { field: "entry", confidence: 0.52 },
			misses: ["entry"],
		});
	});

	it("writes the end screen with the right plurals", () => {
		const report = byId("pneumo");
		const none = FIELDS.map((field) => ({
			field: field.id,
			role: "exit" as const,
			right: false,
		}));
		const one = none.map((answer, i) =>
			i === 0 ? { ...answer, role: answer.field, right: true } : answer,
		);
		expect(endTexts(report, none, 41.6, false, 0).score).toBe(
			"Vous : 0 champ juste sur 5, en 42 s.",
		);
		expect(endTexts(report, one, 30, false, 0).score).toContain(
			"1 champ juste sur 5",
		);
		expect(endTexts(report, allRight(), 30, false, 0).score).toContain(
			"5 champs justes sur 5",
		);
	});

	it("ties the model's mistake to its lowest confidence", () => {
		expect(endTexts(byId("pneumo"), [], 30, false, 0).model).toBe(
			"Le modèle local : 4 sur 5. Son erreur, sur la posologie de sortie, portait sa confiance la plus basse (44 %) : c'est là qu'on relit.",
		);
		expect(endTexts(byId("digest"), [], 30, false, 0).model).toContain(
			"5 sur 5",
		);
	});

	it("keeps the door line at zero, tempted or not", () => {
		const report = byId("digest");
		const tempted = endTexts(report, [], 30, true, 0).door;
		const calm = endTexts(report, [], 30, false, 0).door;
		expect(tempted).toContain("Octets sortis de la pièce : 0.");
		expect(tempted).toContain("la porte a tenu");
		expect(calm).toContain("« Envoyer au service en ligne »");
	});

	it("keeps units and numbers together", () => {
		const nbsp = String.fromCharCode(0x00a0);
		expect(fr("500 mg matin")).toBe(`500${nbsp}mg matin`);
		expect(fr("1 g × 3")).toBe(`1${nbsp}g${nbsp}×${nbsp}3`);
		expect(fr("patient n° 0417")).toBe(`patient n°${nbsp}0417`);
		expect(fr("1 842 octets")).toContain(`842${nbsp}octets`);
	});
});
