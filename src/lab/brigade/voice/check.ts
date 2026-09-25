import type { Lang } from "../../../i18n/ui";

/**
 * The red pencil, for voices: each recording is transcribed back by a speech-to-text
 * model and compared with the script. A voice that says « We chef » instead of
 * « Oui chef », or swallows half a sentence, does not make it to the page.
 */

/** Lines this similar to the script pass. Short lines leave less room for error. */
export const PASS = { long: 0.8, short: 0.86 } as const;

const AND: Record<Lang, string> = { fr: " et ", en: " and " };

/** Letters and digits only, lower case, without accents: what a transcript is compared on. */
export function letters(text: string, lang: Lang): string {
	return text
		.replace(/&/g, AND[lang])
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, "");
}

function distance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			row[j] = Math.min(
				previous[j] + 1,
				row[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = row;
	}
	return previous[b.length];
}

/** How close what the model heard is to what the script says, from 0 to 1. */
export function heardAs(expected: string, heard: string, lang: Lang): number {
	const a = letters(expected, lang);
	const b = letters(heard, lang);
	if (!a.length || !b.length) return 0;
	return 1 - distance(a, b) / Math.max(a.length, b.length);
}

/** Whether a recording passes the check. */
export function passes(expected: string, heard: string, lang: Lang): boolean {
	const threshold =
		letters(expected, lang).length < 12 ? PASS.short : PASS.long;
	return heardAs(expected, heard, lang) >= threshold;
}
