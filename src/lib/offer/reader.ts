import { z } from "zod";
import { type CompetenceId, competenceIds, competences } from "./competences";
import {
	analyze,
	countWords,
	type Demand,
	demandWeight,
	detect,
	type Match,
	MIN_WORDS,
	match,
	normalize,
	type ProjectProfile,
	summarize,
} from "./engine";

/**
 * Reading a job offer with a language model, then checking it with code.
 *
 * The model does what the lexicon cannot: synonyms, context, « not required ». It must
 * map every requirement to one skill of a closed list and back it with an exact quote
 * of the offer. The code then checks each quote word for word: a line the model made up
 * is sent back. Only checked lines reach the matching, which stays deterministic.
 * Nothing the model writes freely is ever shown: only skill ids and verified quotes.
 */

export const IMPORTANCE = ["required", "preferred", "not-required"] as const;
export type Importance = (typeof IMPORTANCE)[number];
/** A requirement that fits none of the skills, such as a business domain. */
export const OTHER = "other";

const ReadCompetence = z.enum([...competenceIds, OTHER]);

export const RequirementSchema = z.object({
	competence: ReadCompetence,
	importance: z.enum(IMPORTANCE),
	quote: z.string().min(1).max(300),
});
export const ReadingSchema = z.object({
	requirements: z.array(RequirementSchema).max(40),
});
export type Requirement = z.infer<typeof RequirementSchema>;
export type Reading = z.infer<typeof ReadingSchema>;

/** The same contract, as the JSON schema the model's output is constrained to. */
export const readingJsonSchema = {
	type: "object",
	additionalProperties: false,
	required: ["requirements"],
	properties: {
		requirements: {
			type: "array",
			maxItems: 30,
			items: {
				type: "object",
				additionalProperties: false,
				required: ["competence", "importance", "quote"],
				properties: {
					competence: { type: "string", enum: [...competenceIds, OTHER] },
					importance: { type: "string", enum: [...IMPORTANCE] },
					quote: { type: "string" },
				},
			},
		},
	},
} as const;

/** Instructions for the model. The skills are listed with a few of the lexicon's terms. */
export function readingPrompt(): string {
	const skills = competences
		.map(
			(c) =>
				`- ${c.id}: ${c.label.en} (e.g. ${c.terms.slice(0, 6).join(", ")})`,
		)
		.join("\n");
	return `You read a job offer for an AI or data role, in French or English, and list what it asks of the candidate.

Map each requirement to exactly one skill id of this closed list:
${skills}
- ${OTHER}: a requirement that fits none of the skills above, such as a business domain (accounting, finance…) or a tool of the company.

Rules for the skills:
- The only business domains of the list are health (healthcare, hospitals, medical data), insurance and industry (manufacturing, automotive, engineering). Any other domain (accounting, finance, fintech, retail…) and any company context (startup, entrepreneurship) is ${OTHER}. Never force a requirement into a skill it does not name.
- python and typescript only when the offer names the language or one of its libraries. General software skills (development, APIs, JSON, Git, scripts, tests, automation) are production, which covers software engineering as a whole.

For each requirement give:
- competence: the skill id;
- importance: "required" when the job or the profile asks for it; "preferred" when the offer calls it a plus, an asset or appreciated (« un plus », « un atout », « apprécié », "nice to have"); "not-required" only when the offer says in so many words that a skill is not needed; most offers never do, and then no requirement is "not-required". Something appreciated is never "not-required".
- quote: a short excerpt of the offer, 2 to 12 words, copied character for character: the same words, in the same order and the same form. Shorten only by cutting at the start or the end, never in the middle. Never paraphrase, never translate, never join two passages.

List each distinct requirement once. Ignore the company presentation, perks, salary, location and interview process. At most 30 requirements.`;
}

/** Case, accents, quote marks and spacing do not count when comparing a quote to the offer. */
function canonical(text: string): string {
	return normalize(text)
		.replace(/[«»“”„"]/g, '"')
		.replace(/…/g, "...")
		.replace(/\s+/g, " ")
		.trim();
}

export type RejectReason = "quote-not-found" | "quote-too-short";

/** How many words of the offer a quote may skip: the model sometimes shortens a phrase. */
const SKIP_TOLERANCE = 4;

/** Words only: punctuation around a word (brackets, quote marks) does not count. */
const words = (text: string) =>
	text
		.replace(/[^\p{L}\p{N}'\s-]/gu, " ")
		.split(" ")
		.filter(Boolean);

/**
 * True when every word of the quote is in the offer, in the same order, with at most a
 * few words of the offer skipped in between. A made-up quote has words the offer lacks,
 * or scattered too far apart to be one passage.
 */
export function quotes(offer: string, quote: string): boolean {
	const text = words(canonical(offer));
	const wanted = words(canonical(quote));
	if (wanted.length === 0) return false;
	for (let start = 0; start < text.length; start++) {
		if (text[start] !== wanted[0]) continue;
		let at = start;
		let skipped = 0;
		let found = 1;
		while (found < wanted.length && at + 1 < text.length) {
			at++;
			if (text[at] === wanted[found]) found++;
			else if (++skipped > SKIP_TOLERANCE) break;
		}
		if (found === wanted.length) return true;
	}
	return false;
}

/**
 * Skills named after a language: if the quote does not name the language, the model
 * picked the wrong box, not a wrong requirement. APIs, tests or Git are the work of any
 * engineer, so the chef moves the line to software engineering.
 */
const NAMED_SKILLS: ReadonlySet<string> = new Set(["python", "typescript"]);
const GENERAL_SKILL: CompetenceId = "production";

function namesSkill(requirement: Requirement): boolean {
	return detect([{ id: 0, text: requirement.quote }]).some(
		(evidence) => evidence.competence === requirement.competence,
	);
}

export interface Correction {
	quote: string;
	from: CompetenceId;
	to: CompetenceId;
}

export interface Checked {
	accepted: Requirement[];
	/** Lines the model put in the wrong box: kept, in the right one. */
	corrected: Correction[];
	/** Lines whose quote is not in the offer: sent back, they do not count. */
	rejected: (Requirement & { reason: RejectReason })[];
}

/** The pass: every line must quote the offer, and sit in a box its quote supports. */
export function checkReading(offer: string, reading: Reading): Checked {
	const seen = new Set<string>();
	const accepted: Requirement[] = [];
	const corrected: Correction[] = [];
	const rejected: Checked["rejected"] = [];
	for (const requirement of reading.requirements) {
		const quote = canonical(requirement.quote);
		const key = `${requirement.competence}|${quote}`;
		if (seen.has(key)) continue;
		seen.add(key);
		if (quote.length < 2)
			rejected.push({ ...requirement, reason: "quote-too-short" });
		else if (!quotes(offer, requirement.quote))
			rejected.push({ ...requirement, reason: "quote-not-found" });
		else if (
			requirement.competence !== OTHER &&
			NAMED_SKILLS.has(requirement.competence) &&
			!namesSkill(requirement)
		) {
			corrected.push({
				quote: requirement.quote,
				from: requirement.competence,
				to: GENERAL_SKILL,
			});
			accepted.push({ ...requirement, competence: GENERAL_SKILL });
		} else accepted.push(requirement);
	}
	return { accepted, corrected, rejected };
}

/** How firmly each kind of requirement weighs in the order. */
const IMPORTANCE_FACTOR: Record<Importance, number> = {
	required: 1,
	preferred: 0.6,
	"not-required": 0,
};

export function demandFromRequirements(accepted: Requirement[]): Demand[] {
	const bySkill = new Map<CompetenceId, { count: number; factor: number }>();
	for (const r of accepted) {
		if (r.competence === OTHER) continue;
		const factor = IMPORTANCE_FACTOR[r.importance];
		if (factor === 0) continue;
		const entry = bySkill.get(r.competence) ?? { count: 0, factor: 0 };
		entry.count++;
		entry.factor = Math.max(entry.factor, factor);
		bySkill.set(r.competence, entry);
	}
	return [...bySkill.entries()]
		.map(([competence, { count, factor }]) => ({
			competence,
			count,
			weight: demandWeight(competence, count, factor),
		}))
		.sort((a, b) => b.weight - a.weight || b.count - a.count);
}

/** What the kitchen serves, whichever way the offer was read. */
export interface Order {
	/** « model »: read by the language model and checked; « lexicon »: read by the code alone. */
	source: "model" | "lexicon";
	words: number;
	demand: Demand[];
	matches: Match[];
	/** Lines of the order: skill mentions for the lexicon, checked requirements for the model. */
	lines: number;
	/** Lines the check moved to the right skill. */
	corrected: Correction[];
	/** Lines the check sent back. */
	rejected: Checked["rejected"];
	/** Verified quotes of requirements no skill of the house covers. */
	outside: string[];
	/** Skills asked for that no project covers well. */
	uncovered: CompetenceId[];
}

export type OrderResult =
	| { ok: true; order: Order }
	| { ok: false; reason: "too-short" | "no-skill"; words: number };

export function orderFromReading(
	offer: string,
	reading: Reading,
	projects: ProjectProfile[],
): OrderResult {
	const words = countWords(offer);
	const { accepted, corrected, rejected } = checkReading(offer, reading);
	const demand = demandFromRequirements(accepted);
	if (demand.length === 0) return { ok: false, reason: "no-skill", words };
	const matches = match(demand, projects);
	const summary = summarize(demand, matches, projects);
	const outside = accepted
		.filter((r) => r.competence === OTHER && r.importance !== "not-required")
		.map((r) => r.quote.trim());
	return {
		ok: true,
		order: {
			source: "model",
			words,
			demand,
			matches,
			lines: accepted.length,
			corrected,
			rejected,
			outside,
			uncovered: summary.uncovered,
		},
	};
}

/** The fallback: the deterministic lexicon, as before. */
export function orderFromLexicon(
	offer: string,
	projects: ProjectProfile[],
): OrderResult {
	const result = analyze(offer, projects);
	if (!result.ok) return result;
	return {
		ok: true,
		order: {
			source: "lexicon",
			words: result.words,
			demand: result.demand,
			matches: result.matches,
			lines: result.evidence.length,
			corrected: [],
			rejected: [],
			outside: [],
			uncovered: result.summary.uncovered,
		},
	};
}

export { MIN_WORDS };
