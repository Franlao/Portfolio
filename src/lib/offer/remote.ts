import { countWords, MIN_WORDS, type ProjectProfile } from "./engine";
import {
	type OrderResult,
	orderFromLexicon,
	orderFromReading,
	ReadingSchema,
} from "./reader";

/**
 * Reads an offer in the browser: the language model first (through /api/read-offer),
 * the lexicon if the model is slow, down or out of quota. The page never breaks, it
 * only reads less finely.
 */
export async function readOffer(
	text: string,
	projects: ProjectProfile[],
	timeoutMs = 13_000,
): Promise<OrderResult> {
	const words = countWords(text);
	if (words < MIN_WORDS) return { ok: false, reason: "too-short", words };
	const byLexicon = () => orderFromLexicon(text, projects);
	try {
		const response = await fetch("/api/read-offer", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!response.ok) return byLexicon();
		const data = (await response.json()) as { reading?: unknown };
		const reading = ReadingSchema.safeParse(data.reading);
		if (!reading.success) return byLexicon();
		const result = orderFromReading(text, reading.data, projects);
		// Nothing the model found survived the check: the lexicon gets its chance.
		return result.ok ? result : byLexicon();
	} catch {
		return byLexicon();
	}
}
