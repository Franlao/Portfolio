import { describe, expect, it } from "vitest";
import { defaultFile } from "../../../components/demos/claims-agent/engine";
import { rushCases } from "../rush";
import { notebookCopy } from "./copy";
import { recipe } from "./recipe";

describe("the agent's recipe", () => {
	it("cooks every claim of the pass as the rules expect, and files it", () => {
		for (const rushCase of rushCases) {
			for (const lang of ["fr", "en"] as const) {
				const r = recipe(rushCase.file, lang);
				expect(r.outcome, rushCase.id).toBe(rushCase.expected);
				expect(r.steps.at(-1)?.node).toBe("register");
				expect(r.steps.every((step) => step.title.length > 0)).toBe(true);
			}
		}
	});

	it("shows what the model wrote, and checks it against a schema", () => {
		const r = recipe(defaultFile, "fr");
		const model = r.steps.filter((step) => step.kind === "model");
		expect(model.map((step) => step.node)).toEqual([
			"classification",
			"circumstances",
			"offer",
		]);
		for (const step of model) {
			expect(step.written.length).toBeGreaterThan(0);
			expect(step.valid).toBe(true);
		}
		const circumstances = r.steps.find((s) => s.node === "circumstances");
		expect(circumstances?.quote?.text).toBeTruthy();
	});

	it("marks the checks that decided a hand-over", () => {
		const storm = rushCases.find((c) => c.id === "storm");
		const ceiling = rushCases.find((c) => c.id === "ceiling");
		if (!storm || !ceiling) throw new Error("missing cases");
		expect(recipe(storm.file, "en").failed).toContain("exclusion");
		expect(recipe(ceiling.file, "en").failed).toEqual(["ceiling"]);
		const escalation = recipe(ceiling.file, "en").steps.find(
			(step) => step.node === "escalation",
		);
		expect(escalation?.list).toHaveLength(1);
	});

	it("does not open a claim without its form: it asks for it", () => {
		const r = recipe({ ...defaultFile, pieces: ["photos", "quote"] }, "fr");
		expect(r.steps.map((step) => step.node)).toEqual([
			"reception",
			"missing",
			"register",
		]);
		expect(r.outcome).toBe("missing");
		expect(r.failed).toEqual([]);
	});

	it("names every outcome in both languages", () => {
		for (const lang of ["fr", "en"] as const)
			for (const outcome of ["offer", "missing", "escalation"] as const)
				expect(notebookCopy[lang].outcome[outcome]).toBeTruthy();
	});
});
