import { frTypo } from "../../../../lib/typo";

const NBSP = String.fromCharCode(0x00a0);

/**
 * frTypo, plus the units and signs of a technical drawing, so « 25 N·m », « Ø 12 mm »
 * or « p. 14 » never break across two lines.
 */
export function typo(text: string): string {
	return frTypo(text)
		.replace(/(\d) (N·m|mm|°C|bar|L|h|km)(?!\p{L})/gu, `$1${NBSP}$2`)
		.replace(/(?<!\p{L})(Ø|±|R|p\.) (?=\d)/gu, `$1${NBSP}`);
}

/** Every string of the game, raw: the game passes each one through typo() before showing it. */
export const copy = {
	title: "Chasse à l'hallucination",
	intro:
		"Le commis rédacteur répond en citant ses pages, mais une de ses trois affirmations est inventée : à vous de la démasquer.",
	rule: "Comparez chaque affirmation à la page qu'elle cite, texte et schéma compris. L'inventée donne une valeur que sa page ne contient pas, ou cite une page introuvable.",
	keys: "Au clavier : touches 1, 2 et 3.",
	progress: (index: number, total: number) => `Question ${index} sur ${total}`,
	tally: "Vos trouvailles",
	tallyItem: (index: number, state: "right" | "wrong" | "todo") =>
		`Question ${index} : ${state === "right" ? "trouvée" : state === "wrong" ? "manquée" : "à venir"}`,
	question: "question d'un concepteur",
	sources: (count: number) =>
		`recherche : ${count} pages retrouvées, texte et schémas`,
	pages: "Pages retrouvées",
	answer: "réponse du commis rédacteur",
	opener: "D'après la documentation :",
	ask: "Laquelle est inventée ? Désignez-la.",
	suspect: "inventée ?",
	picked: "votre choix",
	stamp: "inventée",
	void: "✗ rien ici",
	ghost: (page: number) => `✗ p. ${page} : introuvable`,
	checking: "Le vérificateur confronte chaque citation à sa page…",
	right: (fake: number) => `Bien vu : l'affirmation ${fake} était inventée.`,
	wrong: (picked: number, fake: number) =>
		`Raté : l'affirmation ${picked} est exacte, l'inventée était la ${fake}.`,
	trap: (kind: string) => `Le piège : ${kind}.`,
	next: "Question suivante",
	last: "Voir le résultat",
	endTitle: "Contrôle terminé",
	score: (right: number, total: number) =>
		right === total
			? `Sans faute : ${right} hallucinations démasquées sur ${total}.`
			: `${right} hallucination${right > 1 ? "s" : ""} démasquée${right > 1 ? "s" : ""} sur ${total}.`,
	recap: (index: number, right: boolean, kind: string) =>
		`Question ${index}, ${right ? "trouvée" : "manquée"} : ${kind}.`,
	verifier: (total: number) =>
		`Le vérificateur, lui : ${total} sur ${total}, en confrontant chaque citation à sa page, texte et schémas compris.`,
	realLabel: "le vrai projet",
	real: "Chez IVECO France, un assistant RAG multimodal cherche dans la documentation technique du bureau d'études, texte et images, pour plus de 15 ingénieurs. Une architecture multi-agents y fiabilise les réponses : c'est le principe que ce jeu simplifie, avec des pages fictives.",
	tags: "Lyon · septembre 2024 à octobre 2025 · LangChain, ChromaDB, LlamaIndex",
	again: "Rejouer",
	back: "Revenir à la cuisine",
	say: {
		start: "Une phrase est inventée !",
		right: "Bien vu !",
		wrong: "Le vérificateur l'a vue !",
		end: "Contrôle terminé !",
	},
};
