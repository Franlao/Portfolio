import { frTypo } from "../../../../lib/typo";
import type { Lang } from "../types";
import type { FieldId, Role } from "./logic";

/**
 * « Rien ne sort » / “Nothing gets out”: every string the game shows, in both languages.
 * Strings stay raw here; the game applies each language's typography when it writes them,
 * so the report's values inserted into a sentence get it too.
 */

// Written as a char code so the invisible character stays readable in the source.
const NBSP = String.fromCharCode(0x00a0);

/** frTypo, plus the units this game uses (mg, g, octets) and « n° 0417 », which must not break. */
export function fr(text: string): string {
	return frTypo(text)
		.replace(/(\d) (mg|g|octets?)(?!\p{L})/gu, `$1${NBSP}$2`)
		.replace(/n° (?=\d)/g, `n°${NBSP}`)
		.replace(/ × /g, `${NBSP}×${NBSP}`);
}

/** No frTypo in English: only keep numbers with their units, and "no. 0417" in one piece. */
export function en(text: string): string {
	return text
		.replace(/(\d) (mg|g|seconds?|bytes?)(?!\p{L})/gu, `$1${NBSP}$2`)
		.replace(/\bno\. (?=\d)/g, `no.${NBSP}`)
		.replace(/ × /g, `${NBSP}×${NBSP}`);
}

export const typo: Record<Lang, (text: string) => string> = { fr, en };

export interface FieldCopy {
	/** Short label, shown in the sheet. */
	label: string;
	/** The label with its article, for sentences (« Il fallait la date d'entrée »). */
	article: string;
	/** One line that tells a non-doctor what to look for. */
	hint: string;
}

export interface Copy {
	title: string;
	intro: string;
	/** Heading of the fictional report, and first line of what would have been sent. */
	reportTitle: string;
	/** Accessible name of the report. */
	reportLabel: string;
	fields: Record<FieldId, FieldCopy>;
	/** How a wrong click is explained: « Ce passage donne … ». */
	roles: Record<Role, string>;
	number(value: number): string;
	percent(confidence: number): string;
	room: {
		stamp: string;
		door: string;
		bytesRead: string;
		bytesOut: string;
		envelope(bytes: number): string;
	};
	task: {
		instruction: string;
		step(n: number, total: number): string;
		already(label: string): string;
		results: string;
		tempt: string;
		refused: string;
		carriesOn: string;
		locked: string;
		doneStep: string;
		doneAsk: string;
		doneHint: string;
	};
	sheet: {
		heading: string;
		note: string;
		field: string;
		you: string;
		model: string;
		/** Words for screen readers, next to a dash, a ✓ or a ✗. */
		empty: string;
		right: string;
		wrong: string;
		expected(value: string): string;
		reading: string;
		ready: string;
		hidden: string;
		confidence: string;
		review: string;
		filed: string;
	};
	announce: {
		next(label: string): string;
		filled: string;
		offer: string;
		refused(bytesOut: number): string;
	};
	feedback: {
		right(expected: string): string;
		wrong(phrase: string, article: string, expected: string): string;
		reading: string;
		trust(percent: string, review: boolean): string;
		sameMistake(trust: string): string;
		modelWrong(value: string, trust: string): string;
		same(trust: string): string;
		modelRight(trust: string): string;
	};
	end: {
		heading: string;
		score(player: number, total: number, seconds: number): string;
		model(score: number, total: number, detail: string): string;
		/** The model's only mistake was also its least confident field. */
		missIsWeakest(article: string, low: string): string;
		weakest(low: string, article: string): string;
		doorTempted(bytesOut: number): string;
		doorCalm(bytesOut: number): string;
		lesson: string;
		/** Only facts of the actual project. */
		real: string;
		fiction: string;
		again: string;
		back: string;
	};
	/** The chef's bubbles, under 30 characters each. */
	chef: {
		start: string;
		replay: string;
		right: string[];
		wrong: string[];
		refused: string;
		perfect: string;
		done: string;
	};
}

const frNumber = new Intl.NumberFormat("fr-FR");
const enNumber = new Intl.NumberFormat("en-GB");
const enPercent = new Intl.NumberFormat("en-GB", { style: "percent" });

const frCopy: Copy = {
	title: "Rien ne sort",
	intro:
		"Remplissez la fiche en cliquant les bons passages du compte rendu, pendant qu'un modèle local remplit la sienne, sans que rien ne quitte la pièce.",
	reportTitle: "Compte rendu d'hospitalisation · document fictif",
	reportLabel: "Compte rendu fictif",
	fields: {
		entry: {
			label: "date d'entrée",
			article: "la date d'entrée",
			hint: "Le jour où le patient est hospitalisé.",
		},
		reason: {
			label: "motif d'hospitalisation",
			article: "le motif d'hospitalisation",
			hint: "Ce qui l'amène à l'hôpital, avant tout diagnostic.",
		},
		history: {
			label: "antécédent personnel",
			article: "l'antécédent personnel",
			hint: "Une maladie ou une opération passée du patient lui-même.",
		},
		discharge: {
			label: "traitement de sortie",
			article: "le traitement de sortie",
			hint: "Le médicament prescrit en quittant l'hôpital.",
		},
		dosage: {
			label: "posologie de sortie",
			article: "la posologie de sortie",
			hint: "La dose de ce médicament de sortie.",
		},
	},
	roles: {
		entry: "la date d'entrée",
		reason: "le motif d'hospitalisation",
		history: "l'antécédent personnel",
		discharge: "le traitement de sortie",
		dosage: "la posologie de sortie",
		consult: "une date de consultation, avant l'entrée",
		exit: "la date de sortie",
		diagnosis: "le diagnostic, posé pendant le séjour",
		family: "un antécédent familial, pas celui du patient",
		usual: "le traitement habituel, d'avant l'hospitalisation",
		usualDose: "la posologie du traitement habituel",
	},
	number: (value) => frNumber.format(value),
	percent: (confidence) => `${Math.round(confidence * 100)} %`,
	room: {
		stamp: "Refusé",
		door: "porte de la pièce",
		bytesRead: "Octets lus sur place",
		bytesOut: "Octets sortis de la pièce",
		envelope: (bytes) => `compte rendu · ${frNumber.format(bytes)} octets`,
	},
	task: {
		instruction:
			"Cliquez, dans le compte rendu, le passage qui remplit ce champ.",
		step: (n, total) => `champ ${n} sur ${total}`,
		already: (label) =>
			`Ce passage est déjà dans la fiche, au champ « ${label} ».`,
		results: "Voir le bilan",
		tempt: "Envoyer au service en ligne pour aller plus vite",
		refused: "Refusé par la porte : rien ne quitte la pièce.",
		carriesOn: "Le modèle local continue, sur place.",
		locked: "Porte verrouillée : ici, le modèle vient aux données.",
		doneStep: "fiche remplie",
		doneAsk: "Les deux fiches sont prêtes.",
		doneHint: "Comparez-les dans le tableau, puis voyez le bilan.",
	},
	sheet: {
		heading: "La fiche",
		note: "Le modèle local remplit la sienne en même temps. Chaque réponse reste cachée jusqu'à la vôtre, avec sa confiance.",
		field: "champ",
		you: "vous",
		model: "modèle local",
		empty: "vide",
		right: "juste",
		wrong: "faux",
		expected: (value) => `attendu : ${value}`,
		reading: "lecture…",
		ready: "prêt",
		hidden: "caché jusqu'à votre réponse",
		confidence: "confiance",
		review: "à relire",
		filed: "dans la fiche",
	},
	announce: {
		next: (label) => `Champ suivant : ${label}.`,
		filled: "Fiche remplie.",
		offer:
			"Nouveau : un bouton propose d'envoyer le compte rendu à un service en ligne.",
		refused: (bytesOut) =>
			`Refusé : la porte ne s'ouvre pas. Rien ne quitte la pièce. Octets sortis : ${frNumber.format(bytesOut)}. Le modèle local continue, sur place.`,
	},
	feedback: {
		right: (expected) => `✓ Juste : « ${expected} ».`,
		wrong: (phrase, article, expected) =>
			`✗ Ce passage donne ${phrase}. Il fallait ${article} : « ${expected} ».`,
		reading: "Le modèle local lit encore ce passage.",
		trust: (percent, review) =>
			`confiance ${percent}${review ? ", à relire" : ""}`,
		sameMistake: (trust) => `Le modèle a fait la même erreur, ${trust}.`,
		modelWrong: (value, trust) =>
			`Le modèle s'est trompé : « ${value} », ${trust}.`,
		same: (trust) => `Le modèle a écrit la même chose, ${trust}.`,
		modelRight: (trust) => `Le modèle, lui, avait vu juste, ${trust}.`,
	},
	end: {
		heading: "Fiche complète",
		score: (player, total, seconds) => {
			const s = player > 1 ? "s" : "";
			return `Vous : ${player} champ${s} juste${s} sur ${total}, en ${seconds} s.`;
		},
		model: (score, total, detail) =>
			`Le modèle local : ${score} sur ${total}. ${detail}`,
		missIsWeakest: (article, low) =>
			`Son erreur, sur ${article}, portait sa confiance la plus basse (${low}) : c'est là qu'on relit.`,
		weakest: (low, article) =>
			`Sa confiance la plus basse (${low}) portait sur ${article} : c'est le champ à relire en premier.`,
		doorTempted: (bytesOut) =>
			`Octets sortis de la pièce : ${frNumber.format(bytesOut)}. Vous avez tenté le service en ligne, la porte a tenu.`,
		doorCalm: (bytesOut) =>
			`Octets sortis de la pièce : ${frNumber.format(bytesOut)}. Au prochain service, essayez le bouton « Envoyer au service en ligne » : la porte vous attend.`,
		lesson: "Le modèle vient aux données, pas l'inverse.",
		real: "Le vrai projet, au CHU de Lille de mars à août 2024 : extraire des données structurées de comptes rendus médicaux avec des LLM open source (Llama 3.1, Mistral 7B, Gemma) exécutés en local, sous contrainte de confidentialité. Un pipeline RAG local (Ollama, ChromaDB, HuggingFace) permet de valoriser plus de 10 ans de comptes rendus non structurés pour de futures études cliniques.",
		fiction:
			"Le compte rendu de ce jeu est fictif : patient, dates et valeurs sont inventés.",
		again: "Rejouer avec un autre compte rendu",
		back: "Revenir à la cuisine",
	},
	chef: {
		start: "Rien ne sort d'ici !",
		replay: "Nouveau compte rendu !",
		right: ["Bien lu !", "Exact !", "Dans la fiche !"],
		wrong: ["Relisez bien !", "Pas ce passage !"],
		refused: "Rien ne quitte la pièce !",
		perfect: "Fiche parfaite !",
		done: "Fiche complète !",
	},
};

// British English, rewritten rather than translated. "Form" stands for « fiche »,
// as in a clinical case report form; "report" for « compte rendu ».
const enCopy: Copy = {
	title: "Nothing gets out",
	intro:
		"Fill in the form by clicking the right passages in the report, while a local model fills in its own, and nothing leaves the room.",
	reportTitle: "Hospital discharge summary · fictional document",
	reportLabel: "Fictional report",
	fields: {
		entry: {
			label: "admission date",
			article: "the admission date",
			hint: "The day the patient is admitted to hospital.",
		},
		reason: {
			label: "reason for admission",
			article: "the reason for admission",
			hint: "What brings them into hospital, before any diagnosis.",
		},
		history: {
			label: "past medical history",
			article: "the past medical history",
			hint: "An illness or operation the patient has had themselves.",
		},
		discharge: {
			label: "discharge medication",
			article: "the discharge medication",
			hint: "The drug prescribed when leaving hospital.",
		},
		dosage: {
			label: "discharge dose",
			article: "the discharge dose",
			hint: "How much of that discharge drug, and how often.",
		},
	},
	roles: {
		entry: "the admission date",
		reason: "the reason for admission",
		history: "the past medical history",
		discharge: "the discharge medication",
		dosage: "the discharge dose",
		consult: "a consultation date, before admission",
		exit: "the discharge date",
		diagnosis: "the diagnosis, made during the stay",
		family: "a family history, not the patient's own",
		usual: "the regular medication, from before admission",
		usualDose: "the dose of the regular medication",
	},
	number: (value) => enNumber.format(value),
	percent: (confidence) => enPercent.format(confidence),
	room: {
		stamp: "Denied",
		door: "door to the room",
		bytesRead: "Bytes read on site",
		bytesOut: "Bytes that left the room",
		envelope: (bytes) => `report · ${enNumber.format(bytes)} bytes`,
	},
	task: {
		instruction: "In the report, click the passage that fills this field.",
		step: (n, total) => `field ${n} of ${total}`,
		already: (label) =>
			`That passage is already on the form, under “${label}”.`,
		results: "See the results",
		tempt: "Send to the online service to go faster",
		refused: "Denied at the door: nothing leaves the room.",
		carriesOn: "The local model keeps working on site.",
		locked: "Door locked: here, the model comes to the data.",
		doneStep: "form filled in",
		doneAsk: "Both forms are ready.",
		doneHint: "Compare them in the table, then see the results.",
	},
	sheet: {
		heading: "The form",
		note: "The local model fills in its own as you go. Each answer stays hidden until you've given yours, with its confidence.",
		field: "field",
		you: "you",
		model: "local model",
		empty: "empty",
		right: "right",
		wrong: "wrong",
		expected: (value) => `expected: ${value}`,
		reading: "reading…",
		ready: "ready",
		hidden: "hidden until you answer",
		confidence: "confidence",
		review: "needs review",
		filed: "on the form",
	},
	announce: {
		next: (label) => `Next field: ${label}.`,
		filled: "Form filled in.",
		offer: "New: a button offers to send the report to an online service.",
		refused: (bytesOut) =>
			`Denied: the door won't open. Nothing leaves the room. Bytes out: ${enNumber.format(bytesOut)}. The local model keeps working on site.`,
	},
	feedback: {
		right: (expected) => `✓ Right: “${expected}”.`,
		wrong: (phrase, article, expected) =>
			`✗ That passage gives ${phrase}. This field needs ${article}: “${expected}”.`,
		reading: "The local model is still reading this passage.",
		trust: (percent, review) =>
			`confidence ${percent}${review ? ", needs review" : ""}`,
		sameMistake: (trust) => `The model made the same mistake, ${trust}.`,
		modelWrong: (value, trust) =>
			`The model got it wrong: “${value}”, ${trust}.`,
		same: (trust) => `The model wrote the same, ${trust}.`,
		modelRight: (trust) => `The model got this one right, ${trust}.`,
	},
	end: {
		heading: "Form complete",
		score: (player, total, seconds) =>
			`You: ${player} out of ${total} fields right, in ${seconds} second${seconds === 1 ? "" : "s"}.`,
		model: (score, total, detail) =>
			`The local model: ${score} out of ${total}. ${detail}`,
		missIsWeakest: (article, low) =>
			`Its mistake, on ${article}, came with its lowest confidence (${low}): that's where a human looks again.`,
		weakest: (low, article) =>
			`Its lowest confidence (${low}) was on ${article}: that's the field to review first.`,
		doorTempted: (bytesOut) =>
			`Bytes that left the room: ${enNumber.format(bytesOut)}. You tried the online service, and the door held.`,
		doorCalm: (bytesOut) =>
			`Bytes that left the room: ${enNumber.format(bytesOut)}. Next service, try the “Send to the online service” button: the door is waiting for you.`,
		lesson: "The model comes to the data, not the other way round.",
		real: "The real project, at CHU de Lille (Lille University Hospital) from March to August 2024: extracting structured data from medical reports with open-source LLMs (Llama 3.1, Mistral 7B, Gemma) running locally, under strict confidentiality. A local RAG pipeline (Ollama, ChromaDB, HuggingFace) puts more than 10 years of unstructured reports to use for future clinical studies.",
		fiction:
			"The report in this game is fictional: the patient, dates and values are all made up.",
		again: "Play again with another report",
		back: "Back to the kitchen",
	},
	chef: {
		start: "Nothing gets out of here!",
		replay: "New report in!",
		right: ["Well read!", "Spot on!", "Onto the form!"],
		wrong: ["Read it again!", "Not that line!"],
		refused: "Nothing leaves this room!",
		perfect: "Perfect form!",
		done: "Form complete!",
	},
};

export const COPY: Record<Lang, Copy> = { fr: frCopy, en: enCopy };
