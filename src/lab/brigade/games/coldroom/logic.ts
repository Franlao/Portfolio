import { frTypo } from "../../../../lib/typo";
import { REPORTS } from "./reports";

/**
 * « Rien ne sort » : pure rules of the cold room game, no DOM here.
 * The visitor fills a five-field patient sheet by pointing at passages of a fictional report;
 * a local model fills its own sheet (a pre-computed replay); nothing ever leaves the room.
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

export interface Field {
	id: FieldId;
	/** Short label, shown in the sheet. */
	label: string;
	/** The label with its article, for sentences (« Il fallait la date d'entrée »). */
	article: string;
	/** One line that tells a non-doctor what to look for. */
	hint: string;
}

/** The sheet's schema: the same five fields for every report, as in a real extraction. */
export const FIELDS: readonly Field[] = [
	{
		id: "entry",
		label: "date d'entrée",
		article: "la date d'entrée",
		hint: "Le jour où le patient est hospitalisé.",
	},
	{
		id: "reason",
		label: "motif d'hospitalisation",
		article: "le motif d'hospitalisation",
		hint: "Ce qui l'amène à l'hôpital, avant tout diagnostic.",
	},
	{
		id: "history",
		label: "antécédent personnel",
		article: "l'antécédent personnel",
		hint: "Une maladie ou une opération passée du patient lui-même.",
	},
	{
		id: "discharge",
		label: "traitement de sortie",
		article: "le traitement de sortie",
		hint: "Le médicament prescrit en quittant l'hôpital.",
	},
	{
		id: "dosage",
		label: "posologie de sortie",
		article: "la posologie de sortie",
		hint: "La dose de ce médicament de sortie.",
	},
];

/** How a wrong click is explained: « Ce passage donne … ». */
export const ROLE_PHRASE: Record<Role, string> = {
	entry: "la date d'entrée",
	reason: "le motif d'hospitalisation",
	history: "l'antécédent personnel",
	discharge: "le traitement de sortie",
	dosage: "la posologie de sortie",
	consult: "une date de consultation, avant l'entrée",
	exit: "la date de sortie",
	diagnosis: "le diagnostic, posé pendant le séjour",
	family: "un antécédent familial, pas celui du patient",
	usual: "le traitement habituel, d'avant l'hospitalisation",
	usualDose: "la posologie du traitement habituel",
};

export interface ModelGuess {
	/** The passage the model picked, by role. */
	role: Role;
	confidence: number;
}

export interface Report {
	id: string;
	service: string;
	patient: string;
	/** Paragraphs where a clickable passage is written [text|role]. */
	paragraphs: string[];
	/** The structured value each passage gives, as it lands in the sheet. */
	values: Partial<Record<Role, string>>;
	model: Record<FieldId, ModelGuess>;
	/** When the model finishes each field, in seconds from the start, in field order. */
	modelSeconds: number[];
}

export const REPORT_TITLE = "Compte rendu d'hospitalisation · document fictif";

/** Below this confidence, the model's answer is flagged for a human to reread. */
export const REVIEW_BELOW = 0.6;

const NBSP = String.fromCharCode(0x00a0);

/** frTypo, plus the units this game uses (mg, g, octets) and « n° 0417 », which must not break. */
export function fr(text: string): string {
	return frTypo(text)
		.replace(/(\d) (mg|g|octets?)(?!\p{L})/gu, `$1${NBSP}$2`)
		.replace(/n° (?=\d)/g, `n°${NBSP}`)
		.replace(/ × /g, `${NBSP}×${NBSP}`);
}

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
	return [REPORT_TITLE, `${report.service} · ${report.patient}`, ...body].join(
		"\n",
	);
}

/** Size of the report in UTF-8, the unit of the room's two counters. */
export function reportBytes(report: Report): number {
	return new TextEncoder().encode(plainText(report)).length;
}

export function valueFor(report: Report, role: Role): string {
	return report.values[role] ?? "";
}

export function fieldOf(id: FieldId): Field {
	return FIELDS.find((field) => field.id === id) ?? FIELDS[0];
}

export function percent(confidence: number): string {
	return `${Math.round(confidence * 100)} %`;
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
	if (!ready) return "Le modèle local lit encore ce passage.";
	const guess = modelAnswer(report, field);
	const trust = `confiance ${percent(guess.confidence)}${guess.review ? ", à relire" : ""}`;
	if (!guess.right) {
		return guess.role === playerRole
			? `Le modèle a fait la même erreur, ${trust}.`
			: `Le modèle s'est trompé : « ${guess.value} », ${trust}.`;
	}
	return playerRole === field
		? `Le modèle a écrit la même chose, ${trust}.`
		: `Le modèle, lui, avait vu juste, ${trust}.`;
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
	const verdict = judge(report, field, role);
	const player = verdict.right
		? `✓ Juste : « ${verdict.expected} ».`
		: `✗ Ce passage donne ${ROLE_PHRASE[role]}. Il fallait ${fieldOf(field).article} : « ${verdict.expected} ».`;
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
		field: field.id,
		...modelAnswer(report, field.id),
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
	const summary = summarize(report, answers);
	const s = summary.player > 1 ? "s" : "";
	const weakest = fieldOf(summary.weakest.field);
	const low = percent(summary.weakest.confidence);
	const onlyMissIsWeakest =
		summary.misses.length === 1 && summary.misses[0] === summary.weakest.field;
	const modelDetail = onlyMissIsWeakest
		? `Son erreur, sur ${weakest.article}, portait sa confiance la plus basse (${low}) : c'est là qu'on relit.`
		: `Sa confiance la plus basse (${low}) portait sur ${weakest.article} : c'est le champ à relire en premier.`;
	return {
		heading: "Fiche complète",
		score: `Vous : ${summary.player} champ${s} juste${s} sur ${summary.total}, en ${Math.round(seconds)} s.`,
		model: `Le modèle local : ${summary.model} sur ${summary.total}. ${modelDetail}`,
		door: tempted
			? `Octets sortis de la pièce : ${bytesOut}. Vous avez tenté le service en ligne, la porte a tenu.`
			: `Octets sortis de la pièce : ${bytesOut}. Au prochain service, essayez le bouton « Envoyer au service en ligne » : la porte vous attend.`,
		lesson: "Le modèle vient aux données, pas l'inverse.",
		real: "Le vrai projet, au CHU de Lille de mars à août 2024 : extraire des données structurées de comptes rendus médicaux avec des LLM open source (Llama 3.1, Mistral 7B, Gemma) exécutés en local, sous contrainte de confidentialité. Un pipeline RAG local (Ollama, ChromaDB, HuggingFace) permet de valoriser plus de 10 ans de comptes rendus non structurés pour de futures études cliniques.",
		fiction:
			"Le compte rendu de ce jeu est fictif : patient, dates et valeurs sont inventés.",
		chef:
			summary.player === summary.total
				? "Fiche parfaite !"
				: "Fiche complète !",
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
	reports: readonly Report[] = REPORTS,
): Report {
	const pool = reports.filter((report) => report.id !== previous);
	return pool[Math.floor(random() * pool.length)] ?? reports[0];
}

/** How many fields are filled before the online shortcut shows up: 1, 2 or 3. */
export function temptAfter(random: () => number): number {
	return 1 + Math.floor(random() * 3);
}
