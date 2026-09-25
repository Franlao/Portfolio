import { frTypo, typographize } from "../lib/typo";

export const languages = {
	fr: "Français",
	en: "English",
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = "fr";

export const ui = {
	fr: {
		"site.title": "Solim Laokpezi, AI Engineer",
		"site.description":
			"AI Engineer à Lyon : agents IA auditables, pipelines RAG, services LLM en production. Collez une offre, le site l'analyse devant vous.",
		"site.imageAlt":
			"Une rue de Lyon la nuit, le restaurant La Brigade entre un café et une librairie, Fourvière au fond : le portfolio de Solim Laokpezi, AI Engineer.",
		"cartouche.role": "AI Engineer, Lyon",
		"cartouche.verified": "Vérifié pour",
		"cartouche.verifiedEmpty": "aucune offre pour l'instant",
		"cartouche.contact": "Contact",
		"cartouche.email": "E-mail",
		"cartouche.cv": "CV (PDF)",
		"cartouche.language": "Langue",
		"hero.title": "Je conçois des agents IA dont chaque décision se vérifie.",
		"hero.intro":
			"AI Engineer à Lyon. Trois ans en IA générative, de la R&D à la production, dans l'assurance, l'automobile et la santé.",
		"lab.label":
			"Collez une offre d'emploi. Le site l'analyse devant vous, étape par étape, et classe mes projets selon votre besoin.",
		"lab.placeholder":
			"Collez ici le texte de l'offre, en français ou en anglais.",
		"lab.analyze": "Analyser l'offre",
		"lab.analyzing": "Analyse en cours",
		"lab.privacy":
			"Le texte reste dans votre navigateur : l'analyse tourne entièrement sur votre appareil.",
		"lab.presets": "Pas d'offre sous la main ? Essayez une offre type :",
		"lab.tooShort":
			"Collez au moins quelques lignes de l'offre : il faut 20 mots au minimum.",
		"lab.noSkill":
			"Aucune compétence reconnue dans ce texte. Collez la description du poste, ou essayez une offre type.",
		"pipeline.title": "Le traitement, étape par étape",
		"pipeline.kind": "code déterministe",
		"pipeline.inspect": "Voir l'entrée et la sortie",
		"pipeline.input": "Entrée",
		"pipeline.output": "Sortie",
		"pipeline.quotes": "Citations relevées dans l'offre",
		"pipeline.more": "éléments de plus",
		"step.segment.title": "Découpage",
		"step.segment.desc": "Découpe l'offre en phrases courtes.",
		"step.detect.title": "Repérage des compétences",
		"step.detect.desc":
			"Cherche chaque compétence dans un lexique bilingue et garde la citation exacte de l'offre.",
		"step.match.title": "Rapprochement",
		"step.match.desc":
			"Mesure la part des compétences demandées que couvre chaque projet.",
		"step.summary.title": "Synthèse",
		"step.summary.desc":
			"Rédige un résumé à partir d'un gabarit fixe, sans modèle de langage.",
		"legend.title": "Légende du trait",
		"legend.code": "Tracé à la règle : du code. Même entrée, même sortie.",
		"legend.model":
			"Tracé à main levée : une étape confiée à un modèle de langage.",
		"legend.check": "Crayon rouge : un contrôle ou une vérification.",
		"projects.title": "Projets",
		"projects.default":
			"Une sélection de mes projets. Analysez une offre pour les classer selon votre poste.",
		"projects.ranked":
			"Classés selon votre offre, du plus proche au plus éloigné.",
		"projects.confidential":
			"Les projets menés en entreprise sont confidentiels : chaque démo montre le principe, sur des données fictives.",
		"projects.coverage": "des compétences demandées",
		"projects.matches": "Correspond à :",
		"projects.noMatch":
			"Ne correspond à aucune compétence repérée dans l'offre.",
		"projects.openDemo": "Ouvrir la démo",
		"projects.demoSoon": "Démo en préparation",
		"projects.demoNone": "Travail interne, sans démo publique",
		"career.title": "Parcours",
		"career.education": "Formation",
		"footer.note":
			"Conçu et développé par Solim Laokpezi. Les démos utilisent des données fictives.",
		"footer.source": "Code source",
		"project.back": "Retour à la cuisine",
		"project.notebook": "Le carnet du chef",
		"menu.kitchen": "Entrer dans la cuisine",
		"verified.pasted": "offre collée",
		"verified.words": "mots",
		"lang.switch": "Read in English",
	},
	en: {
		"site.title": "Solim Laokpezi, AI Engineer",
		"site.description":
			"AI Engineer in Lyon: auditable AI agents, RAG pipelines, production LLM services. Paste a job description and watch the site analyze it.",
		"site.imageAlt":
			"A street in Lyon at night, the restaurant La Brigade between a café and a bookshop, Fourvière behind: the portfolio of Solim Laokpezi, AI Engineer.",
		"cartouche.role": "AI Engineer, Lyon",
		"cartouche.verified": "Checked against",
		"cartouche.verifiedEmpty": "no job description yet",
		"cartouche.contact": "Contact",
		"cartouche.email": "Email",
		"cartouche.cv": "CV (PDF)",
		"cartouche.language": "Language",
		"hero.title": "I build AI agents whose every decision can be checked.",
		"hero.intro":
			"AI Engineer in Lyon. Three years in generative AI, from R&D to production, across insurance, automotive and healthcare.",
		"lab.label":
			"Paste a job description. The site analyzes it in front of you, step by step, and ranks my projects against what you need.",
		"lab.placeholder": "Paste the job description here, in English or French.",
		"lab.analyze": "Analyze the job description",
		"lab.analyzing": "Analyzing",
		"lab.privacy":
			"The text stays in your browser: the analysis runs entirely on your device.",
		"lab.presets": "No job description at hand? Try a sample one:",
		"lab.tooShort":
			"Paste at least a few lines of the job description: 20 words minimum.",
		"lab.noSkill":
			"No skill recognized in this text. Paste the job description, or try a sample one.",
		"pipeline.title": "The processing, step by step",
		"pipeline.kind": "deterministic code",
		"pipeline.inspect": "Show input and output",
		"pipeline.input": "Input",
		"pipeline.output": "Output",
		"pipeline.quotes": "Quotes found in the job description",
		"pipeline.more": "more items",
		"step.segment.title": "Segmentation",
		"step.segment.desc": "Splits the job description into short sentences.",
		"step.detect.title": "Skill detection",
		"step.detect.desc":
			"Looks up each skill in a bilingual lexicon and keeps the exact quote from the job description.",
		"step.match.title": "Matching",
		"step.match.desc":
			"Measures how much of the requested skill set each project covers.",
		"step.summary.title": "Summary",
		"step.summary.desc":
			"Writes a summary from a fixed template, without a language model.",
		"legend.title": "How to read the lines",
		"legend.code": "Ruled line: code. Same input, same output.",
		"legend.model": "Freehand line: a step handed to a language model.",
		"legend.check": "Red pencil: a check or a verification.",
		"projects.title": "Projects",
		"projects.default":
			"A selection of my projects. Analyze a job description to rank them for your role.",
		"projects.ranked": "Ranked against your job description, closest first.",
		"projects.confidential":
			"Work done for employers is confidential: each demo shows the idea, on fictional data.",
		"projects.coverage": "of the requested skills",
		"projects.matches": "Matches:",
		"projects.noMatch":
			"Matches none of the skills found in the job description.",
		"projects.openDemo": "Open the demo",
		"projects.demoSoon": "Demo in progress",
		"projects.demoNone": "Internal work, no public demo",
		"career.title": "Experience",
		"career.education": "Education",
		"footer.note":
			"Designed and built by Solim Laokpezi. The demos use fictional data.",
		"footer.source": "Source code",
		"project.back": "Back to the kitchen",
		"project.notebook": "The chef's notebook",
		"menu.kitchen": "Enter the kitchen",
		"verified.pasted": "pasted job description",
		"verified.words": "words",
		"lang.switch": "Lire en français",
	},
} as const;

export type UiKey = keyof (typeof ui)[typeof defaultLang];

export function getLangFromUrl(url: URL): Lang {
	const [, segment] = url.pathname.split("/");
	return segment in languages ? (segment as Lang) : defaultLang;
}

export function getTranslations(lang: Lang) {
	return (key: UiKey): string => {
		const value = ui[lang][key] ?? ui[defaultLang][key];
		return lang === "fr" ? frTypo(value) : value;
	};
}

/** The home page: La Brigade, the 3D kitchen. */
export const homePath = (lang: Lang) => (lang === "fr" ? "/" : "/en/");

/** « La carte »: the text version of the home page, for recruiters in a hurry. */
export const menuPath = (lang: Lang) =>
	lang === "fr" ? "/carte/" : "/en/menu/";

export const projectPath = (lang: Lang, slug: string) =>
	lang === "fr" ? `/projets/${slug}/` : `/en/projects/${slug}/`;

const rawSummaryText: Record<
	Lang,
	(parts: {
		lead: string[];
		best: string | null;
		pct: number;
		runnerUp: string | null;
		uncovered: string[];
	}) => string
> = {
	fr: ({ lead, best, pct, runnerUp, uncovered }) => {
		const focus = `Points forts de l'offre : ${lead.join(", ")}.`;
		const closest = best
			? ` Le projet le plus proche est « ${best} », qui couvre ${pct} % des compétences demandées${runnerUp ? `, suivi de « ${runnerUp} »` : ""}.`
			: " Aucun projet ne couvre ces compétences.";
		const gaps =
			uncovered.length > 0
				? ` Non couvert par ces projets : ${listFr(uncovered)}.`
				: " Chaque compétence repérée est couverte par au moins un projet.";
		return focus + closest + gaps;
	},
	en: ({ lead, best, pct, runnerUp, uncovered }) => {
		const focus = `Main themes of the job description: ${lead.join(", ")}.`;
		const closest = best
			? ` The closest project is “${best}”, covering ${pct}% of the requested skills${runnerUp ? `, followed by “${runnerUp}”` : ""}.`
			: " No project covers these skills.";
		const gaps =
			uncovered.length > 0
				? ` Not covered by these projects: ${listEn(uncovered)}.`
				: " Every skill found is covered by at least one project.";
		return focus + closest + gaps;
	},
};

interface StepResults {
	segment: (sentences: number, words: number) => string;
	detect: (skills: number, quotes: number) => string;
	match: (title: string, pct: number) => string;
	noMatch: string;
	valid: (schema: string) => string;
	invalid: (schema: string) => string;
	more: (count: number) => string;
}

const rawStepResults: Record<Lang, StepResults> = {
	fr: {
		segment: (s, w) => `${s} phrase${s > 1 ? "s" : ""}, ${w} mots.`,
		detect: (k, q) =>
			`${k} compétence${k > 1 ? "s" : ""} repérée${k > 1 ? "s" : ""}, ${q} citation${q > 1 ? "s" : ""}.`,
		match: (title, pct) =>
			`Meilleure correspondance : « ${title} », ${pct} % des compétences demandées.`,
		noMatch: "Aucun projet ne couvre les compétences repérées.",
		valid: (schema) => `Sortie conforme au schéma ${schema}`,
		invalid: (schema) => `Sortie non conforme au schéma ${schema}`,
		more: (count) => `… et ${count} de plus`,
	},
	en: {
		segment: (s, w) => `${s} sentence${s > 1 ? "s" : ""}, ${w} words.`,
		detect: (k, q) =>
			`${k} skill${k > 1 ? "s" : ""} found, ${q} quote${q > 1 ? "s" : ""}.`,
		match: (title, pct) =>
			`Best match: “${title}”, ${pct}% of the requested skills.`,
		noMatch: "No project covers the skills found.",
		valid: (schema) => `Output matches the ${schema} schema`,
		invalid: (schema) => `Output does not match the ${schema} schema`,
		more: (count) => `… and ${count} more`,
	},
};

function listFr(items: string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
}

function listEn(items: string[]): string {
	if (items.length <= 1) return items.join("");
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export const summaryText: typeof rawSummaryText = {
	fr: typographize(rawSummaryText.fr),
	en: rawSummaryText.en,
};

export const stepResults: Record<Lang, StepResults> = {
	fr: typographize(rawStepResults.fr),
	en: rawStepResults.en,
};
