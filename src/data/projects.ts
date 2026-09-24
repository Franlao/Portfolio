import type { ProjectProfile } from "../lib/offer/engine";

export type DemoStatus = "ready" | "soon" | "none";

export interface ProjectMeta extends ProjectProfile {
	demo: DemoStatus;
}

/**
 * Language-independent project data, in default display order.
 * Localized text lives in src/content/projects/{fr,en}/<slug>.mdx.
 * Skill strengths go from 0 (absent) to 1 (core of the project).
 */
export const projects: ProjectMeta[] = [
	{
		slug: "claims-agent",
		demo: "ready",
		skills: {
			agents: 1,
			evaluation: 1,
			insurance: 1,
			production: 0.9,
			llm: 0.8,
			nlp: 0.6,
			python: 0.7,
			product: 0.6,
			communication: 0.3,
			data: 0.3,
		},
	},
	{
		slug: "clair",
		demo: "soon",
		skills: {
			rag: 1,
			research: 1,
			insurance: 0.7,
			llm: 0.7,
			nlp: 0.5,
			evaluation: 0.5,
			python: 0.6,
		},
	},
	{
		slug: "multimodal-rag",
		demo: "soon",
		skills: {
			rag: 1,
			multimodal: 1,
			industry: 1,
			agents: 0.8,
			llm: 0.8,
			evaluation: 0.6,
			communication: 0.5,
			production: 0.5,
			python: 0.6,
		},
	},
	{
		slug: "clinical-extraction",
		demo: "soon",
		skills: {
			nlp: 1,
			health: 1,
			"local-ai": 1,
			llm: 0.8,
			rag: 0.7,
			python: 0.6,
			data: 0.5,
			research: 0.4,
		},
	},
	{
		slug: "synthetic-health-data",
		demo: "soon",
		skills: {
			synthetic: 1,
			ml: 1,
			health: 0.9,
			"local-ai": 0.6,
			llm: 0.4,
			python: 0.8,
			research: 0.3,
		},
	},
	{
		slug: "llm-tooling",
		demo: "none",
		skills: {
			production: 1,
			"coding-assistants": 1,
			communication: 1,
			python: 0.8,
			llm: 0.7,
			evaluation: 0.5,
			insurance: 0.4,
			cloud: 0.3,
			typescript: 0.3,
		},
	},
];

export const projectBySlug: ReadonlyMap<string, ProjectMeta> = new Map(
	projects.map((p) => [p.slug, p]),
);
