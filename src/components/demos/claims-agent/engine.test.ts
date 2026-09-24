import { describe, expect, it } from "vitest";
import { type ClaimFile, defaultFile, run } from "./engine";

const withFile = (patch: Partial<ClaimFile>): ClaimFile => ({
	...defaultFile,
	...patch,
});

describe("claims agent", () => {
	it("sends an offer for a complete, clear claim", () => {
		const result = run(defaultFile, "fr");
		expect(result.outcome).toBe("offer");
		expect(result.path).toEqual([
			"reception",
			"classification",
			"coverage",
			"circumstances",
			"consistency",
			"offer",
			"register",
		]);
		const offer = result.traces.find((t) => t.node === "offer")?.output as {
			amount: number;
		};
		expect(offer.amount).toBe(4200 - 300);
	});

	it("validates every step output against its schema", () => {
		for (const circumstance of ["reversing", "storm", "disputed"] as const) {
			const result = run(withFile({ circumstance }), "en");
			expect(
				result.traces.every((t) => t.valid),
				circumstance,
			).toBe(true);
		}
	});

	it("stops at intake without a claim form", () => {
		const result = run(withFile({ pieces: ["photos", "quote"] }), "fr");
		expect(result.path).toEqual(["reception", "missing", "register"]);
		expect(result.outcome).toBe("missing");
	});

	it("requests the repair quote when it is missing", () => {
		const result = run(withFile({ pieces: ["declaration", "photos"] }), "fr");
		expect(result.outcome).toBe("missing");
		const request = result.traces.find((t) => t.node === "missing")?.output as {
			request: string[];
		};
		expect(request.request).toEqual(["quote"]);
	});

	it("hands over late claims", () => {
		expect(run(withFile({ delayDays: 8 }), "fr").outcome).toBe("escalation");
	});

	it("hands over claims above the ceiling", () => {
		expect(run(withFile({ quoteAmount: 20000 }), "fr").outcome).toBe(
			"escalation",
		);
	});

	it("hands over a possible weather exclusion", () => {
		expect(run(withFile({ circumstance: "storm" }), "fr").outcome).toBe(
			"escalation",
		);
	});

	it("asks for the third-party statement when the account is disputed", () => {
		const result = run(withFile({ circumstance: "disputed" }), "fr");
		expect(result.outcome).toBe("missing");
		const request = result.traces.find((t) => t.node === "missing")?.output as {
			request: string[];
		};
		expect(request.request).toEqual(["statement"]);
	});

	it("shares liability once the statement is received", () => {
		const result = run(
			withFile({
				circumstance: "disputed",
				pieces: ["declaration", "photos", "quote", "statement"],
			}),
			"en",
		);
		expect(result.outcome).toBe("offer");
		const offer = result.traces.find((t) => t.node === "offer")?.output as {
			amount: number;
		};
		expect(offer.amount).toBe(4200 * 0.5 - 300);
	});

	it("numbers every received document in the register", () => {
		const result = run(defaultFile, "fr");
		const register = result.traces.at(-1);
		if (!register) throw new Error("empty run");
		expect(register.node).toBe("register");
		expect((register.output as { entries: unknown[] }).entries).toHaveLength(3);
	});
});
