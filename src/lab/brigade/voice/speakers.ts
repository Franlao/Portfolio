import type { Lang } from "../../../i18n/ui";

/** Everyone who speaks. The visitor never does: everyone speaks to them. */
export type Speaker =
	| "chef"
	| "host"
	| "runner"
	| "cook"
	| "street-a"
	| "street-b"
	| "street-c"
	| "street-d"
	| "tourist";

/**
 * Who says each exchange of voiceCopy.street, line by line. Two voices per exchange:
 * a question on the terrace, the answer from the next table.
 */
export const STREET_VOICES: Record<Lang, Speaker[][]> = {
	fr: [
		["street-a", "street-b"],
		["street-c", "street-d"],
		["street-b"],
		["street-d", "street-a"],
	],
	en: [
		["street-a", "street-b"],
		["street-c", "street-d"],
		["street-b"],
		["tourist", "street-a"],
	],
};

/** A recorded clip: its file, its length and its loudness, for the balloons and the heads. */
export interface Clip {
	file: string;
	seconds: number;
	/** Loudness every 40 ms, one digit from 0 to 9. */
	env: string;
}

/** Clips of one language, by lineKey. */
export type Manifest = Record<string, Clip>;

/** The loudness envelope's step, in seconds. */
export const ENVELOPE_STEP = 0.04;

/**
 * Texts reach the voices typeset (French spaces, curly apostrophes): the key ignores
 * typography, so a line is found however it was written.
 */
export function normalizeLine(text: string): string {
	return text
		.normalize("NFC")
		.replace(/[   ]/g, " ")
		.replace(/[’‘]/g, "'")
		.replace(/[“”«»]/g, '"')
		.replace(/…/g, "...")
		.replace(/\s+/g, " ")
		.trim();
}

/** The clip that says `text` in `speaker`'s voice. */
export function lineKey(speaker: Speaker, text: string): string {
	return `${speaker}|${normalizeLine(text)}`;
}
