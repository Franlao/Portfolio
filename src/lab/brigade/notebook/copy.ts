import type { Outcome } from "../../../components/demos/claims-agent/engine";
import type { Lang } from "../../../i18n/ui";
import { typographize } from "../../../lib/typo";

/**
 * The chef's notebook: where he keeps how each project works. Opened at the pass, it
 * shows how the agent handled the claims the visitor has just judged.
 */
const raw = {
	fr: {
		label: "Le carnet du chef",
		cover: "Carnet du chef",
		station: "Le passe",
		tonight: "Vos dossiers de ce soir",
		house: "Le dossier de la maison",
		houseNote:
			"Vous n'avez pas encore joué au passe ce soir : voici le dossier de la maison. Changez un ingrédient, l'agent refait la recette.",
		houseStory:
			"Lors d'une livraison, le camion d'un établissement assuré a endommagé le portail d'une maison voisine.",
		you: "Vous",
		agent: "L'agent",
		/** Read after each claim of the list. */
		same: "même décision que l'agent",
		different: "l'agent a décidé autrement",
		none: "pas de décision à temps",
		/** Who decided what, on a claim of the list. */
		verdict: (who: string, what: string) => `${who} : ${what}`,
		passed: "réussi",
		failed: "échoué",
		ingredients: "Les ingrédients",
		editHint: "Changez un ingrédient : l'agent refait la recette.",
		pieces: "Pièces reçues",
		delay: "Déclaré au bout de",
		quote: "Devis",
		circumstance: "Circonstances",
		days: (count: number) => `${count} jour${count > 1 ? "s" : ""}`,
		less: "Moins",
		more: "Plus",
		edited: "Dossier modifié",
		recipe: "La recette de l'agent",
		outcome: {
			offer: "Proposition d'indemnisation",
			missing: "Pièce réclamée",
			escalation: "Transmis à un gestionnaire",
		} satisfies Record<Outcome, string>,
		step: (n: number) => `Étape ${n}`,
		kinds: { code: "code", model: "modèle" },
		rule: "Règle",
		schema: (name: string) => `Sortie vérifiée : schéma ${name}`,
		routes: "La suite, décidée par le contrôle",
		legend: {
			code: "À la règle : du code",
			model: "À main levée, en bleu : un modèle",
			check: "Au crayon rouge : un contrôle",
		},
		replay: "Rejouer avec le chef",
		skip: "Tout afficher",
		full: "Lire la fiche complète du projet",
		close: "Refermer le carnet",
	},
	en: {
		label: "The chef's notebook",
		cover: "Chef's notebook",
		station: "The pass",
		tonight: "Your claims tonight",
		house: "The house claim",
		houseNote:
			"You haven't played at the pass tonight: here is the house claim. Change an ingredient and the agent cooks the recipe again.",
		houseStory:
			"During a delivery, an insured organisation's truck damaged the gate of a neighbouring house.",
		you: "You",
		agent: "The agent",
		same: "same decision as the agent",
		different: "the agent decided otherwise",
		none: "no decision in time",
		verdict: (who: string, what: string) => `${who}: ${what}`,
		passed: "passed",
		failed: "failed",
		ingredients: "The ingredients",
		editHint: "Change an ingredient: the agent cooks the recipe again.",
		pieces: "Documents received",
		delay: "Filed after",
		quote: "Repair quote",
		circumstance: "Circumstances",
		days: (count: number) => `${count} day${count > 1 ? "s" : ""}`,
		less: "Less",
		more: "More",
		edited: "Claim changed",
		recipe: "The agent's recipe",
		outcome: {
			offer: "Settlement offer",
			missing: "Document requested",
			escalation: "Handed to a claims handler",
		} satisfies Record<Outcome, string>,
		step: (n: number) => `Step ${n}`,
		kinds: { code: "code", model: "model" },
		rule: "Rule",
		schema: (name: string) => `Output checked: ${name} schema`,
		routes: "What comes next, decided by the check",
		legend: {
			code: "Ruled lines: code",
			model: "Freehand, in blue: a model",
			check: "Red pencil: a check",
		},
		replay: "Replay with the chef",
		skip: "Show everything",
		full: "Read the full project page",
		close: "Close the notebook",
	},
};

export const notebookCopy = {
	fr: typographize(raw.fr),
	en: raw.en,
} satisfies Record<Lang, unknown>;

export type NotebookCopy = (typeof notebookCopy)[Lang];
