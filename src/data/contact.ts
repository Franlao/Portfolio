import type { Lang } from "../i18n/ui";

/** How to reach Solim: one place for the kitchen's bill and the text version's header. */
export const contact = {
	email: "solim.laokpezi@outlook.fr",
	linkedin: "https://www.linkedin.com/in/solimlaokpezi",
	github: "https://github.com/Franlao",
	cv: {
		fr: "/cv/solim-laokpezi-cv-fr.pdf",
		en: "/cv/solim-laokpezi-cv-en.pdf",
	} satisfies Record<Lang, string>,
} as const;
