import type { Lang } from "../../../i18n/ui";
import { copy } from "../copy";
import { COPY as coldroom } from "../games/coldroom/copy";
import { copy as delivery } from "../games/delivery/copy";
import { copy as library } from "../games/library/copy";
import { copies as pastry } from "../games/pastry/copy";
import { copy as tools } from "../games/tools/copy";
import { prologueCopy } from "../prologue/copy";
import { voiceCopy } from "./copy";
import {
	lineKey,
	normalizeLine,
	type Speaker,
	STREET_VOICES,
} from "./speakers";

/**
 * The recording script: every line a voice says, taken from the page's own copy, so the
 * voice and the text can never disagree. `npm run voices` records what changed.
 * Only this generator reads the script; the page reads the manifest it writes.
 */

/** How a line is said. The cast turns it into a voice: see cast.ts. */
export type Mood = "warm" | "calm" | "call" | "cross";

export interface Line {
	speaker: Speaker;
	/** The text as the page shows it: the clip is found by it. */
	text: string;
	/** What the voice reads when the written form would be misread (acronyms). */
	say?: string;
	mood: Mood;
}

/** Acronyms the voices would spell or stumble on, written as they are said. */
const SPOKEN: Record<Lang, [RegExp, string][]> = {
	fr: [
		[/\bRAG\b/g, "rag"],
		[/R&D/g, "R et D"],
	],
	en: [
		[/\bRAG\b/g, "rag"],
		[/R&D/g, "R and D"],
	],
};

/**
 * Calls so short the French chef's voice swallows them (the check heard « No » for
 * « Non ! »): he says them a little longer. The bubble keeps the short form.
 */
const LONGER: Record<Lang, Record<string, string>> = {
	fr: {
		"Non !": "Non, non !",
		"Trop sage !": "C'est trop sage !",
		"Fournée servie !": "La fournée est servie !",
	},
	en: {},
};

function spoken(lang: Lang, text: string): string | undefined {
	const longer = LONGER[lang][normalizeLine(text)];
	if (longer) return longer;
	let said = text;
	for (const [pattern, replacement] of SPOKEN[lang])
		said = said.replace(pattern, replacement);
	return said === text ? undefined : said;
}

/**
 * The chef's lines in the games: every string under a key named chef, say or shout…,
 * as games/BRIEF.md asks. Lines built by a function (a score, a letter) stay silent.
 */
function shouts(value: unknown, underShout = false): string[] {
	if (typeof value === "string") return underShout ? [value] : [];
	if (!value || typeof value !== "object") return [];
	return Object.entries(value).flatMap(([key, entry]) =>
		shouts(entry, underShout || /^(chef|say|shout)/.test(key)),
	);
}

export function script(lang: Lang): Line[] {
	const t = copy[lang];
	const prologue = prologueCopy[lang];
	const voice = voiceCopy[lang];
	const lines: Line[] = [];
	const add = (speaker: Speaker, text: string, mood: Mood) =>
		lines.push({ speaker, text, mood, say: spoken(lang, text) });

	// The street: the maître d', and the terrace.
	for (const text of Object.values(voice.spoken.host))
		add("host", text, "warm");
	voice.street.forEach((exchange, i) => {
		exchange.forEach((text, j) => {
			const speaker = STREET_VOICES[lang][i]?.[j];
			if (text && speaker) add(speaker, text, "warm");
		});
	});

	// The chef's welcome, spoken to the visitor at the chef's table.
	for (const text of voice.spoken.tour) add("chef", text, "warm");
	add("chef", prologue.bubbles.order, "warm");

	// The first order, explained as it cooks: kitchen words, quietly, to the visitor.
	const { narration } = voice.spoken;
	for (const text of [...narration.model, ...narration.steps])
		add("chef", text, "calm");

	// The chef's notebook, read aloud at the pass.
	const { notebook } = voice;
	for (const text of [
		notebook.open,
		...Object.values(notebook.nodes),
		notebook.same,
		notebook.different,
	])
		add("chef", text, "calm");

	// The service: the chef calls the order, the brigade answers.
	add("chef", t.bubbles.coming, "call");
	add("chef", voice.call.table, "call");
	for (const text of Object.values(voice.call.skills))
		add("chef", text, "call");
	add("runner", t.bubbles.yes, "call");
	add("cook", t.bubbles.yes, "call");
	add("cook", t.bubbles.heat, "call");
	add("chef", t.bubbles.service, "call");
	add("chef", t.bubbles.nothing, "cross");
	add("chef", t.bubbles.invite, "warm");
	add("chef", t.bubbles.bill, "warm");

	// The pass, and the games.
	add("chef", t.bubbles.rushStart, "call");
	add("chef", t.bubbles.rushEnd, "call");
	add("chef", t.bubbles.right, "warm");
	add("chef", t.bubbles.wrong, "cross");
	for (const game of [delivery, library, coldroom, pastry, tools])
		for (const text of shouts(game[lang])) add("chef", text, "call");

	// One clip per line: the same words from the same person are recorded once.
	const seen = new Set<string>();
	return lines.filter((line) => {
		const key = lineKey(line.speaker, line.text);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
