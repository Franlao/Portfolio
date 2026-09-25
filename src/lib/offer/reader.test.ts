import { describe, expect, it } from "vitest";
import { competenceIds } from "./competences";
import {
	checkReading,
	demandFromRequirements,
	OTHER,
	orderFromLexicon,
	orderFromReading,
	quotes,
	type Reading,
	ReadingSchema,
	readingJsonSchema,
	readingPrompt,
} from "./reader";

const offer = `Nous recherchons notre futur AI Agent Engineer.
Concevoir des agents autonomes et développer les "tools" et API manquants.
Mettre en place des outils de monitoring pour suivre la performance des agents.
Des connaissances en comptabilité sont appréciées.
Python n'est pas requis pour ce poste.`;

const projects = [
	{ slug: "agents-project", skills: { agents: 1, evaluation: 0.8 } },
	{ slug: "python-project", skills: { python: 1 } },
];

const reading: Reading = {
	requirements: [
		{
			competence: "agents",
			importance: "required",
			quote: "concevoir des agents autonomes",
		},
		{
			competence: "evaluation",
			importance: "required",
			quote: "outils de monitoring",
		},
		{
			competence: OTHER,
			importance: "preferred",
			quote: "connaissances en comptabilité",
		},
		{
			competence: "python",
			importance: "not-required",
			quote: "Python n'est pas requis",
		},
		// Made up: nothing like it in the offer.
		{
			competence: "rag",
			importance: "required",
			quote: "expérience des bases vectorielles",
		},
	],
};

describe("the model's contract", () => {
	it("offers every skill of the lexicon, plus « other »", () => {
		const skills =
			readingJsonSchema.properties.requirements.items.properties.competence
				.enum;
		expect([...skills]).toEqual([...competenceIds, OTHER]);
		for (const id of competenceIds)
			expect(readingPrompt()).toContain(`- ${id}:`);
	});

	it("rejects an output outside the schema", () => {
		const invented = {
			requirements: [
				{ competence: "blockchain", importance: "required", quote: "x" },
			],
		};
		expect(ReadingSchema.safeParse(invented).success).toBe(false);
	});
});

describe("the pass: every line must quote the offer", () => {
	it("sends back a made-up quote", () => {
		const { accepted, rejected } = checkReading(offer, reading);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]).toMatchObject({
			competence: "rag",
			reason: "quote-not-found",
		});
		expect(accepted).toHaveLength(4);
	});

	it("ignores case, accents, quote marks and spacing", () => {
		const { accepted } = checkReading(offer, {
			requirements: [
				{
					competence: "agents",
					importance: "required",
					quote: "Developper   les «tools» et API",
				},
			],
		});
		expect(accepted).toHaveLength(1);
	});

	it("moves a line to software engineering when its quote does not name the language", () => {
		const text = "Des scripts de test en Python et FastAPI sont un plus.";
		const { accepted, corrected, rejected } = checkReading(text, {
			requirements: [
				{
					competence: "python",
					importance: "preferred",
					quote: "scripts de test",
				},
				{
					competence: "python",
					importance: "preferred",
					quote: "en Python et FastAPI",
				},
			],
		});
		expect(rejected).toEqual([]);
		expect(corrected).toEqual([
			{ quote: "scripts de test", from: "python", to: "production" },
		]);
		expect(accepted.map((r) => r.competence)).toEqual(["production", "python"]);
	});

	it("accepts a quote that skips a few words, and refuses words the offer lacks", () => {
		const text =
			"Une veille constante sur les modèles de langage et les techniques les plus avancées.";
		expect(quotes(text, "modèles de langage les plus avancées")).toBe(true);
		expect(quotes(text, "modèles de langage les plus récents")).toBe(false);
		expect(quotes(text, "veille constante les plus avancées")).toBe(false);
	});

	it("rejects a quote too short to prove anything", () => {
		const { rejected } = checkReading(offer, {
			requirements: [{ competence: "llm", importance: "required", quote: "a" }],
		});
		expect(rejected[0]?.reason).toBe("quote-too-short");
	});
});

describe("the order", () => {
	it("weighs required skills fully, preferred ones less, and not-required ones not at all", () => {
		const demand = demandFromRequirements([
			{ competence: "agents", importance: "required", quote: "q1" },
			{ competence: "llm", importance: "preferred", quote: "q2" },
			{ competence: "python", importance: "not-required", quote: "q3" },
		]);
		expect(demand.map((d) => d.competence)).toEqual(["agents", "llm"]);
		// Agents: base 3, required. LLM: base 2, preferred (0.6).
		expect(demand[0]?.weight).toBe(3);
		expect(demand[1]?.weight).toBe(1.2);
	});

	it("matches only checked lines, and lists what the house does not cook", () => {
		const result = orderFromReading(offer, reading, projects);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const { order } = result;
		expect(order.source).toBe("model");
		expect(order.demand.map((d) => d.competence)).toEqual([
			"agents",
			"evaluation",
		]);
		expect(order.matches[0]?.project).toBe("agents-project");
		expect(order.outside).toEqual(["connaissances en comptabilité"]);
		expect(order.rejected).toHaveLength(1);
		expect(order.lines).toBe(4);
	});

	it("refuses an order with no checked skill", () => {
		const result = orderFromReading(
			offer,
			{
				requirements: [
					{
						competence: "rag",
						importance: "required",
						quote: "pas dans l'offre",
					},
				],
			},
			projects,
		);
		expect(result).toMatchObject({ ok: false, reason: "no-skill" });
	});

	it("falls back on the lexicon with the same shape", () => {
		const result = orderFromLexicon(offer, projects);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.order.source).toBe("lexicon");
		expect(result.order.demand.length).toBeGreaterThan(0);
	});
});
