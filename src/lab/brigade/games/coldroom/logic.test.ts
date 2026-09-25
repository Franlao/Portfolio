import { describe, expect, it } from "vitest";
import type { Lang } from "../types";
import { COPY } from "./copy";
import {
	type Answer,
	endTexts,
	FIELDS,
	feedback,
	judge,
	modelAnswer,
	passagesOf,
	pickReport,
	plainText,
	REVIEW_BELOW,
	ROLES,
	reportBytes,
	requestExit,
	seeded,
	summarize,
	temptAfter,
	tokenize,
} from "./logic";
import { REPORTS } from "./reports";

const LANGS: readonly Lang[] = ["fr", "en"];

const byId = (id: string, lang: Lang = "fr") =>
	REPORTS[lang].find((report) => report.id === id) ?? REPORTS[lang][0];

const allRight = (): Answer[] =>
	FIELDS.map((field) => ({ field, role: field, right: true }));

describe.each(LANGS)("rien ne sort : the reports (%s)", (lang) => {
	describe.each(REPORTS[lang].map((report) => [report.id, report] as const))(
		"%s",
		(_, report) => {
			const passages = passagesOf(report);
			const roles = passages.map((passage) => passage.role);

			it("is written in its language", () => {
				expect(report.lang).toBe(lang);
			});

			it("has exactly one passage for each field of the sheet", () => {
				for (const field of FIELDS) {
					expect(
						roles.filter((role) => role === field),
						field,
					).toHaveLength(1);
				}
			});

			it("uses known roles only, once each, all with a value", () => {
				expect(new Set(roles).size).toBe(roles.length);
				for (const role of roles) {
					expect(ROLES).toContain(role);
					expect(report.values[role], role).toBeTruthy();
				}
			});

			it("hides at least four traps among the passages", () => {
				const fields: readonly string[] = FIELDS;
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
					const guess = modelAnswer(report, field);
					expect(roles).toContain(guess.role);
					expect(guess.confidence).toBeGreaterThan(0);
					expect(guess.confidence).toBeLessThanOrEqual(1);
					if (!guess.right) expect(guess.review, field).toBe(true);
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
				expect(text).toContain(COPY[lang].reportTitle);
				// Accents and the middle dot take two bytes: the count is bytes, not characters.
				expect(reportBytes(report)).toBeGreaterThan(text.length);
			});
		},
	);

	it("lets the model get something wrong in some reports, not in all", () => {
		const scores = REPORTS[lang].map((report) => summarize(report, []).model);
		expect(Math.min(...scores)).toBeLessThan(FIELDS.length);
		expect(Math.max(...scores)).toBe(FIELDS.length);
	});
});

describe("rien ne sort : the same game in both languages", () => {
	const pairs = REPORTS.fr.map((fr, i) => [fr.id, fr, REPORTS.en[i]] as const);

	it("deals the same reports, in the same order", () => {
		expect(REPORTS.en.map((report) => report.id)).toEqual(
			REPORTS.fr.map((report) => report.id),
		);
	});

	describe.each(pairs)("%s", (_, fr, en) => {
		it("replays the same model, on the same clock", () => {
			expect(en.model).toEqual(fr.model);
			expect(en.modelSeconds).toEqual(fr.modelSeconds);
		});

		it("offers the same passages, paragraph by paragraph, in the same order", () => {
			const rolesOf = (paragraph: string) =>
				tokenize(paragraph).flatMap((token) => token.role ?? []);
			expect(en.paragraphs.map(rolesOf)).toEqual(fr.paragraphs.map(rolesOf));
			expect(Object.keys(en.values).sort()).toEqual(
				Object.keys(fr.values).sort(),
			);
		});

		it("judges every click the same way, and the model too", () => {
			for (const field of FIELDS) {
				for (const role of ROLES) {
					expect(judge(en, field, role).right).toBe(
						judge(fr, field, role).right,
					);
					expect(feedback(en, field, role, true).right).toBe(
						feedback(fr, field, role, true).right,
					);
				}
				const { value: _en, ...enGuess } = modelAnswer(en, field);
				const { value: _fr, ...frGuess } = modelAnswer(fr, field);
				expect(enGuess).toEqual(frGuess);
			}
		});

		it("scores a game the same way", () => {
			const answers: Answer[] = FIELDS.map((field, i) => ({
				field,
				role: i % 2 ? field : "exit",
				right: i % 2 === 1,
			}));
			expect(summarize(en, answers)).toEqual(summarize(fr, answers));
		});
	});

	it("deals the same report and the same temptation for a given seed", () => {
		const deal = (lang: Lang) => {
			const random = seeded(11);
			let previous: string | null = null;
			const dealt: string[] = [];
			for (let i = 0; i < 12; i++) {
				const report = pickReport(previous, random, REPORTS[lang]);
				dealt.push(`${report.id}@${temptAfter(random)}`);
				previous = report.id;
			}
			return dealt;
		};
		expect(deal("en")).toEqual(deal("fr"));
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
		expect(judge(byId("pneumo", "en"), "entry", "consult")).toEqual({
			right: false,
			expected: "12 March",
			chosen: "9 March",
		});
	});

	it("explains a wrong click with what the passage really is", () => {
		const result = feedback(report, "discharge", "usual", true);
		expect(result.right).toBe(false);
		expect(result.player).toContain("le traitement habituel");
		expect(result.player).toContain("« amoxicilline »");

		const english = feedback(byId("pneumo", "en"), "discharge", "usual", true);
		expect(english.right).toBe(false);
		expect(english.player).toBe(
			"✗ That passage gives the regular medication, from before admission. This field needs the discharge medication: “amoxicillin”.",
		);
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

	it("says the same about the model in English", () => {
		const english = byId("pneumo", "en");
		expect(feedback(english, "entry", "entry", true).model).toBe(
			"The model wrote the same, confidence 94%.",
		);
		expect(feedback(english, "dosage", "dosage", true).model).toBe(
			"The model got it wrong: “500 mg twice daily”, confidence 44%, needs review.",
		);
		expect(feedback(english, "dosage", "usualDose", true).model).toContain(
			"the same mistake",
		);
		expect(feedback(english, "entry", "exit", true).model).toContain(
			"got this one right",
		);
		expect(feedback(english, "entry", "entry", false).model).toContain(
			"still reading",
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
		for (const bytes of [0, 1, 512, reportBytes(REPORTS.fr[0]), 1e9]) {
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

	it.each(LANGS)(
		"never deals the same report twice in a row, and deals them all (%s)",
		(lang) => {
			const random = seeded(7);
			let previous: string | null = null;
			const seen = new Set<string>();
			for (let i = 0; i < 40; i++) {
				const report = pickReport(previous, random, REPORTS[lang]);
				expect(report.id).not.toBe(previous);
				expect(report.lang).toBe(lang);
				seen.add(report.id);
				previous = report.id;
			}
			expect(seen.size).toBe(REPORTS[lang].length);
		},
	);

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

	const none = (): Answer[] =>
		FIELDS.map((field) => ({ field, role: "exit", right: false }));
	const one = (): Answer[] =>
		none().map((answer, i) =>
			i === 0 ? { ...answer, role: answer.field, right: true } : answer,
		);

	it("writes the end screen with the right plurals", () => {
		const report = byId("pneumo");
		expect(endTexts(report, none(), 41.6, false, 0).score).toBe(
			"Vous : 0 champ juste sur 5, en 42 s.",
		);
		expect(endTexts(report, one(), 30, false, 0).score).toContain(
			"1 champ juste sur 5",
		);
		expect(endTexts(report, allRight(), 30, false, 0).score).toContain(
			"5 champs justes sur 5",
		);
	});

	it("writes the English end screen", () => {
		const report = byId("pneumo", "en");
		expect(endTexts(report, none(), 41.6, false, 0).score).toBe(
			"You: 0 out of 5 fields right, in 42 seconds.",
		);
		expect(endTexts(report, allRight(), 30, false, 0).score).toContain(
			"5 out of 5 fields right",
		);
		expect(endTexts(report, allRight(), 30, false, 0).heading).toBe(
			"Form complete",
		);
	});

	it("ties the model's mistake to its lowest confidence", () => {
		expect(endTexts(byId("pneumo"), [], 30, false, 0).model).toBe(
			"Le modèle local : 4 sur 5. Son erreur, sur la posologie de sortie, portait sa confiance la plus basse (44 %) : c'est là qu'on relit.",
		);
		expect(endTexts(byId("digest"), [], 30, false, 0).model).toContain(
			"5 sur 5",
		);
		expect(endTexts(byId("pneumo", "en"), [], 30, false, 0).model).toBe(
			"The local model: 4 out of 5. Its mistake, on the discharge dose, came with its lowest confidence (44%): that's where a human looks again.",
		);
		expect(endTexts(byId("digest", "en"), [], 30, false, 0).model).toBe(
			"The local model: 5 out of 5. Its lowest confidence (58%) was on the past medical history: that's the field to review first.",
		);
	});

	it("keeps the door line at zero, tempted or not", () => {
		const report = byId("digest");
		const tempted = endTexts(report, [], 30, true, 0).door;
		const calm = endTexts(report, [], 30, false, 0).door;
		expect(tempted).toContain("Octets sortis de la pièce : 0.");
		expect(tempted).toContain("la porte a tenu");
		expect(calm).toContain("« Envoyer au service en ligne »");

		const english = byId("digest", "en");
		expect(endTexts(english, [], 30, true, 0).door).toContain(
			"Bytes that left the room: 0.",
		);
		expect(endTexts(english, [], 30, false, 0).door).toContain(
			"“Send to the online service”",
		);
	});

	it.each([
		["fr", /« (.+?) »/],
		["en", /“(.+?)”/],
	] as const)(
		"quotes the online button by its real label on the end screen (%s)",
		(lang, quoted) => {
			const door = endTexts(REPORTS[lang][0], [], 30, false, 0).door;
			const label = door.match(quoted)?.[1] ?? "";
			expect(label).not.toBe("");
			expect(COPY[lang].task.tempt.startsWith(label)).toBe(true);
		},
	);
});
