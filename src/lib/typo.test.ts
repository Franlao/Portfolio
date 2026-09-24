import { describe, expect, it } from "vitest";
import { frTypo } from "./typo";

const NBSP = String.fromCharCode(0x00a0);
const NARROW = String.fromCharCode(0x202f);

describe("frTypo", () => {
	it("keeps high punctuation on the same line", () => {
		expect(frTypo("Service : prêt ?")).toBe(`Service${NBSP}: prêt${NARROW}?`);
	});

	it("keeps guillemets with their quote", () => {
		expect(frTypo("« Oui chef »")).toBe(`«${NARROW}Oui chef${NARROW}»`);
	});

	it("groups thousands and ties numbers to their unit", () => {
		expect(frTypo("Plafond de 15 000 €, sous 5 jours")).toBe(
			`Plafond de 15${NARROW}000${NBSP}€, sous 5${NBSP}jours`,
		);
	});

	it("ties an hour to its unit", () => {
		expect(frTypo("vendredi à 18 h")).toBe(`vendredi à 18${NBSP}h`);
	});

	it("leaves unrelated numbers alone", () => {
		expect(frTypo("Les 3 postes et 12 cuisiniers")).toBe(
			"Les 3 postes et 12 cuisiniers",
		);
	});
});
