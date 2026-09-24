import { z } from "zod";
import {
	type CompetenceId,
	competenceById,
	competenceIds,
	competences,
} from "./competences";

export const MIN_WORDS = 20;
/** A project must reach this strength on a skill for the skill to count as covered. */
const COVERED_THRESHOLD = 0.3;
/** Repeating a skill in the offer raises its weight, capped so one skill cannot dominate. */
const REPEAT_BONUS = 0.25;
const REPEAT_CAP = 1.75;

const competenceId = z.enum(competenceIds);

export const SegmentSchema = z.object({
	id: z.number().int().nonnegative(),
	text: z.string().min(1),
});

export const EvidenceSchema = z.object({
	competence: competenceId,
	segment: z.number().int().nonnegative(),
	start: z.number().int().nonnegative(),
	end: z.number().int().positive(),
	quote: z.string().min(1),
});

export const DemandSchema = z.object({
	competence: competenceId,
	count: z.number().int().positive(),
	weight: z.number().positive(),
});

export const MatchSchema = z.object({
	project: z.string().min(1),
	coverage: z.number().min(0).max(1),
	matched: z.array(competenceId),
});

export const SummarySchema = z.object({
	lead: z.array(competenceId).max(3),
	best: z.string().nullable(),
	runnerUp: z.string().nullable(),
	uncovered: z.array(competenceId),
});

export type Segment = z.infer<typeof SegmentSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type Demand = z.infer<typeof DemandSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type Summary = z.infer<typeof SummarySchema>;

export interface ProjectProfile {
	slug: string;
	skills: Partial<Record<CompetenceId, number>>;
}

export type StepId = "segment" | "detect" | "match" | "summary";

export interface Step<Output> {
	id: StepId;
	input: unknown;
	output: Output;
	schema: string;
	valid: boolean;
}

export interface Analysis {
	ok: true;
	words: number;
	segments: Segment[];
	evidence: Evidence[];
	demand: Demand[];
	matches: Match[];
	summary: Summary;
	steps: [Step<Segment[]>, Step<Evidence[]>, Step<Match[]>, Step<Summary>];
}

export interface AnalysisError {
	ok: false;
	reason: "too-short" | "no-skill";
	words: number;
}

/** Lowercases and strips accents, keeping a map from each output index to the source index. */
export function normalizeWithMap(source: string): {
	text: string;
	map: number[];
} {
	let text = "";
	const map: number[] = [];
	for (let i = 0; i < source.length; i++) {
		let char = source[i];
		if (char === "’" || char === "‘" || char === "`") char = "'";
		const normalized = char
			.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.toLowerCase();
		for (const unit of normalized) {
			text += unit;
			map.push(i);
		}
	}
	map.push(source.length);
	return { text, map };
}

export function normalize(source: string): string {
	return normalizeWithMap(source).text;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function termPattern(term: string): string {
	const normalized = normalize(term);
	const escaped = escapeRegExp(normalized);
	return /[a-z]$/.test(normalized) && !normalized.endsWith("s")
		? `${escaped}s?`
		: escaped;
}

const matchers: ReadonlyArray<{ id: CompetenceId; pattern: RegExp }> =
	competences.map((c) => {
		const alternatives = [...c.terms]
			.sort((a, b) => b.length - a.length)
			.map(termPattern);
		return {
			id: c.id,
			pattern: new RegExp(
				`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`,
				"gu",
			),
		};
	});

export const lexiconSize = {
	competences: competences.length,
	terms: competences.reduce((total, c) => total + c.terms.length, 0),
};

export function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

export function segment(text: string): Segment[] {
	return text
		.replace(/\r/g, "")
		.split(/\n+|(?<=[.!?;])\s+(?=[\p{Lu}\p{N}•·*–—-])/u)
		.map((part) => part.replace(/^[\s•·*–—-]+/u, "").trim())
		.filter((part) => part.length > 0)
		.map((text, id) => ({ id, text }));
}

export function detect(segments: Segment[]): Evidence[] {
	const evidence: Evidence[] = [];
	for (const seg of segments) {
		const { text, map } = normalizeWithMap(seg.text);
		for (const { id, pattern } of matchers) {
			for (const found of text.matchAll(pattern)) {
				const index = found.index ?? 0;
				const start = map[index];
				const end = map[index + found[0].length - 1] + 1;
				evidence.push({
					competence: id,
					segment: seg.id,
					start,
					end,
					quote: seg.text.slice(start, end),
				});
			}
		}
	}
	return evidence.sort((a, b) => a.segment - b.segment || a.start - b.start);
}

export function toDemand(evidence: Evidence[]): Demand[] {
	const counts = new Map<CompetenceId, number>();
	for (const e of evidence)
		counts.set(e.competence, (counts.get(e.competence) ?? 0) + 1);
	return [...counts.entries()]
		.map(([competence, count]) => {
			const base = competenceById.get(competence)?.weight ?? 1;
			const repeat = Math.min(1 + REPEAT_BONUS * (count - 1), REPEAT_CAP);
			return { competence, count, weight: round(base * repeat) };
		})
		.sort((a, b) => b.weight - a.weight || b.count - a.count);
}

export function match(demand: Demand[], projects: ProjectProfile[]): Match[] {
	const total = demand.reduce((sum, d) => sum + d.weight, 0);
	return projects
		.map((project, order) => {
			const contributions = demand
				.map((d) => ({
					id: d.competence,
					value: d.weight * (project.skills[d.competence] ?? 0),
				}))
				.filter((c) => c.value > 0)
				.sort((a, b) => b.value - a.value);
			const covered = contributions.reduce((sum, c) => sum + c.value, 0);
			return {
				order,
				match: {
					project: project.slug,
					coverage: total > 0 ? round(covered / total) : 0,
					matched: contributions.map((c) => c.id),
				},
			};
		})
		.sort((a, b) => b.match.coverage - a.match.coverage || a.order - b.order)
		.map(({ match }) => match);
}

export function summarize(
	demand: Demand[],
	matches: Match[],
	projects: ProjectProfile[],
): Summary {
	const best = matches.find((m) => m.coverage > 0) ?? null;
	const runnerUp = matches.filter((m) => m.coverage > 0)[1] ?? null;
	const uncovered = demand
		.filter(
			(d) =>
				Math.max(0, ...projects.map((p) => p.skills[d.competence] ?? 0)) <
				COVERED_THRESHOLD,
		)
		.map((d) => d.competence);
	return {
		lead: demand.slice(0, 3).map((d) => d.competence),
		best: best?.project ?? null,
		runnerUp: runnerUp?.project ?? null,
		uncovered,
	};
}

export function analyze(
	text: string,
	projects: ProjectProfile[],
): Analysis | AnalysisError {
	const words = countWords(text);
	if (words < MIN_WORDS) return { ok: false, reason: "too-short", words };

	const segments = segment(text);
	const evidence = detect(segments);
	if (evidence.length === 0) return { ok: false, reason: "no-skill", words };

	const demand = toDemand(evidence);
	const matches = match(demand, projects);
	const summary = summarize(demand, matches, projects);

	return {
		ok: true,
		words,
		segments,
		evidence,
		demand,
		matches,
		summary,
		steps: [
			{
				id: "segment",
				input: { characters: text.length, words },
				output: segments,
				schema: "Segment[]",
				valid: z.array(SegmentSchema).safeParse(segments).success,
			},
			{
				id: "detect",
				input: { segments: segments.length, lexicon: lexiconSize },
				output: evidence,
				schema: "Evidence[]",
				valid: z.array(EvidenceSchema).safeParse(evidence).success,
			},
			{
				id: "match",
				input: { demand, projects: projects.length },
				output: matches,
				schema: "Match[]",
				valid: z.array(MatchSchema).safeParse(matches).success,
			},
			{
				id: "summary",
				input: { demand: demand.slice(0, 3), matches: matches.slice(0, 2) },
				output: summary,
				schema: "Summary",
				valid: SummarySchema.safeParse(summary).success,
			},
		],
	};
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}
