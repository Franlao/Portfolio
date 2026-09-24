import type { Lang } from "../../../i18n/ui";
import { typographize } from "../../../lib/typo";
import type { CheckId, Circumstance, NodeId, PieceId } from "./engine";

interface Copy {
	nodes: Record<NodeId, string>;
	kinds: { code: string; model: string };
	pieces: Record<PieceId, string>;
	circumstances: Record<Circumstance, string>;
	checks: Record<CheckId, string>;
	rules: Partial<Record<NodeId, string>>;
	modelNote: string;
	offerNote: string;
	reasoning: Record<
		"reversing" | "storm" | "disputed" | "disputedWithStatement",
		string
	>;
	quotes: Record<
		"reversing" | "storm" | "disputed" | "disputedWithStatement",
		string
	>;
	letter: (amount: string, quote: string, shared: boolean) => string;
	missingLetter: (pieces: string) => string;
	escalation: string;
	summaries: {
		reception: (open: boolean, received: number) => string;
		classification: (count: number, minConfidence: string) => string;
		coverage: (
			withinDelay: boolean,
			quote: string | null,
			exceedsCeiling: boolean,
		) => string;
		consistency: (passed: number, total: number) => string;
		offer: (amount: string) => string;
		register: (count: number) => string;
		source: (piece: string) => string;
	};
	ui: {
		file: string;
		fileIntro: string;
		received: string;
		delay: string;
		delayUnit: (days: number) => string;
		delayHint: string;
		quoteAmount: string;
		quoteHint: string;
		circumstance: string;
		run: string;
		rerun: string;
		running: string;
		changed: string;
		idle: string;
		outcome: Record<"offer" | "missing" | "escalation", string>;
		journal: string;
		journalEmpty: string;
		input: string;
		output: string;
		rule: string;
		validated: (schema: string) => string;
		invalid: (schema: string) => string;
		graphLabel: string;
		notRun: string;
	};
}

const euro = (lang: Lang) =>
	new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
		style: "currency",
		currency: "EUR",
		maximumFractionDigits: 0,
	});

export const formatEuro = (lang: Lang, value: number) =>
	euro(lang).format(value);

const raw: Record<Lang, Copy> = {
	fr: {
		nodes: {
			reception: "Réception du dossier",
			classification: "Classement des pièces",
			coverage: "Contrôle du contrat",
			circumstances: "Analyse des circonstances",
			consistency: "Contrôle de cohérence",
			missing: "Demande de pièces",
			escalation: "Transmission à un gestionnaire",
			offer: "Proposition d'indemnisation",
			register: "Bordereau des pièces",
		},
		kinds: { code: "code", model: "modèle" },
		pieces: {
			declaration: "Déclaration de sinistre",
			photos: "Photos des dégâts",
			quote: "Devis de réparation",
			statement: "Attestation du tiers",
		},
		circumstances: {
			reversing: "Marche arrière pendant une livraison",
			storm: "Branche tombée pendant une tempête",
			disputed: "Le chauffeur conteste la version du voisin",
		},
		checks: {
			source: "La citation du modèle vient d'une pièce reçue",
			classified: "Chaque pièce reçue a été classée",
			required: "Les pièces obligatoires sont présentes",
			delay: "La déclaration respecte le délai",
			ceiling: "Le montant reste sous le plafond",
			liability: "La responsabilité est établie",
			exclusion: "Aucune exclusion n'est signalée",
		},
		rules: {
			reception:
				"La déclaration de sinistre est obligatoire pour ouvrir le dossier.",
			coverage:
				"Déclaration sous 5 jours. Plafond de 15 000 €. Franchise de 300 €.",
			consistency:
				"Pièce manquante : demande de pièces. Délai, plafond, responsabilité ou exclusion en défaut : gestionnaire. Sinon : proposition.",
			missing: "Liste les pièces obligatoires absentes et prépare la demande.",
			escalation: "Transmet le dossier avec la liste des contrôles en défaut.",
			register: "Numérote les pièces reçues dans l'ordre d'arrivée.",
		},
		modelNote:
			"Sortie du modèle pré-calculée pour la démo, puis contrôlée par le code.",
		offerNote:
			"Montants calculés par le code, courrier rédigé par le modèle (pré-calculé).",
		reasoning: {
			reversing:
				"Le chauffeur de l'assuré reconnaît avoir heurté le portail en reculant : la responsabilité de l'assuré est engagée.",
			storm:
				"Les dégâts viennent d'une branche tombée pendant une tempête : l'exclusion « événements climatiques » peut s'appliquer.",
			disputed:
				"Le chauffeur conteste la version du voisin. Sans attestation du tiers, la responsabilité ne peut pas être établie.",
			disputedWithStatement:
				"Les deux versions confirment le choc, mais le portail était déjà fragilisé : responsabilité partagée.",
		},
		quotes: {
			reversing:
				"En reculant pour décharger, le camion a heurté le portail du voisin.",
			storm:
				"Une branche est tombée sur le portail pendant la tempête de la nuit.",
			disputed: "Le chauffeur affirme que le portail était déjà endommagé.",
			disputedWithStatement:
				"Le camion a touché le portail, déjà fragilisé par un poteau descellé.",
		},
		letter: (amount, quote, shared) =>
			`Madame, Monsieur, suite au sinistre survenu lors d'une livraison, nous vous proposons une indemnité de ${amount}, calculée sur votre devis de ${quote}${shared ? ", avec une responsabilité partagée à parts égales" : ""}, franchise déduite.`,
		missingLetter: (pieces) =>
			`Pour poursuivre le traitement de votre dossier, merci de nous transmettre : ${pieces}.`,
		escalation: "Dossier transmis à un gestionnaire pour décision.",
		summaries: {
			reception: (open, n) =>
				open
					? `Dossier ouvert : ${n} pièce${n > 1 ? "s" : ""} reçue${n > 1 ? "s" : ""}.`
					: "Dossier non ouvert : la déclaration de sinistre manque.",
			classification: (n, min) =>
				`${n} pièce${n > 1 ? "s" : ""} classée${n > 1 ? "s" : ""}, confiance minimale de ${min}.`,
			coverage: (within, quote, exceeds) =>
				`${within ? "Déclaration dans les délais" : "Déclaration hors délai"}. ${
					quote === null
						? "Aucun devis reçu."
						: `Devis de ${quote}, ${exceeds ? "au-dessus du plafond" : "sous le plafond"}.`
				}`,
			consistency: (passed, total) =>
				`${passed} contrôles passés sur ${total}.`,
			offer: (amount) => `Indemnité proposée : ${amount}.`,
			register: (n) =>
				`${n} pièce${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""}.`,
			source: (piece) => `Citation tirée de : ${piece}`,
		},
		ui: {
			file: "Dossier SIN-2026-0412",
			fileIntro:
				"Lors d'une livraison, le camion d'un établissement assuré a endommagé le portail d'une maison voisine. Données fictives.",
			received: "Pièces reçues",
			delay: "Délai de déclaration",
			delayUnit: (days) => `${days} jour${days > 1 ? "s" : ""}`,
			delayHint: "Le contrat demande 5 jours au plus.",
			quoteAmount: "Montant du devis",
			quoteHint: "Plafond de garantie : 15 000 €.",
			circumstance: "Circonstances",
			run: "Traiter le dossier",
			rerun: "Traiter à nouveau",
			running: "Traitement en cours",
			changed:
				"Dossier modifié. Relancez le traitement pour voir le nouveau parcours.",
			idle: "Modifiez le dossier si vous le souhaitez, puis lancez le traitement.",
			outcome: {
				offer: "Issue : proposition d'indemnisation envoyée.",
				missing: "Issue : pièces demandées à l'assuré.",
				escalation: "Issue : dossier transmis à un gestionnaire.",
			},
			journal: "Journal d'audit",
			journalEmpty: "Le journal se remplit à chaque étape exécutée.",
			input: "Entrée",
			output: "Sortie",
			rule: "Règle",
			validated: (schema) => `Sortie conforme au schéma ${schema}`,
			invalid: (schema) => `Sortie non conforme au schéma ${schema}`,
			graphLabel:
				"Graphe du traitement. Chaque étape est aussi détaillée dans le journal d'audit.",
			notRun: "non exécutée",
		},
	},
	en: {
		nodes: {
			reception: "File intake",
			classification: "Document classification",
			coverage: "Policy check",
			circumstances: "Circumstance analysis",
			consistency: "Consistency check",
			missing: "Request documents",
			escalation: "Hand over to a claims handler",
			offer: "Settlement offer",
			register: "Document register",
		},
		kinds: { code: "code", model: "model" },
		pieces: {
			declaration: "Claim form",
			photos: "Photos of the damage",
			quote: "Repair quote",
			statement: "Third-party statement",
		},
		circumstances: {
			reversing: "Reversing during a delivery",
			storm: "Branch fell during a storm",
			disputed: "The driver disputes the neighbour's account",
		},
		checks: {
			source: "The model's quote comes from a received document",
			classified: "Every received document has been classified",
			required: "All mandatory documents are present",
			delay: "The claim was filed on time",
			ceiling: "The amount stays under the ceiling",
			liability: "Liability is established",
			exclusion: "No exclusion is flagged",
		},
		rules: {
			reception: "A claim form is required to open the file.",
			coverage:
				"Claim filed within 5 days. Ceiling of €15,000. Deductible of €300.",
			consistency:
				"Missing document: request documents. Delay, ceiling, liability or exclusion failing: claims handler. Otherwise: offer.",
			missing: "Lists the missing mandatory documents and drafts the request.",
			escalation: "Hands the file over with the list of failing checks.",
			register: "Numbers the received documents in order of arrival.",
		},
		modelNote: "Model output precomputed for the demo, then checked by code.",
		offerNote:
			"Amounts computed by code, letter drafted by the model (precomputed).",
		reasoning: {
			reversing:
				"The insured's driver admits hitting the gate while reversing: the insured is liable.",
			storm:
				"The damage comes from a branch that fell during a storm: the weather-event exclusion may apply.",
			disputed:
				"The driver disputes the neighbour's account. Without a third-party statement, liability cannot be established.",
			disputedWithStatement:
				"Both accounts confirm the impact, but the gate was already weakened: liability is shared.",
		},
		quotes: {
			reversing:
				"While reversing to unload, the truck hit the neighbour's gate.",
			storm: "A branch fell on the gate during the storm last night.",
			disputed: "The driver says the gate was already damaged.",
			disputedWithStatement:
				"The truck touched the gate, which was already loose on a broken post.",
		},
		letter: (amount, quote, shared) =>
			`Dear Sir or Madam, following the incident during a delivery, we offer you a settlement of ${amount}, based on your repair quote of ${quote}${shared ? ", with liability shared equally" : ""}, less the deductible.`,
		missingLetter: (pieces) =>
			`To continue processing your claim, please send us: ${pieces}.`,
		escalation: "File handed over to a claims handler for a decision.",
		summaries: {
			reception: (open, n) =>
				open
					? `File opened: ${n} document${n > 1 ? "s" : ""} received.`
					: "File not opened: the claim form is missing.",
			classification: (n, min) =>
				`${n} document${n > 1 ? "s" : ""} classified, lowest confidence ${min}.`,
			coverage: (within, quote, exceeds) =>
				`${within ? "Filed on time" : "Filed late"}. ${
					quote === null
						? "No repair quote received."
						: `Repair quote of ${quote}, ${exceeds ? "above the ceiling" : "under the ceiling"}.`
				}`,
			consistency: (passed, total) => `${passed} of ${total} checks passed.`,
			offer: (amount) => `Settlement offered: ${amount}.`,
			register: (n) => `${n} document${n > 1 ? "s" : ""} registered.`,
			source: (piece) => `Quoted from: ${piece}`,
		},
		ui: {
			file: "Claim SIN-2026-0412",
			fileIntro:
				"During a delivery, an insured organisation's truck damaged the gate of a neighbouring house. Fictional data.",
			received: "Documents received",
			delay: "Time to file the claim",
			delayUnit: (days) => `${days} day${days > 1 ? "s" : ""}`,
			delayHint: "The policy allows 5 days at most.",
			quoteAmount: "Repair quote",
			quoteHint: "Coverage ceiling: €15,000.",
			circumstance: "Circumstances",
			run: "Process the claim",
			rerun: "Process again",
			running: "Processing",
			changed: "The claim has changed. Process it again to see the new path.",
			idle: "Change the claim if you like, then process it.",
			outcome: {
				offer: "Outcome: settlement offer sent.",
				missing: "Outcome: documents requested from the insured.",
				escalation: "Outcome: file handed over to a claims handler.",
			},
			journal: "Audit log",
			journalEmpty: "The log fills in as each step runs.",
			input: "Input",
			output: "Output",
			rule: "Rule",
			validated: (schema) => `Output matches the ${schema} schema`,
			invalid: (schema) => `Output does not match the ${schema} schema`,
			graphLabel:
				"Processing graph. Every step is also detailed in the audit log.",
			notRun: "not run",
		},
	},
};

export const copy: Record<Lang, Copy> = {
	fr: typographize(raw.fr),
	en: raw.en,
};
