import { describe, expect, it } from "vitest";
import { projects } from "../../data/projects";
import { analyze, detect, normalizeWithMap, segment } from "./engine";
import { presets } from "./presets";

const preset = (id: string) => {
	const found = presets.find((p) => p.id === id);
	if (!found) throw new Error(`unknown preset ${id}`);
	return found;
};

describe("normalizeWithMap", () => {
	it("strips accents and keeps a map back to the source", () => {
		const { text, map } = normalizeWithMap("Traçabilité’s");
		expect(text).toBe("tracabilite's");
		expect(map[2]).toBe(2);
		expect(map.at(-1)).toBe("Traçabilité’s".length);
	});
});

describe("segment", () => {
	it("splits on lines and sentences and drops bullets", () => {
		const segments = segment(
			"Première phrase. Deuxième phrase.\n- Une puce\n\n• Une autre",
		);
		expect(segments.map((s) => s.text)).toEqual([
			"Première phrase.",
			"Deuxième phrase.",
			"Une puce",
			"Une autre",
		]);
	});
});

describe("detect", () => {
	it("quotes the exact words of the offer, accents included", () => {
		const evidence = detect(
			segment("Vous garantirez la traçabilité des décisions."),
		);
		const audit = evidence.find((e) => e.competence === "evaluation");
		expect(audit?.quote).toBe("traçabilité");
	});

	it("matches whole words only", () => {
		const evidence = detect(segment("Our paragraph mentions a dragon."));
		expect(evidence.some((e) => e.competence === "rag")).toBe(false);
	});

	it("accepts a plural form", () => {
		const evidence = detect(segment("You will build agents."));
		expect(evidence.find((e) => e.competence === "agents")?.quote).toBe(
			"agents",
		);
	});
});

describe("analyze", () => {
	it("refuses a text that is too short", () => {
		expect(analyze("Python et RAG", projects)).toMatchObject({
			ok: false,
			reason: "too-short",
		});
	});

	it("reports when no skill is recognised", () => {
		const text =
			"Nous cherchons une personne souriante pour accueillir la clientèle du magasin ".repeat(
				3,
			);
		expect(analyze(text, projects)).toMatchObject({
			ok: false,
			reason: "no-skill",
		});
	});

	it("validates every step output against its schema", () => {
		const result = analyze(preset("agentic").text.fr, projects);
		if (!result.ok) throw new Error("analysis failed");
		expect(result.steps.every((s) => s.valid)).toBe(true);
	});

	it.each([
		["agentic", "claims-agent"],
		["rag", "multimodal-rag"],
		["health", "clinical-extraction"],
		["insurance", "claims-agent"],
	])("ranks the right project first for the %s preset", (id, expected) => {
		for (const lang of ["fr", "en"] as const) {
			const result = analyze(preset(id).text[lang], projects);
			if (!result.ok) throw new Error(`analysis failed for ${id}/${lang}`);
			expect(result.matches[0].project, `${id}/${lang}`).toBe(expected);
		}
	});

	it("keeps coverage between 0 and 1, best first", () => {
		const result = analyze(preset("rag").text.en, projects);
		if (!result.ok) throw new Error("analysis failed");
		const coverages = result.matches.map((m) => m.coverage);
		expect(coverages).toEqual([...coverages].sort((a, b) => b - a));
		expect(Math.max(...coverages)).toBeLessThanOrEqual(1);
	});
});
