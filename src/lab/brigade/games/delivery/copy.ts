import type { Lang } from "../types";

/**
 * Interface text of « La réserve qui se range seule ». The French is raw: the game applies frTypo
 * when it displays a string, so non-breaking spaces never have to be typed here.
 * The English is final: no frTypo, curly quotes, and numbers formatted for en-GB.
 */

const NBSP = String.fromCharCode(0x00a0);
/** French agreement: singular for 0 and 1. */
const s = (n: number) => (n > 1 ? "s" : "");

const numbers = new Intl.NumberFormat("en-GB");
const num = (n: number) => numbers.format(n);
/** English agreement: singular for 1 only. */
const summaries = (n: number) => (n === 1 ? "summary" : "summaries");

const fr = {
	title: "La réserve qui se range seule",
	intro:
		"Posez chaque nouvelle pièce du dossier sur la bonne étagère : la réserve met à jour ses résumés sans tout recalculer.",

	rulesTitle: "Le rangement",
	rules: [
		"Rangez chaque pièce selon ce qu'elle dit, pas selon qui l'envoie.",
		"Un modèle réécrit alors les résumés au-dessus d'elle, et seulement ceux-là.",
		"À la fin, trois questions testent votre réserve.",
	],
	legend: "En bleu, ce qu'écrit le modèle (ici préparé à l'avance et rejoué).",
	/** Quotes a document or a reply. */
	quote: (text: string) => `« ${text} »`,

	progress: (n: number, total: number) => `Livraison ${n} sur ${total}`,
	crateTag: "nouvelle pièce",
	ask: "Sur quelle étagère la poser ?",
	keys: "Touches 1 à 4.",

	reserveLabel: "La réserve du dossier",
	fileTag: (number: string) => `résumé du dossier n°${NBSP}${number}`,
	summaryTag: "résumé",
	rewritten: "réécrit",
	untouched: "inchangé",
	/** Read by screen readers before the label of a misfiled piece. */
	misfiled: "mal rangée :",
	/** Read by screen readers before the shelf name, on each shelf button. */
	shelfAction: "Poser sur l'étagère",

	yes: "✓",
	no: "✗",
	writing: "Le modèle réécrit les résumés au-dessus de la pièce…",
	right: "Bien rangée.",
	wrong: "Pas sur cette étagère.",
	belongs: (shelf: string, chosen: string) =>
		`Sa place : « ${shelf} ». Elle reste dans « ${chosen} ».`,
	cost: (rewritten: number, untouched: number) =>
		`${rewritten} résumé${s(rewritten)} réécrit${s(rewritten)}, ${untouched} inchangé${s(untouched)}.`,
	next: "Livraison suivante",
	toControl: "Passer au contrôle",

	meterTitle: "Depuis la première livraison",
	full: "Réindexation complète",
	incremental: "Mise à jour incrémentale",
	fullCount: (n: number) => `${n} résumé${s(n)} recalculé${s(n)}`,
	incrementalCount: (n: number) => `${n} résumé${s(n)} réécrit${s(n)}`,

	controlTitle: "Trois questions pour contrôler la réserve",
	controlLead:
		"La recherche part du résumé du dossier, descend vers l'étagère qui correspond à la question, puis lit ses pièces.",
	questionNumber: (n: number, total: number) => `question ${n} sur ${total}`,
	pathFile: "dossier",
	pathNothing: "aucune pièce",
	found: "trouvé",
	missing: "introuvable",
	whyMissing: (label: string, target: string, placed: string) =>
		`La question mène à « ${target} », mais « ${label} » est rangée dans « ${placed} ».`,

	endTitle: "Le bilan",
	scoreFiled: (right: number, total: number) =>
		`Pièces bien rangées : ${right} sur ${total}.`,
	scoreFound: (found: number, asked: number) =>
		`Réponses trouvées : ${found} sur ${asked}.`,
	scoreSavings: (incremental: number, full: number) =>
		`Résumés réécrits : ${incremental}, contre ${full} pour une réindexation complète.`,
	project:
		"C'est le principe de CLAIR, mon projet de recherche de 2026 : un pipeline RAG incrémental pour les dossiers de sinistres, qui adapte l'approche RAPTOR (des résumés de résumés) à des dossiers qui évoluent. L'index hiérarchique suit les nouvelles pièces sans tout recalculer ; le travail vise une publication scientifique.",
	again: "Rejouer",
	back: "Revenir à la cuisine",

	chef: {
		start: "Les livraisons arrivent !",
		right: ["Bien rangé !", "Étagère à jour !", "Impeccable !"],
		wrong: ["Pas cette étagère !", "Ça ne va pas là !"],
		perfect: "Index impeccable !",
		holes: "L'index a des trous !",
	},
};

export type Copy = typeof fr;

const en: Copy = {
	title: "The storeroom that tidies itself",
	intro:
		"Put each new document from the claim on the right shelf: the storeroom updates its summaries without recomputing the lot.",

	rulesTitle: "Putting it away",
	rules: [
		"File each document by what it says, not by who sent it.",
		"A model then rewrites the summaries above it, and only those.",
		"At the end, three questions put your storeroom to the test.",
	],
	legend:
		"In blue, what the model writes (prepared in advance here, then replayed).",
	quote: (text) => `“${text}”`,

	progress: (n, total) => `Delivery ${num(n)} of ${num(total)}`,
	crateTag: "new document",
	ask: "Which shelf does it go on?",
	keys: "Keys 1 to 4.",

	reserveLabel: "The claim's storeroom",
	fileTag: (number) => `summary of claim no.${NBSP}${number}`,
	summaryTag: "summary",
	rewritten: "rewritten",
	untouched: "unchanged",
	misfiled: "misfiled:",
	shelfAction: "File under",

	yes: "✓",
	no: "✗",
	writing: "The model is rewriting the summaries above the document…",
	right: "Right shelf.",
	wrong: "Wrong shelf.",
	belongs: (shelf, chosen) =>
		`It belongs under “${shelf}”, but it stays under “${chosen}”.`,
	cost: (rewritten, untouched) =>
		`${num(rewritten)} ${summaries(rewritten)} rewritten, ${num(untouched)} unchanged.`,
	next: "Next delivery",
	toControl: "On to the checks",

	meterTitle: "Since the first delivery",
	full: "Full reindex",
	incremental: "Incremental update",
	fullCount: (n) => `${num(n)} ${summaries(n)} recomputed`,
	incrementalCount: (n) => `${num(n)} ${summaries(n)} rewritten`,

	controlTitle: "Three questions to check the storeroom",
	controlLead:
		"The search starts from the claim summary, goes down to the shelf that matches the question, then reads the documents on it.",
	questionNumber: (n, total) => `question ${num(n)} of ${num(total)}`,
	pathFile: "claim",
	pathNothing: "no document",
	found: "found",
	missing: "not found",
	whyMissing: (label, target, placed) =>
		`The question leads to “${target}”, but “${label}” is filed under “${placed}”.`,

	endTitle: "The tally",
	scoreFiled: (right, total) =>
		`Documents on the right shelf: ${num(right)} of ${num(total)}.`,
	scoreFound: (found, asked) =>
		`Answers found: ${num(found)} of ${num(asked)}.`,
	scoreSavings: (incremental, full) =>
		`Summaries rewritten: ${num(incremental)}, against ${num(full)} for a full reindex.`,
	project:
		"That's the idea behind CLAIR, my 2026 research project: an incremental RAG pipeline for insurance claim files, which adapts the RAPTOR approach (summaries of summaries) to files that change over time. The hierarchical index keeps up with new documents without recomputing everything; the work is aimed at a scientific publication.",
	again: "Play again",
	back: "Back to the kitchen",

	chef: {
		start: "Deliveries incoming!",
		right: ["Nicely filed!", "Shelf up to date!", "Spot on!"],
		wrong: ["Not that shelf!", "That doesn't go there!"],
		perfect: "Spotless index!",
		holes: "Holes in the index!",
	},
};

export const copy: Record<Lang, Copy> = { fr, en };
