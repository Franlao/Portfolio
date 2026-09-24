import { frTypo } from "../../../../lib/typo";
import type { Criterion, Family } from "./logic";

// Written as a char code so the invisible character stays readable in the source.
const NBSP = String.fromCharCode(0x00a0);

/** frTypo, plus the hour unit it does not handle (« 18 h »). */
export function fr(text: string): string {
	return frTypo(text).replace(/(\d) h(?!\p{L})/gu, `$1${NBSP}h`);
}

const plural = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`;

/** Every string of the game, in French. The render passes each one through fr(). */
export const copy = {
	title: "La mise en service",
	intro:
		"Un service IA part en production : composez son plateau, puis aidez l'équipe à choisir son assistant de code.",
	stepsLabel: "étapes du jeu",
	steps: ["le plateau", "le banc d'essai", "le bilan"],
	families: {
		production: "production",
		security: "sécurité",
		docs: "documentation",
	} satisfies Record<Family, string>,

	pick: {
		heading: "Le plateau",
		rules: [
			"Un service IA doit partir en production. Sur ces dix cartes, six gestes sont indispensables et quatre sont des pièges.",
			"Posez les six bons sur le plateau, puis sonnez « Service ! » : le chef contrôle tout.",
		],
		cardsLabel: "cartes candidates",
		add: "+ au plateau",
		onTray: "sur le plateau",
		service: "Service !",
		start: "Choisissez six cartes.",
		remaining: (n: number) => `Encore ${n} ${plural(n, "carte")}.`,
		ready: "Plateau complet : sonnez « Service ! ».",
		added: (short: string) => `Posé : ${short}.`,
		removed: (short: string) => `Retiré : ${short}.`,
		full: "Le plateau est plein : retirez d'abord une carte.",
		checking: "Le chef contrôle le plateau…",
		served: "Validé : le service part en production.",
		refused: (traps: number) =>
			`Refusé : ${traps} ${plural(traps, "piège")} sur le plateau.`,
		count: (n: number, size: number) => `${n} / ${size}`,
		score: (right: number, total: number) => `${right} / ${total} justes`,
		tallyLabel: "contrôle par famille",
		verdicts: {
			kept: "✓ bon choix",
			trap: "✗ piège",
			missed: "✗ oublié",
			avoided: "✓ bien écarté",
		},
		next: "Passer au banc d'essai",
	},

	bench: {
		heading: "Le banc d'essai",
		rules: [
			"L'équipe doit choisir un assistant de code. Trois candidats fictifs sont notés sur 10, selon quatre critères.",
			"Réglez ce qui compte pour l'équipe : le classement suit. Défi : faites passer chacun en tête au moins une fois.",
		],
		weightsLegend: "Ce qui compte pour l'équipe",
		criteria: {
			quality: "qualité du code",
			context: "compréhension du dépôt",
			privacy: "confidentialité",
			cost: "coût maîtrisé",
		} satisfies Record<Criterion, string>,
		levels: ["sans importance", "utile", "important", "essentiel"],
		notes: (list: string) => `notes : ${list}`,
		rankingLabel: "classement",
		assistant: (letter: string) => `assistant ${letter}`,
		outOf: " sur 10",
		lead: (letter: string) => `En tête : assistant ${letter}.`,
		even: "Poids égaux : les trois font jeu égal.",
		tie: "Égalité en tête : personne ne se détache.",
		none: "Aucun critère ne compte : rien ne les départage.",
		goalFound: " : déjà passé en tête",
		goalMissing: " : pas encore passé en tête",
		challenge: (found: number, total: number) =>
			`Défi : ${found} sur ${total}. Un ✓ marque chaque assistant déjà passé en tête.`,
		firstLead: (letter: string, found: number, total: number) =>
			`Assistant ${letter} passe en tête : ${found} sur ${total}.`,
		allFound:
			"Défi réussi : chacun peut gagner. Une évaluation sérieuse fixe donc les critères avec l'équipe, avant de comparer.",
		finish: "Voir le bilan",
	},

	end: {
		heading: "Bilan du poste",
		tray: (right: number, total: number) =>
			`Plateau : ${right} ${plural(right, "geste")} ${plural(right, "juste")} sur ${total}.`,
		bench: (found: number, total: number) =>
			`Banc d'essai : ${found} ${plural(found, "assistant")} sur ${total} ${plural(found, "passé")} en tête.`,
		realTag: "pour de vrai",
		real: [
			"Mettre en production, sécuriser, documenter : c'est le travail de Solim chez Relyens depuis décembre 2025 sur SARM, un service IA déployé pour la direction technique.",
			"Le banc d'essai illustre son autre rôle : référent des assistants IA de code, il a mené leur évaluation comparative, dont les rapports ont conduit à l'adoption de Claude Code.",
		],
		libraries:
			"Au même poste, ses librairies internes (outillage LLM, SDK) ont été adoptées par l'équipe data science.",
		fiction: "Les cartes, les assistants et leurs notes sont fictifs.",
		again: "Rejouer",
		back: "Revenir à la cuisine",
	},

	/** Speech bubbles above the chef: under 30 characters each. */
	say: {
		start: "Six gestes, pas un de plus !",
		served: "En production !",
		refused: "Refusé au passe !",
		bench: "À vous de peser !",
		lead: (letter: string) => `${letter} passe en tête !`,
		allFound: "Chacun peut gagner !",
		perfect: "Beau service !",
		end: "Service terminé !",
	},
};
