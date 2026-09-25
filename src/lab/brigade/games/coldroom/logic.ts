import type { Lang } from "../types";
import { COPY } from "./copy";

/**
 * « Rien ne sort » : pure rules of the cold room game, no DOM here.
 * The visitor fills a five-field patient sheet by pointing at passages of a fictional report;
 * a local model fills its own sheet (a pre-computed replay); nothing ever leaves the room.
 * The rules only deal in roles, never in words: a report reads the same in both languages.
 */

export type FieldId = "entry" | "reason" | "history" | "discharge" | "dosage";

/** What a passage really is: one of the five fields, or a trap that looks like one. */
export type Role =
	| FieldId
	| "consult"
	| "exit"
	| "diagnosis"
	| "family"
	| "usual"
	| "usualDose";

/** The sheet's schema: the same five fields for every report, as in a real extraction. */
export const FIELDS: readonly FieldId[] = [
	"entry",
	"reason",
	"history",
	"discharge",
	"dosage",
];

/** Every role a passage can play: the fields, then the traps. */
export const ROLES: readonly Role[] = [
	...FIELDS,
	"consult",
	"exit",
	"diagnosis",
	"family",
	"usual",
	"usualDose",
];

export interface ModelGuess {
	/** The passage the model picked, by role. */
	role: Role;
	confidence: number;
}

/** What a report says, in one language. */
export interface ReportText {
	service: string;
	patient: string;
	/** Paragraphs where a clickable passage is written [text|role]. */
	paragraphs: string[];
	/** The structured value each passage gives, as it lands in the sheet. */
	values: Partial<Record<Role, string>>;
}

/** A report as played: its text in one language, and the model's replay, shared by both. */
export interface Report extends ReportText {
	id: string;
	/** Everything said about the report (feedback, end screen) is in its language. */
	lang: Lang;
	model: Record<FieldId, ModelGuess>;
	/** When the model finishes each field, in seconds from the start, in field order. */
	modelSeconds: number[];
}

/** Below this confidence, the model's answer is flagged for a human to reread. */
export const REVIEW_BELOW = 0.6;

export interface Token {
	text: string;
	/** Set when the token is a clickable passage. */
	role?: Role;
}

const MARKER = /\[([^\]|]+)\|(\w+)\]/g;

/** Splits a paragraph into plain text and clickable passages. */
export function tokenize(paragraph: string): Token[] {
	const tokens: Token[] = [];
	let last = 0;
	for (const match of paragraph.matchAll(MARKER)) {
		const index = match.index ?? 0;
		if (index > last) tokens.push({ text: paragraph.slice(last, index) });
		tokens.push({ text: match[1], role: match[2] as Role });
		last = index + match[0].length;
	}
	if (last < paragraph.length) tokens.push({ text: paragraph.slice(last) });
	return tokens;
}

/** Every passage of a report, in reading order. */
export function passagesOf(report: Report): Required<Token>[] {
	return report.paragraphs.flatMap((paragraph) =>
		tokenize(paragraph).filter((token): token is Required<Token> =>
			Boolean(token.role),
		),
	);
}

/** The report as a plain text file: what an online service would have received. */
export function plainText(report: Report): string {
	const body = report.paragraphs.map((paragraph) =>
		tokenize(paragraph)
			.map((token) => token.text)
			.join(""),
	);
	return [
		COPY[report.lang].reportTitle,
		`${report.service} · ${report.patient}`,
		...body,
	].join("\n");
}

/** Size of the report in UTF-8, the unit of the room's two counters. */
export function reportBytes(report: Report): number {
	return new TextEncoder().encode(plainText(report)).length;
}

export function valueFor(report: Report, role: Role): string {
	return report.values[role] ?? "";
}

export interface Verdict {
	right: boolean;
	expected: string;
	chosen: string;
}

/** A click is right when the passage is the one that answers the field, nothing fuzzier. */
export function judge(report: Report, field: FieldId, role: Role): Verdict {
	return {
		right: role === field,
		expected: valueFor(report, field),
		chosen: valueFor(report, role),
	};
}

export interface ModelAnswer {
	role: Role;
	value: string;
	confidence: number;
	right: boolean;
	/** Low confidence: a human should reread this field. */
	review: boolean;
}

export function modelAnswer(report: Report, field: FieldId): ModelAnswer {
	const guess = report.model[field];
	return {
		role: guess.role,
		value: valueFor(report, guess.role),
		confidence: guess.confidence,
		right: guess.role === field,
		review: guess.confidence < REVIEW_BELOW,
	};
}

/** What the sheet says about the model once the visitor has answered the same field. */
export function modelLine(
	report: Report,
	field: FieldId,
	playerRole: Role,
	ready: boolean,
): string {
	const copy = COPY[report.lang];
	if (!ready) return copy.feedback.reading;
	const guess = modelAnswer(report, field);
	const trust = copy.feedback.trust(
		copy.percent(guess.confidence),
		guess.review,
	);
	if (!guess.right) {
		return guess.role === playerRole
			? copy.feedback.sameMistake(trust)
			: copy.feedback.modelWrong(guess.value, trust);
	}
	return playerRole === field
		? copy.feedback.same(trust)
		: copy.feedback.modelRight(trust);
}

export interface Feedback {
	right: boolean;
	/** About the visitor's click. */
	player: string;
	/** About the model's answer to the same field. */
	model: string;
}

export function feedback(
	report: Report,
	field: FieldId,
	role: Role,
	modelReady: boolean,
): Feedback {
	const copy = COPY[report.lang];
	const verdict = judge(report, field, role);
	const player = verdict.right
		? copy.feedback.right(verdict.expected)
		: copy.feedback.wrong(
				copy.roles[role],
				copy.fields[field].article,
				verdict.expected,
			);
	return {
		right: verdict.right,
		player,
		model: modelLine(report, field, role, modelReady),
	};
}

export interface ExitRequest {
	allowed: false;
	bytesOut: 0;
	/** What was asked to leave, and did not. */
	refused: number;
}

/**
 * The room's only door policy. Whatever is asked, nothing leaves: the model comes to the data.
 * The on-screen counter adds up bytesOut, so it can only ever read zero.
 */
export function requestExit(bytes: number): ExitRequest {
	return {
		allowed: false,
		bytesOut: 0,
		refused: Math.max(0, Math.round(bytes)),
	};
}

export interface Answer {
	field: FieldId;
	/** The passage the visitor clicked. */
	role: Role;
	right: boolean;
}

export interface Summary {
	player: number;
	model: number;
	/** Fields where the visitor and the model picked the same passage. */
	agree: number;
	total: number;
	/** The model's least confident field. */
	weakest: { field: FieldId; confidence: number };
	/** Fields the model got wrong. */
	misses: FieldId[];
}

export function summarize(report: Report, answers: readonly Answer[]): Summary {
	const guesses = FIELDS.map((field) => ({
		field,
		...modelAnswer(report, field),
	}));
	const weakest = guesses.reduce((low, guess) =>
		guess.confidence < low.confidence ? guess : low,
	);
	return {
		player: answers.filter((answer) => answer.right).length,
		model: guesses.filter((guess) => guess.right).length,
		agree: answers.filter(
			(answer) => report.model[answer.field].role === answer.role,
		).length,
		total: FIELDS.length,
		weakest: { field: weakest.field, confidence: weakest.confidence },
		misses: guesses.filter((guess) => !guess.right).map((guess) => guess.field),
	};
}

export interface EndTexts {
	heading: string;
	score: string;
	model: string;
	door: string;
	lesson: string;
	real: string;
	fiction: string;
	/** The chef's bubble, under 30 characters. */
	chef: string;
}

/** The end screen. The « real » line only states facts of the actual project. */
export function endTexts(
	report: Report,
	answers: readonly Answer[],
	seconds: number,
	tempted: boolean,
	bytesOut: number,
): EndTexts {
	const { end, chef, fields, percent } = COPY[report.lang];
	const summary = summarize(report, answers);
	const weakest = fields[summary.weakest.field].article;
	const low = percent(summary.weakest.confidence);
	const onlyMissIsWeakest =
		summary.misses.length === 1 && summary.misses[0] === summary.weakest.field;
	const detail = onlyMissIsWeakest
		? end.missIsWeakest(weakest, low)
		: end.weakest(low, weakest);
	return {
		heading: end.heading,
		score: end.score(summary.player, summary.total, Math.round(seconds)),
		model: end.model(summary.model, summary.total, detail),
		door: tempted ? end.doorTempted(bytesOut) : end.doorCalm(bytesOut),
		lesson: end.lesson,
		real: end.real,
		fiction: end.fiction,
		chef: summary.player === summary.total ? chef.perfect : chef.done,
	};
}

/** Mulberry32: a tiny seeded generator, so a game can be replayed and tested. */
export function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A new report each time: « Rejouer » never deals the one just played. */
export function pickReport(
	previous: string | null,
	random: () => number,
	reports: readonly Report[],
): Report {
	const pool = reports.filter((report) => report.id !== previous);
	return pool[Math.floor(random() * pool.length)] ?? reports[0];
}

/** How many fields are filled before the online shortcut shows up: 1, 2 or 3. */
export function temptAfter(random: () => number): number {
	return 1 + Math.floor(random() * 3);
}
