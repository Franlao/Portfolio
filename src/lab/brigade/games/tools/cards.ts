import type { Lang } from "../types";
import type { CardId } from "./logic";

export interface CardText {
	/** The action written on the card, as an instruction. */
	label: string;
	/** Short name for the tray slots and the feedback, 20 characters at most. */
	short: string;
	/** Why the chef wants it (needed card) or refuses it (trap). */
	reason: string;
	/** What the chef shouts when this trap reaches the pass, under 30 characters. Traps only. */
	shout?: string;
}

/**
 * The words on every card, per language, keyed by the ids of logic.ts.
 * French is raw here: textFor() in copy.ts applies the typography.
 */
export const cardText: Record<Lang, Record<CardId, CardText>> = {
	fr: {
		// Production: needed.
		tests: {
			label: "Faire passer les tests automatisés avant chaque mise en ligne",
			short: "tests automatisés",
			reason: "Une régression est arrêtée avant d'atteindre les utilisateurs.",
		},
		rollback: {
			label: "Prévoir un retour arrière en une commande",
			short: "retour arrière",
			reason: "Si la nouvelle version déraille, l'ancienne revient aussitôt.",
		},
		"rate-limit": {
			label: "Plafonner le débit des appels au modèle",
			short: "limites de débit",
			reason: "Un pic de trafic ne fait exploser ni la facture ni le service.",
		},
		"call-logs": {
			label: "Journaliser chaque appel au modèle : durée, erreurs, volume",
			short: "journal des appels",
			reason: "Au premier incident, on sait ce qui s'est passé, et quand.",
		},
		alerts: {
			label: "Brancher des alertes sur les erreurs et la lenteur",
			short: "alertes",
			reason:
				"L'équipe est prévenue avant que les utilisateurs ne se plaignent.",
		},
		fallback: {
			label: "Prévoir une réponse de secours quand le modèle ne répond pas",
			short: "plan de secours",
			reason: "Une panne du fournisseur ne bloque pas tout le monde.",
		},
		"shared-library": {
			label: "Appeler le modèle par la librairie partagée de l'équipe",
			short: "librairie partagée",
			reason:
				"Reprises, journaux et limites sont réglés une fois, pour tous les projets.",
		},
		// Production: traps.
		"skip-tests": {
			label: "Désactiver les tests pour livrer plus vite",
			short: "tests coupés",
			reason: "Le temps gagné aujourd'hui se paie en panne demain.",
			shout: "Sans les tests ?!",
		},
		friday: {
			label: "Déployer le vendredi à 18 h, sans retour arrière",
			short: "vendredi 18 h",
			reason:
				"Au premier incident, personne n'est là et rien ne peut être annulé.",
			shout: "Un vendredi à 18 h ?!",
		},
		"auto-upgrade": {
			label: "Passer à chaque nouvelle version du modèle dès sa sortie",
			short: "modèle non réévalué",
			reason:
				"Sans réévaluation, les réponses changent sans que personne ne l'ait vérifié.",
			shout: "Et la réévaluation ?!",
		},
		// Security: needed.
		vault: {
			label: "Ranger la clé d'API dans un coffre-fort de secrets",
			short: "coffre-fort",
			reason: "La clé ne traîne ni dans le code ni dans l'historique.",
		},
		"security-review": {
			label: "Faire relire la sécurité avant l'ouverture",
			short: "revue de sécurité",
			reason: "Un regard extérieur repère ce que l'équipe ne voit plus.",
		},
		access: {
			label: "Réserver l'accès aux équipes autorisées",
			short: "accès restreint",
			reason: "Le service n'est ouvert qu'à ceux qui en ont besoin.",
		},
		"input-filter": {
			label: "Filtrer les entrées avant de les confier au modèle",
			short: "entrées filtrées",
			reason: "Une requête piégée est arrêtée à la porte.",
		},
		// Security: traps.
		"key-in-code": {
			label: "Coller la clé d'API directement dans le code",
			short: "clé dans le code",
			reason: "Au premier partage du dépôt, la clé fuit avec lui.",
			shout: "La clé dans le code ?!",
		},
		"clear-logs": {
			label: "Journaliser les données personnelles en clair, pour déboguer",
			short: "données en clair",
			reason: "Les journaux deviennent une fuite de données en attente.",
			shout: "Des données en clair ?!",
		},
		admin: {
			label:
				"Donner au service les droits d'administrateur, pour éviter les blocages",
			short: "droits d'admin",
			reason: "Au moindre détournement, toutes les portes sont ouvertes.",
			shout: "Tous les droits ?!",
		},
		// Documentation: needed.
		runbook: {
			label:
				"Rédiger le guide d'exploitation : relancer, diagnostiquer, alerter",
			short: "guide d'exploitation",
			reason: "L'astreinte sait quoi faire sans appeler l'auteur.",
		},
		"api-doc": {
			label: "Documenter l'API pour les équipes qui l'appellent",
			short: "doc de l'API",
			reason: "Les équipes branchent le service sans deviner les formats.",
		},
		"known-limits": {
			label:
				"Écrire ce que le service sait faire, et ce qu'il ne sait pas faire",
			short: "limites connues",
			reason:
				"Personne ne lui confie une tâche pour laquelle il n'est pas fait.",
		},
		// Documentation: traps.
		"code-is-doc": {
			label: "Laisser le code servir de documentation",
			short: "le code pour doc",
			reason:
				"Le code dit comment, pas pourquoi, ni quoi faire en cas de panne.",
			shout: "Le code, une doc ?!",
		},
		"doc-later": {
			label: "Documenter après le lancement, quand ce sera calme",
			short: "doc à plus tard",
			reason: "Après un lancement, ce n'est jamais calme.",
			shout: "Ce ne sera jamais calme !",
		},
	},

	en: {
		// Production: needed.
		tests: {
			label: "Run the automated tests before every release",
			short: "automated tests",
			reason: "A regression is caught before it reaches users.",
		},
		rollback: {
			label: "Have a one-command rollback ready",
			short: "rollback",
			reason:
				"If the new version goes off the rails, the old one is straight back.",
		},
		"rate-limit": {
			label: "Cap the rate of calls to the model",
			short: "rate limits",
			reason: "A traffic spike can't blow up the bill or the service.",
		},
		"call-logs": {
			label: "Log every call to the model: duration, errors, volume",
			short: "call log",
			reason: "At the first incident, you know what happened, and when.",
		},
		alerts: {
			label: "Set up alerts on errors and slow responses",
			short: "alerts",
			reason: "The team hears about it before users start complaining.",
		},
		fallback: {
			label: "Have a fallback answer ready for when the model goes quiet",
			short: "fallback",
			reason: "A provider outage doesn't leave everyone stuck.",
		},
		"shared-library": {
			label: "Call the model through the team's shared library",
			short: "shared library",
			reason: "Retries, logs and limits are set once, for every project.",
		},
		// Production: traps.
		"skip-tests": {
			label: "Switch off the tests to ship faster",
			short: "tests switched off",
			reason: "Time saved today is paid back in outages tomorrow.",
			shout: "Without the tests?!",
		},
		friday: {
			label: "Deploy at 6pm on a Friday, with no rollback",
			short: "Friday 6pm",
			reason:
				"At the first incident, nobody's around and nothing can be undone.",
			shout: "At 6pm on a Friday?!",
		},
		"auto-upgrade": {
			label: "Switch to every new model version the day it comes out",
			short: "unevaluated model",
			reason:
				"Without re-evaluation, the answers change and nobody has checked them.",
			shout: "Without re-evaluating?!",
		},
		// Security: needed.
		vault: {
			label: "Keep the API key in a secrets vault",
			short: "secrets vault",
			reason: "The key never lies around in the code or the commit history.",
		},
		"security-review": {
			label: "Get a security review before launch",
			short: "security review",
			reason: "Fresh eyes spot what the team no longer sees.",
		},
		access: {
			label: "Restrict access to authorised teams",
			short: "restricted access",
			reason: "The service is open only to those who need it.",
		},
		"input-filter": {
			label: "Filter inputs before handing them to the model",
			short: "filtered inputs",
			reason: "A booby-trapped request is stopped at the door.",
		},
		// Security: traps.
		"key-in-code": {
			label: "Paste the API key straight into the code",
			short: "key in the code",
			reason: "The first time the repo is shared, the key leaks with it.",
			shout: "The key in the code?!",
		},
		"clear-logs": {
			label: "Log personal data in plain text, for debugging",
			short: "plain-text data",
			reason: "The logs become a data leak waiting to happen.",
			shout: "Plain-text personal data?!",
		},
		admin: {
			label: "Give the service admin rights, so nothing ever blocks it",
			short: "admin rights",
			reason: "If it's ever hijacked, every door is open.",
			shout: "Full admin rights?!",
		},
		// Documentation: needed.
		runbook: {
			label: "Write the runbook: restart, diagnose, raise the alarm",
			short: "runbook",
			reason: "Whoever's on call knows what to do without ringing the author.",
		},
		"api-doc": {
			label: "Document the API for the teams that call it",
			short: "API docs",
			reason: "Teams plug the service in without guessing the formats.",
		},
		"known-limits": {
			label: "Write down what the service can do, and what it can't",
			short: "known limits",
			reason: "Nobody hands it a job it wasn't built for.",
		},
		// Documentation: traps.
		"code-is-doc": {
			label: "Let the code serve as the documentation",
			short: "code as docs",
			reason: "Code says how, not why, nor what to do when it breaks.",
			shout: "Code as documentation?!",
		},
		"doc-later": {
			label: "Document after launch, once things calm down",
			short: "docs later",
			reason: "After a launch, things never calm down.",
			shout: "Things never calm down!",
		},
	},
};
