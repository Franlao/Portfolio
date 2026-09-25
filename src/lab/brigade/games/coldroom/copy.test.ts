import { describe, expect, it } from "vitest";
import type { Lang } from "../types";
import { COPY, en, fr } from "./copy";
import { game } from "./game";
import { endTexts } from "./logic";
import { CASES, REPORTS } from "./reports";

const LANGS: readonly Lang[] = ["fr", "en"];
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);

/** The structure of a value without its words: keys, array lengths, function arities. */
function shape(value: unknown): unknown {
	if (typeof value === "function") return `function/${value.length}`;
	if (Array.isArray(value)) return value.map(shape);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, shape(entry)]),
		);
	}
	return typeof value;
}

/** Every string a copy can show, sentence builders called with sample arguments. */
function strings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (typeof value === "function") return strings(value(2, 5, "x"));
	if (Array.isArray(value)) return value.flatMap(strings);
	if (value && typeof value === "object") {
		return Object.values(value).flatMap(strings);
	}
	return [];
}

describe("rien ne sort : the copy", () => {
	it("has the same keys in French and in English, all the way down", () => {
		expect(shape(COPY.en)).toEqual(shape(COPY.fr));
	});

	it.each(CASES.map((report) => [report.id, report] as const))(
		"writes report %s with the same shape in both languages",
		(_, report) => {
			expect(shape(report.text.en)).toEqual(shape(report.text.fr));
		},
	);

	it("quotes with « » in French and “ ” in English, never the other way", () => {
		const french = strings(COPY.fr).join("\n");
		const english = strings(COPY.en).join("\n");
		expect(french).toContain("«");
		expect(french).not.toMatch(/[“”]/);
		expect(english).toContain("“");
		expect(english).not.toMatch(/[«»]/);
	});

	it.each(LANGS)(
		"keeps the chef's bubbles under 30 characters (%s)",
		(lang) => {
			const bubbles = [
				...strings(COPY[lang].chef),
				...REPORTS[lang].map(
					(report) => endTexts(report, [], 30, false, 0).chef,
				),
			];
			for (const bubble of bubbles) {
				expect(bubble.length, bubble).toBeLessThan(30);
			}
		},
	);

	it("formats numbers and confidences for each language", () => {
		expect(COPY.en.number(1842)).toBe("1,842");
		expect(COPY.en.percent(0.44)).toBe("44%");
		expect(COPY.fr.number(1842)).toBe(`1${NARROW_NBSP}842`);
		expect(COPY.fr.percent(0.44)).toBe("44 %");
	});

	it("gives the panel a typographed title and intro in both languages", () => {
		expect(game.title).toEqual({
			fr: "Rien ne sort",
			en: "Nothing gets out",
		});
		expect(game.intro.fr).toBe(fr(COPY.fr.intro));
		expect(game.intro.en).toBe(COPY.en.intro);
	});
});

describe("rien ne sort : typography", () => {
	it("keeps French units and numbers together", () => {
		expect(fr("500 mg matin")).toBe(`500${NBSP}mg matin`);
		expect(fr("1 g × 3")).toBe(`1${NBSP}g${NBSP}×${NBSP}3`);
		expect(fr("patient n° 0417")).toBe(`patient n°${NBSP}0417`);
		expect(fr("1 842 octets")).toContain(`842${NBSP}octets`);
	});

	it("keeps English units together, without French punctuation spacing", () => {
		expect(en("500 mg twice daily")).toBe(`500${NBSP}mg twice daily`);
		expect(en("patient no. 0417")).toBe(`patient no.${NBSP}0417`);
		expect(en("report · 1,842 bytes")).toBe(`report · 1,842${NBSP}bytes`);
		expect(en("Next field: admission date. Right!")).toBe(
			"Next field: admission date. Right!",
		);
	});
});
