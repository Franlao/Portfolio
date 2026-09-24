import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/**
 * One MDX file per project and language: src/content/projects/{fr,en}/<slug>.mdx.
 * The slug must exist in src/data/projects.ts, which holds the language-independent data.
 */
const projects = defineCollection({
	loader: glob({ base: "./src/content/projects", pattern: "{fr,en}/*.mdx" }),
	schema: z.object({
		title: z.string(),
		org: z.string(),
		period: z.string(),
		summary: z.string(),
	}),
});

export const collections = { projects };
