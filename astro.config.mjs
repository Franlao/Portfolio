// @ts-check

import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import { defineConfig } from "astro/config";
import frenchTypography from "./src/lib/satteri-french-typography.ts";

// https://astro.build/config
export default defineConfig({
	integrations: [react(), mdx()],
	adapter: vercel(),
	markdown: {
		processor: satteri({ mdastPlugins: [frenchTypography] }),
	},
	i18n: {
		defaultLocale: "fr",
		locales: ["fr", "en"],
		routing: {
			prefixDefaultLocale: false,
		},
	},
});
