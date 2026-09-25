import { describe, expect, it } from "vitest";
import type { Lang } from "../../../i18n/ui";
import { competenceIds } from "../../../lib/offer/competences";
import { prologueCopy } from "../prologue/copy";
import { announcement, CALLED } from "./announce";
import { cast } from "./cast";
import { heardAs, passes } from "./check";
import { voiceCopy } from "./copy";
import { script } from "./script";
import { lineKey, type Manifest, STREET_VOICES } from "./speakers";

const langs: Lang[] = ["fr", "en"];

/** Every path to a leaf, sorted. */
function paths(value: unknown, prefix = ""): string[] {
	if (value === null || typeof value !== "object") return [prefix];
	return Object.entries(value)
		.flatMap(([key, entry]) => paths(entry, prefix ? `${prefix}.${key}` : key))
		.sort();
}

describe("voice copy", () => {
	it("has the same keys in French and English", () => {
		expect(paths({ ...voiceCopy.en, street: null })).toEqual(
			paths({ ...voiceCopy.fr, street: null }),
		);
	});

	it("has a call for every skill, short enough for a bubble", () => {
		for (const lang of langs) {
			for (const id of competenceIds) {
				const call = voiceCopy[lang].call.skills[id];
				expect(call, `${lang} ${id}`).toBeTruthy();
				expect(call.length, `${lang} ${id}`).toBeLessThan(30);
			}
		}
	});

	it("gives the chef a speech for every card of his welcome and every step of the first order", () => {
		for (const lang of langs) {
			const { tour, narration } = voiceCopy[lang].spoken;
			const written = prologueCopy[lang];
			expect(tour).toHaveLength(written.tour.steps.length);
			expect(narration.model).toHaveLength(written.narration.model.length);
			expect(narration.steps).toHaveLength(written.narration.steps.length);
		}
	});

	it("gives every line of the street a voice", () => {
		for (const lang of langs) {
			voiceCopy[lang].street.forEach((exchange, i) => {
				expect(STREET_VOICES[lang][i]).toHaveLength(exchange.length);
			});
		}
	});
});

describe("line keys", () => {
	it("ignore French typography and curly apostrophes", () => {
		expect(lineKey("chef", "Ça marche !")).toBe(lineKey("chef", "Ça marche !"));
		expect(lineKey("chef", "L’addition ?")).toBe(
			lineKey("chef", "L'addition ?"),
		);
		expect(lineKey("chef", "Oui chef !")).not.toBe(
			lineKey("cook", "Oui chef !"),
		);
	});
});

describe("the check of a recording", () => {
	it("refuses a French line said with an English accent", () => {
		expect(passes("Oui chef !", "We Chef", "fr")).toBe(false);
		expect(passes("Ça marche !", "Samache", "fr")).toBe(false);
	});

	it("accepts what was said, whatever the punctuation", () => {
		expect(passes("Oui chef !", "Oui, chef !", "fr")).toBe(true);
		expect(passes("Du rag !", "du rag", "fr")).toBe(true);
		expect(passes("De la R et D !", "De la R&D.", "fr")).toBe(true);
		expect(passes("R and D!", "R&D", "en")).toBe(true);
	});

	it("refuses a swallowed half sentence", () => {
		const said =
			"Le chef vérifie que chaque ligne du bon cite bien votre offre. Seules les lignes vérifiées comptent.";
		expect(
			heardAs(said, "Le chef vérifie que chaque ligne", "fr"),
		).toBeLessThan(0.5);
		expect(passes(said, "Le chef vérifie que chaque ligne", "fr")).toBe(false);
	});
});

describe("the chef's call", () => {
	const demand = competenceIds.slice(0, 6).map((competence, i) => ({
		competence,
		count: 1,
		weight: 6 - i,
	}));

	it("names the table, then the heaviest skills, with their ticket lines", () => {
		const calls = announcement(demand, voiceCopy.fr.call);
		expect(calls[0]).toEqual({ text: voiceCopy.fr.call.table, line: null });
		expect(calls).toHaveLength(1 + CALLED);
		expect(calls.slice(1).map((call) => call.line)).toEqual([0, 1, 2, 3]);
		expect(calls[1].text).toBe(voiceCopy.fr.call.skills[demand[0].competence]);
	});

	it("only says recorded lines, whatever the offer", () => {
		for (const lang of langs) {
			const recorded = new Set(
				script(lang).map((line) => lineKey(line.speaker, line.text)),
			);
			const all = competenceIds.map((competence) => ({
				competence,
				count: 1,
				weight: 1,
			}));
			for (let start = 0; start < all.length; start += CALLED) {
				for (const call of announcement(all.slice(start), voiceCopy[lang].call))
					expect(recorded.has(lineKey("chef", call.text)), call.text).toBe(
						true,
					);
			}
		}
	});
});

describe("the recording script", () => {
	it("casts every line", () => {
		for (const lang of langs) {
			for (const line of script(lang))
				expect(
					cast[lang][line.speaker][line.mood].length,
					`${lang} ${line.speaker}`,
				).toBeGreaterThan(0);
		}
	});

	it("has a recorded clip for every line: run npm run voices after changing a text", () => {
		const manifests = import.meta.glob<Manifest>(
			"/public/voices/*/manifest.json",
			{ eager: true, import: "default" },
		);
		// Listed, not loaded.
		const clips = new Set(
			Object.keys(import.meta.glob("/public/voices/*/*.mp3")),
		);
		for (const lang of langs) {
			const manifest = manifests[`/public/voices/${lang}/manifest.json`];
			expect(manifest, lang).toBeDefined();
			for (const line of script(lang)) {
				const key = lineKey(line.speaker, line.text);
				const clip = manifest[key];
				expect(clip, `${lang} ${key}`).toBeDefined();
				expect(
					clips.has(`/public/voices/${lang}/${clip.file}`),
					clip.file,
				).toBe(true);
			}
		}
	});
});
