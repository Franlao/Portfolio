import { describe, expect, it } from "vitest";
import { Bill } from "./bill";

describe("the bill", () => {
	it("keeps every distinct order, in order", () => {
		const bill = new Bill();
		bill.add({ kind: "order", label: "AI Engineer agentique" });
		bill.add({ kind: "order", label: "Votre offre (848 mots)" });
		bill.add({ kind: "order", label: "AI Engineer agentique" });
		expect(bill.lines.map((l) => l.kind === "order" && l.label)).toEqual([
			"AI Engineer agentique",
			"Votre offre (848 mots)",
		]);
	});

	it("lists a station once, and a played game replaces a visit", () => {
		const bill = new Bill();
		bill.add({ kind: "visit", station: "library" });
		bill.add({ kind: "visit", station: "library" });
		bill.add({ kind: "visit", station: "pass" });
		bill.add({ kind: "play", station: "library" });
		bill.add({ kind: "visit", station: "library" });
		expect(bill.lines).toEqual([
			{ kind: "play", station: "library" },
			{ kind: "visit", station: "pass" },
		]);
		expect(bill.size).toBe(2);
	});
});
