import { frTypo } from "../../../../lib/typo";
import type { Lang } from "../types";
import type { Figure, SpotName } from "./logic";

const NBSP = String.fromCharCode(0x00a0);

/**
 * Keeps a number on the same line as its unit, and a sign on the same line as its number,
 * so « 25 N·m », « Ø 12 mm » or « p. 14 » never break. Not French typography: both languages need it.
 */
function glue(text: string): string {
	return text
		.replace(/(\d) (N·m|mm|°C|bar|L|h|s|km)(?!\p{L})/gu, `$1${NBSP}$2`)
		.replace(/(?<!\p{L})(Ø|±|R|p\.) (?=\d)/gu, `$1${NBSP}`);
}

/** French: frTypo, plus the units and signs of a technical drawing. */
export function typo(text: string): string {
	return glue(frTypo(text));
}

/** How each language sets a string before showing it. English keeps its own punctuation. */
export const typeset: Record<Lang, (text: string) => string> = {
	fr: typo,
	en: glue,
};

const enNumber = new Intl.NumberFormat("en-GB");

/**
 * Every string of the game, raw, in French. The game typesets each one for its language before
 * showing it. Fictional documents live in cases.ts; this holds the interface and the verifier's words.
 */
const fr = {
	title: "Chasse à l'hallucination",
	intro:
		"Le commis rédacteur répond en citant ses pages, mais une de ses trois affirmations est inventée : à vous de la démasquer.",
	rule: "Comparez chaque affirmation à la page qu'elle cite, texte et schéma compris. L'inventée donne une valeur que sa page ne contient pas, ou cite une page introuvable.",
	keys: "Au clavier : touches 1, 2 et 3.",
	progress: (index: number, total: number) => `Question ${index} sur ${total}`,
	tally: "Vos trouvailles",
	tallyItem: (index: number, state: "right" | "wrong" | "todo") =>
		`Question ${index} : ${state === "right" ? "trouvée" : state === "wrong" ? "manquée" : "à venir"}`,
	question: "question d'un concepteur",
	quote: (text: string) => `« ${text} »`,
	sources: (count: number) =>
		`recherche : ${count} pages retrouvées, texte et schémas`,
	pages: "Pages retrouvées",
	pageRef: (page: number) => `p. ${page}`,
	cite: (page: number) => `[p. ${page}]`,
	answer: "réponse du commis rédacteur",
	opener: "D'après la documentation :",
	ask: "Laquelle est inventée ? Désignez-la.",
	suspect: "inventée ?",
	picked: "votre choix",
	stamp: "inventée",
	void: "✗ rien ici",
	ghost: (page: number) => `✗ p. ${page} : introuvable`,
	checking: "Le vérificateur confronte chaque citation à sa page…",
	right: (fake: number) => `Bien vu : l'affirmation ${fake} était inventée.`,
	wrong: (picked: number, fake: number) =>
		`Raté : l'affirmation ${picked} est exacte, l'inventée était la ${fake}.`,
	trap: (kind: string) => `Le piège : ${kind}.`,
	next: "Question suivante",
	last: "Voir le résultat",
	endTitle: "Contrôle terminé",
	score: (right: number, total: number) =>
		right === total
			? `Sans faute : ${right} hallucinations démasquées sur ${total}.`
			: `${right} hallucination${right > 1 ? "s" : ""} démasquée${right > 1 ? "s" : ""} sur ${total}.`,
	recap: (index: number, right: boolean, kind: string) =>
		`Question ${index}, ${right ? "trouvée" : "manquée"} : ${kind}.`,
	verifier: (total: number) =>
		`Le vérificateur, lui : ${total} sur ${total}, en confrontant chaque citation à sa page, texte et schémas compris.`,
	realLabel: "le vrai projet",
	real: "Chez IVECO France, un assistant RAG multimodal cherche dans la documentation technique du bureau d'études, texte et images, pour plus de 15 ingénieurs. Une architecture multi-agents y fiabilise les réponses : c'est le principe que ce jeu simplifie, avec des pages fictives.",
	tags: "Lyon · septembre 2024 à octobre 2025 · LangChain, ChromaDB, LlamaIndex",
	again: "Rejouer",
	back: "Revenir à la cuisine",
	say: {
		start: "Une phrase est inventée !",
		right: "Bien vu !",
		wrong: "Le vérificateur l'a vue !",
		end: "Contrôle terminé !",
	},

	/** The verifier's words: logic.ts writes its notes with them. */
	check: {
		spots: {
			text: "texte",
			order: "vis comptées",
			sensor: "capteurs comptés",
			bolt: "boulons comptés",
			joint: "cote du joint",
			hole: "cote des trous",
			holeSpacing: "entraxe coté",
			peak: "pic",
			limit: "ligne de limite",
			radius: "rayon coté",
			clampSpacing: "cote entre colliers",
			level: "voyant",
			interval: "intervalle coté",
		} satisfies Record<SpotName, string>,
		row: (label: string) => `ligne « ${label} »`,
		figures: {
			table: { noun: "tableau", definite: "le tableau" },
			points: { noun: "schéma", definite: "le schéma" },
			section: { noun: "schéma", definite: "le schéma" },
			bracket: { noun: "plan", definite: "le plan" },
			curve: { noun: "courbe", definite: "la courbe" },
			bend: { noun: "schéma", definite: "le schéma" },
			clamps: { noun: "schéma", definite: "le schéma" },
			level: { noun: "schéma", definite: "le schéma" },
			interval: { noun: "frise", definite: "la frise" },
		} satisfies Record<Figure["kind"], { noun: string; definite: string }>,
		ok: (page: number, place: string, value: string) =>
			`✓ p. ${page}, ${place} : ${value}.`,
		mismatch: (page: number, place: string, found: string, claimed: string) =>
			`✗ p. ${page}, ${place} : ${found}, pas ${claimed}.`,
		other: (value: string, spot: string) => `${value}, c'est la ${spot}.`,
		absent: (page: number, figure: string) =>
			`✗ p. ${page} : rien sur ce point, ni dans le texte ni dans ${figure}.`,
		ghost: (page: number) =>
			`✗ p. ${page} : cette page ne fait pas partie des pages retrouvées.`,
	},

	/** What kind of invention it was, for the verdict and the recap. */
	traps: {
		none: "aucune",
		misread: "une valeur lue sur la mauvaise ligne",
		text: "une valeur démentie par le texte",
		figure: (figure: string) => `une valeur démentie par ${figure}`,
		absent: "une affirmation absente de la page citée",
		ghost: "une page citée qui n'est pas dans les sources",
	},

	/** Words drawn on the figures. Units and signs (°C, km, R) are the same in both languages. */
	figure: {
		hatch: "trappe",
		gasket: "joint",
		casing: "carter",
		time: "temps",
		limit: (value: string) => `limite ${value}`,
		peak: (value: string) => `pic ${value}`,
		fitting: "raccord",
		gearbox: "réducteur",
		level: "niveau",
	},

	/** « 60000 » → « 60 000 »; typo() then makes the space unbreakable. */
	grouped: (value: number) =>
		String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " "),

	/** Figures described for screen readers: every value they show, in words. */
	alt: {
		table: (left: string, right: string, rows: string) =>
			`Tableau, ${left} et ${right} : ${rows}.`,
		row: (label: string, value: string) => `${label}, ${value}`,
		rowSeparator: " ; ",
		order: (caption: string, count: number) =>
			`Schéma : ${caption}, ${count} vis numérotées de 1 à ${count} dans l'ordre de serrage.`,
		sensor: (caption: string, count: number) =>
			`Schéma : ${caption} vu de dessus, ${count} capteurs de température, de T1 à T${count}.`,
		bolt: (caption: string, count: number) =>
			`Schéma : ${caption} fixée par ${count} boulons.`,
		section: (joint: string) =>
			`Coupe : trappe, joint et carter. Épaisseur du joint : ${joint}.`,
		bracket: (hole: string, spacing: string) =>
			`Plan : support percé de deux trous de ${hole}, entraxe ${spacing}.`,
		curve: (peak: string, limit: string) =>
			`Courbe de température pendant l'essai : pic à ${peak}, limite à ${limit}.`,
		bend: (radius: string) =>
			`Schéma : flexible coudé, rayon de courbure minimal R ${radius}.`,
		clamps: (spacing: string) =>
			`Schéma : flexible tenu par des colliers espacés de ${spacing}.`,
		level: (level: string) =>
			`Schéma : réducteur vu de côté, voyant d'huile, niveau : ${level}.`,
		interval: (every: string) => `Frise : une vidange tous les ${every}.`,
	},
};

export type Copy = typeof fr;

/** The same game in British English: rewritten, not translated word for word. */
const en: Copy = {
	title: "Spot the hallucination",
	intro:
		"The writer commis answers with page references, but one of its three claims is made up. Your job: catch it out.",
	rule: "Check each claim against the page it cites, text and diagram included. The made-up one gives a value its page doesn’t contain, or cites a page that isn’t there.",
	keys: "Keyboard: press 1, 2 or 3.",
	progress: (index: number, total: number) => `Question ${index} of ${total}`,
	tally: "Your catches",
	tallyItem: (index: number, state: "right" | "wrong" | "todo") =>
		`Question ${index}: ${state === "right" ? "caught" : state === "wrong" ? "missed" : "still to come"}`,
	question: "a design engineer’s question",
	quote: (text: string) => `“${text}”`,
	sources: (count: number) =>
		`search: ${count} pages retrieved, text and diagrams`,
	pages: "Retrieved pages",
	pageRef: (page: number) => `p. ${page}`,
	cite: (page: number) => `[p. ${page}]`,
	answer: "answer from the writer commis",
	opener: "According to the documentation:",
	ask: "Which one is made up? Point it out.",
	suspect: "made up?",
	picked: "your pick",
	stamp: "made up",
	void: "✗ nothing here",
	ghost: (page: number) => `✗ p. ${page}: not found`,
	checking: "The verifier checks each citation against its page…",
	right: (fake: number) => `Well spotted: claim ${fake} was made up.`,
	wrong: (picked: number, fake: number) =>
		`Not quite: claim ${picked} is accurate, the made-up one was ${fake}.`,
	trap: (kind: string) => `The trap: ${kind}.`,
	next: "Next question",
	last: "See the result",
	endTitle: "Check complete",
	score: (right: number, total: number) =>
		right === total
			? `Clean sheet: you caught ${right} hallucinations out of ${total}.`
			: `You caught ${right} hallucination${right === 1 ? "" : "s"} out of ${total}.`,
	recap: (index: number, right: boolean, kind: string) =>
		`Question ${index}, ${right ? "caught" : "missed"}: ${kind}.`,
	verifier: (total: number) =>
		`The verifier got ${total} out of ${total}, checking every citation against its page, text and diagrams included.`,
	realLabel: "the real project",
	real: "At IVECO France, a multimodal RAG assistant searches the design office’s technical documentation, text and images, for more than 15 engineers. A multi-agent architecture makes its answers reliable: that is the principle this game simplifies, with fictional pages.",
	tags: "Lyon · September 2024 to October 2025 · LangChain, ChromaDB, LlamaIndex",
	again: "Play again",
	back: "Back to the kitchen",
	say: {
		start: "One line is made up!",
		right: "Well spotted!",
		wrong: "The verifier caught it!",
		end: "Check complete!",
	},

	check: {
		spots: {
			text: "text",
			order: "screw count",
			sensor: "sensor count",
			bolt: "bolt count",
			joint: "gasket dimension",
			hole: "hole dimension",
			holeSpacing: "centre distance",
			peak: "peak",
			limit: "limit line",
			radius: "radius dimension",
			clampSpacing: "clamp spacing",
			level: "sight glass",
			interval: "interval dimension",
		},
		row: (label: string) => `“${label}” row`,
		figures: {
			table: { noun: "table", definite: "the table" },
			points: { noun: "diagram", definite: "the diagram" },
			section: { noun: "diagram", definite: "the diagram" },
			bracket: { noun: "drawing", definite: "the drawing" },
			curve: { noun: "graph", definite: "the graph" },
			bend: { noun: "diagram", definite: "the diagram" },
			clamps: { noun: "diagram", definite: "the diagram" },
			level: { noun: "diagram", definite: "the diagram" },
			interval: { noun: "timeline", definite: "the timeline" },
		},
		ok: (page: number, place: string, value: string) =>
			`✓ p. ${page}, ${place}: ${value}.`,
		mismatch: (page: number, place: string, found: string, claimed: string) =>
			`✗ p. ${page}, ${place}: ${found}, not ${claimed}.`,
		other: (value: string, spot: string) => `${value} is on the ${spot}.`,
		absent: (page: number, figure: string) =>
			`✗ p. ${page}: nothing on this, in the text or ${figure}.`,
		ghost: (page: number) =>
			`✗ p. ${page}: the search never retrieved this page.`,
	},

	traps: {
		none: "none",
		misread: "a value read off the wrong line",
		text: "a value the text contradicts",
		figure: (figure: string) => `a value ${figure} contradicts`,
		absent: "a claim the cited page never makes",
		ghost: "a cited page that isn’t among the sources",
	},

	figure: {
		hatch: "hatch",
		gasket: "gasket",
		casing: "casing",
		time: "time",
		limit: (value: string) => `limit ${value}`,
		peak: (value: string) => `peak ${value}`,
		fitting: "fitting",
		gearbox: "gearbox",
		level: "level",
	},

	grouped: (value: number) => enNumber.format(value),

	alt: {
		table: (left: string, right: string, rows: string) =>
			`Table, ${left} and ${right}: ${rows}.`,
		row: (label: string, value: string) => `${label}, ${value}`,
		rowSeparator: "; ",
		order: (caption: string, count: number) =>
			`Diagram: ${caption}, ${count} screws numbered 1 to ${count} in tightening order.`,
		sensor: (caption: string, count: number) =>
			`Diagram: ${caption} seen from above, ${count} temperature sensors, T1 to T${count}.`,
		bolt: (caption: string, count: number) =>
			`Diagram: ${caption} held by ${count} bolts.`,
		section: (joint: string) =>
			`Cross-section: hatch, gasket and casing. Gasket thickness: ${joint}.`,
		bracket: (hole: string, spacing: string) =>
			`Drawing: bracket drilled with two ${hole} holes, ${spacing} between centres.`,
		curve: (peak: string, limit: string) =>
			`Temperature curve during the test: peak at ${peak}, limit at ${limit}.`,
		bend: (radius: string) =>
			`Diagram: bent hose, minimum bend radius R ${radius}.`,
		clamps: (spacing: string) =>
			`Diagram: hose held by clamps ${spacing} apart.`,
		level: (level: string) =>
			`Diagram: gearbox seen from the side, oil sight glass, level: ${level}.`,
		interval: (every: string) => `Timeline: an oil change every ${every}.`,
	},
};

export const copy: Record<Lang, Copy> = { fr, en };
