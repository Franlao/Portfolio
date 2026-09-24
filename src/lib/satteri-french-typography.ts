import { defineMdastPlugin, type PluginFactoryContext } from "satteri";
import { frTypo } from "./typo";

const frenchTypography = defineMdastPlugin({
	name: "french-typography",
	text(node, context) {
		const value = frTypo(node.value);
		if (value !== node.value)
			context.replaceNode(node, { type: "text", value });
	},
});

/** Sätteri plugin: French typography, only for content files under a /fr/ folder. */
export default function frenchTypographyFor({ fileURL }: PluginFactoryContext) {
	return fileURL?.pathname.includes("/fr/") ? frenchTypography : null;
}
