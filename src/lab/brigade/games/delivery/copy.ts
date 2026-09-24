/**
 * Interface text of « La réserve qui se range seule ». Raw French: the game applies frTypo
 * when it displays a string, so non-breaking spaces never have to be typed here.
 */

const NBSP = String.fromCharCode(0x00a0);
/** French agreement: singular for 0 and 1. */
const s = (n: number) => (n > 1 ? "s" : "");

export const copy = {
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

	progress: (n: number, total: number) => `Livraison ${n} sur ${total}`,
	crateTag: "nouvelle pièce",
	ask: "Sur quelle étagère la poser ?",
	keys: "Touches 1 à 4.",

	reserveLabel: "La réserve du dossier",
	fileTag: (number: string) => `résumé du dossier n°${NBSP}${number}`,
	summaryTag: "résumé",
	rewritten: "réécrit",
	untouched: "inchangé",
	misfiled: "mal rangée",
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
