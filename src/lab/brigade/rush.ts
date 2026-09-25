import {
	type CheckId,
	type ClaimFile,
	type Outcome,
	type PieceId,
	run,
} from "../../components/demos/claims-agent/engine";
import { defaultLang, type Lang } from "../../i18n/ui";
import { copy, verdictReasons } from "./copy";

/**
 * « Coup de feu au passe » : claims arrive one after another, the player decides,
 * then the chef (the real claims engine) gives its verdict and the reason.
 */

export type RushCaseId =
	| "clean"
	| "no-quote"
	| "late"
	| "storm"
	| "disputed"
	| "ceiling"
	| "shared";

export interface RushCase {
	id: RushCaseId;
	/** What the ticket tells, in both languages (the text lives in copy.ts). */
	story: Record<Lang, string>;
	file: ClaimFile;
	/** What the rules expect. The tests check the engine agrees. */
	expected: Outcome;
}

const story = (id: RushCaseId): Record<Lang, string> => ({
	fr: copy.fr.rush.stories[id],
	en: copy.en.rush.stories[id],
});

const all: PieceId[] = ["declaration", "photos", "quote"];

export const rushCases: RushCase[] = [
	{
		id: "clean",
		story: story("clean"),
		file: {
			pieces: all,
			delayDays: 3,
			quoteAmount: 4200,
			circumstance: "reversing",
		},
		expected: "offer",
	},
	{
		id: "no-quote",
		story: story("no-quote"),
		file: {
			pieces: ["declaration", "photos"],
			delayDays: 2,
			quoteAmount: 3100,
			circumstance: "reversing",
		},
		expected: "missing",
	},
	{
		id: "late",
		story: story("late"),
		file: {
			pieces: all,
			delayDays: 9,
			quoteAmount: 2800,
			circumstance: "reversing",
		},
		expected: "escalation",
	},
	{
		id: "storm",
		story: story("storm"),
		file: {
			pieces: all,
			delayDays: 1,
			quoteAmount: 6500,
			circumstance: "storm",
		},
		expected: "escalation",
	},
	{
		id: "disputed",
		story: story("disputed"),
		file: {
			pieces: all,
			delayDays: 4,
			quoteAmount: 3900,
			circumstance: "disputed",
		},
		expected: "missing",
	},
	{
		id: "ceiling",
		story: story("ceiling"),
		file: {
			pieces: all,
			delayDays: 2,
			quoteAmount: 19000,
			circumstance: "reversing",
		},
		expected: "escalation",
	},
	{
		id: "shared",
		story: story("shared"),
		file: {
			pieces: [...all, "statement"],
			delayDays: 3,
			quoteAmount: 5000,
			circumstance: "disputed",
		},
		expected: "offer",
	},
];

export const ROUNDS = 6;

export interface Verdict {
	outcome: Outcome;
	/** Human-readable reasons, plain text in the requested language (main.ts applies French typography). */
	reasons: string[];
	/** Time the engine took, measured for real. */
	ms: number;
}

/** Runs the real claims engine on a case and explains its decision. */
export function judge(file: ClaimFile, lang: Lang = defaultLang): Verdict {
	const start = performance.now();
	const result = run(file, lang);
	const ms = performance.now() - start;
	const t = verdictReasons[lang];
	const missing = result.traces.find((trace) => trace.node === "missing")
		?.output as { request: PieceId[] } | undefined;
	const consistency = result.traces.find(
		(trace) => trace.node === "consistency",
	)?.output as { checks: { id: CheckId; passed: boolean }[] } | undefined;
	const reasons =
		result.outcome === "missing" && missing
			? missing.request.map((piece) =>
					t.missing(copy[lang].rush.pieces[piece].toLowerCase()),
				)
			: result.outcome === "escalation" && consistency
				? consistency.checks.filter((c) => !c.passed).map((c) => t.failed[c.id])
				: [t.complete];
	return { outcome: result.outcome, reasons, ms };
}

/** Picks the rounds of a game: every outcome appears, the order changes each time. */
export function deal(random: () => number = Math.random): RushCase[] {
	const shuffled = [...rushCases].sort(() => random() - 0.5);
	return shuffled.slice(0, ROUNDS);
}

export interface Round {
	rushCase: RushCase;
	choice: Outcome | null;
	verdict: Verdict;
	seconds: number;
}

export function score(rounds: Round[]) {
	const right = rounds.filter((r) => r.choice === r.verdict.outcome).length;
	const playerSeconds = rounds.reduce((sum, r) => sum + r.seconds, 0);
	const chefMs = rounds.reduce((sum, r) => sum + r.verdict.ms, 0);
	return { right, total: rounds.length, playerSeconds, chefMs };
}
