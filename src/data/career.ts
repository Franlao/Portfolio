import type { Lang } from "../i18n/ui";

export interface CareerEntry {
	period: Record<Lang, string>;
	role: string;
	org: string;
	line: Record<Lang, string>;
}

export const career: CareerEntry[] = [
	{
		period: { fr: "depuis déc. 2025", en: "since Dec 2025" },
		role: "AI Engineer",
		org: "Relyens, Lyon",
		line: {
			fr: "Produits agentiques pour l'indemnisation, services IA en production, librairies internes.",
			en: "Agentic products for claims, AI services in production, internal libraries.",
		},
	},
	{
		period: { fr: "sept. 2024 à oct. 2025", en: "Sep 2024 to Oct 2025" },
		role: "AI Engineer",
		org: "IVECO France, Lyon",
		line: {
			fr: "Premiers cas d'usage d'IA générative du bureau d'études : RAG multimodal et multi-agents.",
			en: "The design office's first generative AI use cases: multimodal RAG and multi-agent systems.",
		},
	},
	{
		period: { fr: "mars à août 2024", en: "Mar to Aug 2024" },
		role: "Data Scientist",
		org: "CHU de Lille",
		line: {
			fr: "Extraction de données structurées depuis des comptes rendus médicaux, avec des LLM locaux.",
			en: "Structured data extraction from medical reports, with local LLMs.",
		},
	},
	{
		period: { fr: "avr. à juin 2023", en: "Apr to Jun 2023" },
		role: "Data Scientist",
		org: "Laboratoire ERIC, Université Lyon 2",
		line: {
			fr: "Harmonisation de mesures périodiques et modélisation statistique.",
			en: "Harmonizing periodic measurements and statistical modeling.",
		},
	},
];

export const education = {
	degree: { fr: "Master Data Science", en: "Master's in Data Science" },
	school: "ILIS, Université de Lille",
	period: "2023 à 2025",
	periodEn: "2023 to 2025",
};
