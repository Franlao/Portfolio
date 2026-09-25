import { frTypo } from "../../../../lib/typo";
import type { Lang } from "../types";
import { type CardText, cardText } from "./cards";
import type { CardId, Criterion, Family } from "./logic";

// Written as a char code so the invisible character stays readable in the source.
const NBSP = String.fromCharCode(0x00a0);

/** frTypo, plus the hour unit it does not handle (« 18 h »). */
export function fr(text: string): string {
	return frTypo(text).replace(/(\d) h(?!\p{L})/gu, `$1${NBSP}h`);
}

// French plural starts at 2, English at anything but 1.
const pluralFr = (n: number, word: string) => `${word}${n > 1 ? "s" : ""}`;
const pluralEn = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;

/** Every string of the game, in French, raw: textFor() applies the typography. */
const french = {
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
		remaining: (n: number) => `Encore ${n} ${pluralFr(n, "carte")}.`,
		ready: "Plateau complet : sonnez « Service ! ».",
		added: (short: string) => `Posé : ${short}.`,
		removed: (short: string) => `Retiré : ${short}.`,
		full: "Le plateau est plein : retirez d'abord une carte.",
		checking: "Le chef contrôle le plateau…",
		served: "Validé : le service part en production.",
		refused: (traps: number) =>
			`Refusé : ${traps} ${pluralFr(traps, "piège")} sur le plateau.`,
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
			`Plateau : ${right} ${pluralFr(right, "geste")} ${pluralFr(right, "juste")} sur ${total}.`,
		bench: (found: number, total: number) =>
			`Banc d'essai : ${found} ${pluralFr(found, "assistant")} sur ${total} ${pluralFr(found, "passé")} en tête.`,
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

export type Copy = typeof french;

/** The same strings in British English: rewritten, not translated word for word. */
const english: Copy = {
	title: "Ready for service",
	intro:
		"An AI service is going live: build its tray, then help the team pick its coding assistant.",
	stepsLabel: "game steps",
	steps: ["the tray", "the test bench", "the debrief"],
	families: {
		production: "production",
		security: "security",
		docs: "documentation",
	},

	pick: {
		heading: "The tray",
		rules: [
			"An AI service has to go live. Of these ten cards, six are must-haves and four are traps.",
			"Put the right six on the tray, then ring “Service!” and the chef checks every card.",
		],
		cardsLabel: "candidate cards",
		add: "+ to the tray",
		onTray: "on the tray",
		service: "Service!",
		start: "Pick six cards.",
		remaining: (n: number) => `${n} more ${pluralEn(n, "card")} to go.`,
		ready: "Tray full: ring “Service!”",
		added: (short: string) => `Added: ${short}.`,
		removed: (short: string) => `Taken off: ${short}.`,
		full: "The tray is full: take a card off first.",
		checking: "The chef is checking the tray…",
		served: "Approved: the service goes live.",
		refused: (traps: number) =>
			`Sent back: ${traps} ${pluralEn(traps, "trap")} on the tray.`,
		count: (n: number, size: number) => `${n} / ${size}`,
		score: (right: number, total: number) => `${right} / ${total} right`,
		tallyLabel: "check by category",
		verdicts: {
			kept: "✓ good call",
			trap: "✗ trap",
			missed: "✗ missed",
			avoided: "✓ dodged",
		},
		next: "On to the test bench",
	},

	bench: {
		heading: "The test bench",
		rules: [
			"The team needs a coding assistant. Three fictional candidates are scored out of 10 on four criteria.",
			"Set what matters to the team and the ranking follows. Challenge: get each one into the lead at least once.",
		],
		weightsLegend: "What matters to the team",
		criteria: {
			quality: "code quality",
			context: "grasp of the repo",
			privacy: "data privacy",
			cost: "cost control",
		},
		levels: ["doesn't matter", "useful", "important", "essential"],
		notes: (list: string) => `scores: ${list}`,
		rankingLabel: "ranking",
		assistant: (letter: string) => `assistant ${letter}`,
		outOf: " out of 10",
		lead: (letter: string) => `In the lead: assistant ${letter}.`,
		even: "Equal weights: all three are level.",
		tie: "Tied at the top: nobody pulls ahead.",
		none: "No criterion counts: nothing separates them.",
		goalFound: ": has led already",
		goalMissing: ": hasn't led yet",
		challenge: (found: number, total: number) =>
			`Challenge: ${found} of ${total}. A ✓ marks each assistant that has led.`,
		firstLead: (letter: string, found: number, total: number) =>
			`Assistant ${letter} takes the lead: ${found} of ${total}.`,
		allFound:
			"Challenge complete: any of them can win. So a proper evaluation settles the criteria with the team first, then compares.",
		finish: "See the debrief",
	},

	end: {
		heading: "Station debrief",
		tray: (right: number, total: number) =>
			`Tray: ${right} of ${total} must-haves in place.`,
		bench: (found: number, total: number) =>
			`Test bench: ${found} of ${total} assistants took the lead.`,
		realTag: "for real",
		real: [
			"Shipping to production, securing, documenting: that has been Solim's work at Relyens since December 2025, on SARM, an AI service deployed for the technical department.",
			"The test bench shows his other role: as the go-to person for AI coding assistants, he ran their comparative evaluation, and its reports led to Claude Code being adopted.",
		],
		libraries:
			"In the same job, his internal libraries (LLM tooling, SDK) were adopted by the data science team.",
		fiction: "The cards, the assistants and their scores are fictional.",
		again: "Play again",
		back: "Back to the kitchen",
	},

	say: {
		start: "Six cards, not one more!",
		served: "We're live!",
		refused: "Sent back at the pass!",
		bench: "Your turn to weigh in!",
		lead: (letter: string) => `${letter} takes the lead!`,
		allFound: "Any of them can win!",
		perfect: "Beautiful service!",
		end: "And that's service!",
	},
};

/** Raw text, per language, with the same keys: a test checks the parity. */
export const copy: Record<Lang, Copy> = { fr: french, en: english };

/** Runs fr() through every string of a nested object, and on the result of every function. */
function typeset<T>(value: T): T {
	if (typeof value === "string") return fr(value) as T;
	if (typeof value === "function") {
		return ((...args: unknown[]) => typeset(value(...args))) as T;
	}
	if (Array.isArray(value)) return value.map(typeset) as T;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, typeset(entry)]),
		) as T;
	}
	return value;
}

export interface GameText {
	copy: Copy;
	cards: Record<CardId, CardText>;
}

/** Final text for one language: French typeset, English as written. */
export function textFor(lang: Lang): GameText {
	const text = { copy: copy[lang], cards: cardText[lang] };
	return lang === "fr" ? typeset(text) : text;
}
