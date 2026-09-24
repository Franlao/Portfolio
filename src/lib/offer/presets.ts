import type { Lang } from "../../i18n/ui";

export interface Preset {
	id: string;
	label: Record<Lang, string>;
	text: Record<Lang, string>;
}

/** Fictional job descriptions, one per profile a recruiter is likely to hire for. */
export const presets: Preset[] = [
	{
		id: "agentic",
		label: { fr: "AI Engineer agentique", en: "Agentic AI Engineer" },
		text: {
			fr: `Nous recherchons un AI Engineer pour concevoir et mettre en production des agents IA sur notre plateforme.
Vous modéliserez des processus métier sous forme de graphes d'agents (LangGraph), avec des appels d'outils et des sorties structurées.
Vous mettrez en place l'évaluation et l'observabilité des services LLM, et garantirez la traçabilité de chaque décision.
Stack : Python, FastAPI, Docker, Kubernetes, Azure.
Vous travaillerez avec les équipes métiers pour identifier les cas d'usage et accompagner l'adoption.`,
			en: `We are looking for an AI Engineer to design and ship AI agents on our platform.
You will model business processes as agent graphs (LangGraph), with tool calling and structured outputs.
You will set up evaluation and observability for LLM services and keep every decision traceable.
Stack: Python, FastAPI, Docker, Kubernetes, Azure.
You will work with business teams to find use cases and drive adoption.`,
		},
	},
	{
		id: "rag",
		label: { fr: "Ingénieur RAG et LLM", en: "RAG and LLM Engineer" },
		text: {
			fr: `Au sein de notre direction technique, vous développerez un assistant de recherche documentaire basé sur le RAG pour nos ingénieurs.
Vous indexerez une documentation technique volumineuse (PDF, schémas, images) dans une base vectorielle, améliorerez la recherche sémantique et le reranking, et réduirez les hallucinations grâce à des vérifications croisées.
Une expérience des LLM open source, de LangChain ou LlamaIndex et des modèles multimodaux est attendue.
Vous présenterez vos résultats aux équipes du bureau d'études.`,
			en: `Within our engineering division, you will build a RAG-based document search assistant for our engineers.
You will index a large body of technical documentation (PDFs, diagrams, images) in a vector database, improve semantic search and reranking, and reduce hallucinations through cross-checks.
Experience with open-source LLMs, LangChain or LlamaIndex, and multimodal models is expected.
You will present your results to the design office teams.`,
		},
	},
	{
		id: "health",
		label: { fr: "Data scientist santé", en: "Healthcare data scientist" },
		text: {
			fr: `Un groupe hospitalier recherche un data scientist pour valoriser ses données de santé non structurées.
Missions : extraction d'informations à partir de comptes rendus médicaux avec des LLM open source déployés en local, dans le respect du RGPD et de la confidentialité des patients ; génération de données synthétiques pour la recherche clinique ; modélisation statistique en Python.
Vous collaborerez avec les médecins et les équipes de recherche, et contribuerez à des publications.`,
			en: `A hospital group is hiring a data scientist to make use of its unstructured health data.
You will extract information from medical reports with open-source LLMs running on-premise, in line with GDPR and patient confidentiality; generate synthetic data for clinical research; and build statistical models in Python.
You will work with physicians and research teams and contribute to publications.`,
		},
	},
	{
		id: "insurance",
		label: { fr: "IA en assurance", en: "AI in insurance" },
		text: {
			fr: `Assureur en pleine transformation, nous créons une équipe IA dédiée à la gestion des sinistres.
Vous automatiserez le traitement des dossiers (classement des pièces, contrôle des garanties, rédaction des courriers) avec des LLM, en combinant règles métier et modèles pour garder des décisions auditables.
Vous industrialiserez les solutions, développerez des librairies internes et accompagnerez les gestionnaires dans l'adoption de l'IA.
Une démarche MVP et un esprit produit sont indispensables.`,
			en: `As an insurer in the middle of a transformation, we are building an AI team dedicated to claims management.
You will automate claim handling (document classification, coverage checks, letter drafting) with LLMs, combining business rules and models so that decisions stay auditable.
You will take solutions to production, build internal libraries, and help claims handlers with AI adoption.
An MVP approach and a product mindset are essential.`,
		},
	},
];
