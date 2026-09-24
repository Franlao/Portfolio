import { type CollectionEntry, getCollection } from "astro:content";
import {
	projects as metas,
	type ProjectMeta,
	projectBySlug,
} from "../data/projects";
import { type Lang, projectPath } from "../i18n/ui";
import { frTypo } from "./typo";

export interface ProjectCard extends ProjectMeta {
	title: string;
	org: string;
	period: string;
	summary: string;
	href: string | null;
}

export function splitProjectId(id: string): { lang: Lang; slug: string } {
	const [lang, slug] = id.split("/");
	if ((lang !== "fr" && lang !== "en") || !slug || !projectBySlug.has(slug)) {
		throw new Error(
			`Unknown project entry "${id}": add it to src/data/projects.ts`,
		);
	}
	return { lang, slug };
}

export async function getProjectEntries(
	lang: Lang,
): Promise<CollectionEntry<"projects">[]> {
	return getCollection(
		"projects",
		(entry) => splitProjectId(entry.id).lang === lang,
	);
}

/** Projects for one language, in the default display order from src/data/projects.ts. */
export async function getProjectCards(lang: Lang): Promise<ProjectCard[]> {
	const entries = await getProjectEntries(lang);
	const bySlug = new Map(entries.map((e) => [splitProjectId(e.id).slug, e]));
	return metas.map((meta) => {
		const entry = bySlug.get(meta.slug);
		if (!entry)
			throw new Error(
				`Missing ${lang}/${meta.slug}.mdx in src/content/projects`,
			);
		return {
			...meta,
			...localize(lang, entry.data),
			href: meta.demo === "ready" ? projectPath(lang, meta.slug) : null,
		};
	});
}

/** Applies French typography to a project's text fields. */
export function localize<T extends Record<string, string>>(
	lang: Lang,
	data: T,
): T {
	if (lang !== "fr") return data;
	return Object.fromEntries(
		Object.entries(data).map(([k, v]) => [k, frTypo(v)]),
	) as T;
}
