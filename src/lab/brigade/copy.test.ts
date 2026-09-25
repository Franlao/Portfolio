import { describe, expect, it } from "vitest";
import { copy, verdictReasons } from "./copy";

/** Every path to a leaf, e.g. "rush.pieces.photos" or "rush.rules.0", sorted. */
function paths(value: unknown, prefix = ""): string[] {
	if (value === null || typeof value !== "object") return [prefix];
	return Object.entries(value)
		.flatMap(([key, entry]) => paths(entry, prefix ? `${prefix}.${key}` : key))
		.sort();
}

/** Every string leaf of an object, with its path. */
function strings(value: unknown, prefix = ""): [string, string][] {
	if (typeof value === "string") return [[prefix, value]];
	if (value === null || typeof value !== "object") return [];
	return Object.entries(value).flatMap(([key, entry]) =>
		strings(entry, prefix ? `${prefix}.${key}` : key),
	);
}

describe("brigade copy", () => {
	it("has exactly the same keys in French and English", () => {
		expect(paths(copy.en)).toEqual(paths(copy.fr));
		expect(paths(verdictReasons.en)).toEqual(paths(verdictReasons.fr));
	});

	it("keeps every speech bubble under 30 characters", () => {
		for (const lang of ["fr", "en"] as const) {
			for (const [key, text] of strings(copy[lang].bubbles)) {
				expect(text.length, `${lang} ${key}`).toBeLessThan(30);
			}
		}
	});

	it("applies French typography to French only", () => {
		expect(copy.fr.bubbles.coming).toBe("Ça marche !");
		expect(copy.fr.write.ticketTitle(40)).toBe("Votre offre (40 mots)");
		for (const [key, text] of strings(copy.en)) {
			expect(text, key).not.toMatch(/[  «»]| [:;?!]/);
		}
	});
});
