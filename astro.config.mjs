// @ts-check

import { satteri } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import { defineConfig, envField } from "astro/config";
import frenchTypography from "./src/lib/satteri-french-typography.ts";

// Vercel exposes the production domain at build time; locally there is none.
const productionHost = /** @type {any} */ (globalThis).process?.env
	?.VERCEL_PROJECT_PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
	site: productionHost ? `https://${productionHost}` : "http://localhost:4321",
	integrations: [react(), mdx()],
	adapter: vercel(),
	// The Brigade prototype became the home page.
	redirects: {
		"/lab/brigade": "/",
	},
	env: {
		schema: {
			// Reads the offers pasted in the kitchen. Optional: without it, the lexicon reads them.
			MISTRAL_API_KEY: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
		},
	},
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
