import type { Lang } from "../types";

/**
 * Content of « La réserve qui se range seule ». Everything here is fictional:
 * a made-up water damage claim, its shelves, and the pieces that arrive one by one.
 * The summaries a model would write are pre-written as fragments (gist, brief) and replayed.
 *
 * The structure (which piece belongs on which shelf) is written once; only the text exists per
 * language, keyed by id. So a game deals, files and scores the same way in French and in English.
 */

// frTypo does not know every unit (m², h): those get their non-breaking space here.
const NBSP = String.fromCharCode(0x00a0);

// English amounts follow en-GB conventions (€3,480); French ones are left raw for frTypo.
const euro = new Intl.NumberFormat("en-GB", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});
const eur = (value: number) => euro.format(value);

/** French agreement: singular for 0 and 1. */
const s = (n: number) => (n > 1 ? "s" : "");

export type ShelfId = "damage" | "amounts" | "liability" | "followup";

/** In display order: shelf n answers key n. */
export const shelves: readonly ShelfId[] = [
	"damage",
	"amounts",
	"liability",
	"followup",
];

interface Slot {
	id: string;
	shelf: ShelfId;
}

/** Already indexed when the game starts: the amounts shelf is still empty. */
export const initialPieces = [
	{ id: "declaration", shelf: "damage" },
	{ id: "constat", shelf: "liability" },
	{ id: "receipt", shelf: "followup" },
] as const satisfies readonly Slot[];

// Several crates look like they belong elsewhere (a plumber's invoice, a lawyer's letter):
// the game is about filing a piece by what it says, not by who sent it.
export const crates = [
	{ id: "photos", shelf: "damage" },
	{ id: "tenant-mail", shelf: "damage" },
	{ id: "electrician", shelf: "damage" },
	{ id: "floor-quote", shelf: "amounts" },
	{ id: "plumber-invoice", shelf: "amounts" },
	{ id: "paint-quote", shelf: "amounts" },
	{ id: "lawyer", shelf: "liability" },
	{ id: "plumber-report", shelf: "liability" },
	{ id: "caretaker", shelf: "liability" },
	{ id: "expert-mail", shelf: "followup" },
	{ id: "reminder", shelf: "followup" },
	{ id: "syndic", shelf: "followup" },
] as const satisfies readonly Slot[];

export type IndexedId = (typeof initialPieces)[number]["id"];
export type CrateId = (typeof crates)[number]["id"];
export type PieceId = IndexedId | CrateId;

export interface Piece {
	id: PieceId;
	/** The shelf the piece belongs to, judged on what it says. */
	shelf: ShelfId;
}

/** A piece delivered during the game. */
export interface Crate extends Piece {
	id: CrateId;
}

export const FILE_NUMBER = "26-0417";

export interface ShelfText {
	name: string;
	/** What belongs here, shown under the name. */
	hint: string;
	/** Shelf summary while the shelf is empty. */
	emptyGist: string;
	/** This shelf's line in the file summary while the shelf is empty. */
	emptyBrief: string;
}

export interface PieceText {
	label: string;
	/** Raw content of the document, shown as data. */
	excerpt: string;
	/** What the model keeps of this piece in the shelf summary. */
	gist: string;
	/** What survives one level higher, in the file summary. */
	brief: string;
}

/** A delivered piece also explains its shelf and answers one control question. */
export interface CrateText extends PieceText {
	why: string;
	question: string;
	answer: string;
}

/** How the model puts the fragments together into summaries and replies. */
export interface ModelText {
	/** Between two gists, in a shelf summary. */
	separator: string;
	/** Ends a shelf summary that only counts its oldest pieces. */
	older: (count: number) => string;
	/** A crowded shelf's line in the file summary: its count, then its latest briefs. */
	crowded: (count: number, latest: string) => string;
	/** One line of the file summary. */
	line: (shelf: string, text: string) => string;
	/** The reply when the answering piece is not where the question leads. */
	notFound: string;
}

export interface Texts {
	shelves: Record<ShelfId, ShelfText>;
	pieces: Record<IndexedId, PieceText> & Record<CrateId, CrateText>;
	model: ModelText;
}

/** Raw French (the game applies frTypo), and British English. Same keys in both. */
export const texts: Record<Lang, Texts> = {
	fr: {
		shelves: {
			damage: {
				name: "Dégâts",
				hint: "ce qui est abîmé",
				emptyGist: "Aucun dégât décrit pour l'instant.",
				emptyBrief: "rien de constaté",
			},
			amounts: {
				name: "Montants",
				hint: "ce que ça coûte",
				emptyGist: "Aucun chiffrage pour l'instant.",
				emptyBrief: "rien de chiffré",
			},
			liability: {
				name: "Responsabilité",
				hint: "d'où vient la faute",
				emptyGist: "Aucune responsabilité établie pour l'instant.",
				emptyBrief: "rien d'établi",
			},
			followup: {
				name: "Suivi",
				hint: "rendez-vous, relances, délais",
				emptyGist: "Aucun rendez-vous pour l'instant.",
				emptyBrief: "rien de prévu",
			},
		},
		pieces: {
			declaration: {
				label: "Déclaration de l'assurée",
				excerpt: "Plafond du séjour taché, l'eau vient de l'étage.",
				gist: "plafond du séjour taché par une fuite venue de l'étage",
				brief: "plafond taché",
			},
			constat: {
				label: "Constat amiable",
				excerpt: "Signé par l'assurée et le voisin du dessus.",
				gist: "constat signé avec le voisin du dessus",
				brief: "constat signé",
			},
			receipt: {
				label: "Accusé de réception",
				excerpt: "Dossier ouvert le 3 mars.",
				gist: "dossier ouvert le 3 mars",
				brief: "ouvert le 3 mars",
			},
			photos: {
				label: "Photos de l'expert",
				excerpt: `Photo 4 : parquet du séjour gondolé sur 6${NBSP}m².`,
				gist: `parquet du séjour gondolé sur 6${NBSP}m²`,
				brief: "parquet gondolé",
				why: "Des photos de l'expert, mais elles montrent un dégât.",
				question: "Quelle surface de parquet est abîmée ?",
				answer: `6${NBSP}m², dans le séjour.`,
			},
			"tenant-mail": {
				label: "Courriel de l'assurée",
				excerpt:
					"Le placard de l'entrée sent le moisi, les cartons du bas sont perdus.",
				gist: "placard de l'entrée moisi, cartons perdus",
				brief: "placard moisi",
				why: "Un courriel, mais il décrit un dégât.",
				question: "Quel meuble a pris l'eau ?",
				answer: "Le placard de l'entrée.",
			},
			electrician: {
				label: "Note de l'électricien",
				excerpt: "Deux prises du séjour hors service, à remplacer.",
				gist: "deux prises du séjour hors service",
				brief: "prises hors service",
				why: "Elle décrit du matériel abîmé.",
				question: "Combien de prises sont hors service ?",
				answer: "Deux, dans le séjour.",
			},
			"floor-quote": {
				label: "Devis du parqueteur",
				excerpt: `Dépose et pose de parquet chêne, 6${NBSP}m² : 3 480 € TTC.`,
				gist: "parquet à refaire, devis de 3 480 €",
				brief: "parquet à 3 480 €",
				why: "Elle donne un prix.",
				question: "Combien coûte le nouveau parquet ?",
				answer: "3 480 € TTC.",
			},
			"plumber-invoice": {
				label: "Facture du plombier",
				excerpt: "Recherche de fuite et remplacement du joint : 290 €.",
				gist: "recherche de fuite facturée 290 €",
				brief: "plombier à 290 €",
				why: "Un plombier, mais la pièce donne un prix.",
				question: "Combien a coûté la recherche de fuite ?",
				answer: "290 €.",
			},
			"paint-quote": {
				label: "Devis du peintre",
				excerpt: "Plafond du séjour, deux couches : 1 150 € TTC.",
				gist: "plafond à repeindre, devis de 1 150 €",
				brief: "peinture à 1 150 €",
				why: "Elle parle du plafond, mais pour donner un prix.",
				question: "Combien coûte la peinture du plafond ?",
				answer: "1 150 € TTC.",
			},
			lawyer: {
				label: "Lettre de l'avocat du voisin",
				excerpt:
					"Mon client conteste : le flexible venait d'être posé par un artisan.",
				gist: "le voisin conteste et met en cause son artisan",
				brief: "le voisin conteste",
				why: "Une lettre, mais elle dit qui est en cause.",
				question: "Que répond le voisin du dessus ?",
				answer: "Il conteste et met en cause son artisan.",
			},
			"plumber-report": {
				label: "Rapport du plombier",
				excerpt: "Origine : flexible du lave-linge du dessus mal serré.",
				gist: "fuite due au flexible mal serré du lave-linge du dessus",
				brief: "flexible mal serré",
				why: "Un plombier, mais la pièce dit d'où vient la fuite.",
				question: "D'où vient la fuite ?",
				answer: "Du flexible mal serré du lave-linge du dessus.",
			},
			caretaker: {
				label: "Attestation de la gardienne",
				excerpt:
					"J'ai vu l'eau couler de chez le voisin du dessus, le 1er mars.",
				gist: "la gardienne a vu l'eau venir de chez le voisin",
				brief: "témoin : la gardienne",
				why: "Un témoignage sur l'origine de la fuite.",
				question: "Qui a vu l'eau couler ?",
				answer: "La gardienne, le 1er mars.",
			},
			"expert-mail": {
				label: "Courriel de l'expert",
				excerpt: `Je passerai constater les dégâts le 14 mars à 10${NBSP}h.`,
				gist: `visite de l'expert le 14 mars à 10${NBSP}h`,
				brief: "expert le 14 mars",
				why: "Elle parle de dégâts, mais pour fixer un rendez-vous.",
				question: "Quand passe l'expert ?",
				answer: `Le 14 mars à 10${NBSP}h.`,
			},
			reminder: {
				label: "Relance du gestionnaire",
				excerpt:
					"Sans réponse de votre part, le dossier sera classé le 30 avril.",
				gist: "dossier classé le 30 avril faute de réponse",
				brief: "échéance le 30 avril",
				why: "Elle fixe une échéance.",
				question: "Jusqu'à quand l'assurée peut-elle répondre ?",
				answer: "Jusqu'au 30 avril.",
			},
			syndic: {
				label: "Réponse du syndic",
				excerpt:
					"Le syndic a bien reçu la déclaration et répondra sous 15 jours.",
				gist: "syndic prévenu, réponse sous 15 jours",
				brief: "syndic sous 15 jours",
				why: "Elle donne un délai de réponse.",
				question: "Sous quel délai répond le syndic ?",
				answer: "Sous 15 jours.",
			},
		},
		model: {
			separator: " ; ",
			older: (n) => `Et ${n} pièce${s(n)} plus ancienne${s(n)}.`,
			crowded: (n, latest) => `${n} pièces, dont ${latest}`,
			line: (shelf, text) => `${shelf} : ${text}.`,
			notFound: "Je ne trouve pas cette information dans le dossier.",
		},
	},
	en: {
		shelves: {
			damage: {
				name: "Damage",
				hint: "what's been damaged",
				emptyGist: "No damage described yet.",
				emptyBrief: "nothing recorded",
			},
			amounts: {
				name: "Costs",
				hint: "what it costs",
				emptyGist: "No figures yet.",
				emptyBrief: "nothing costed",
			},
			liability: {
				name: "Liability",
				hint: "whose fault it is",
				emptyGist: "No liability established yet.",
				emptyBrief: "nothing established",
			},
			followup: {
				name: "Follow-up",
				hint: "visits, reminders, deadlines",
				emptyGist: "No appointments yet.",
				emptyBrief: "nothing scheduled",
			},
		},
		pieces: {
			declaration: {
				label: "Policyholder's claim form",
				excerpt:
					"Living-room ceiling stained, the water's coming from upstairs.",
				gist: "living-room ceiling stained by a leak from upstairs",
				brief: "stained ceiling",
			},
			constat: {
				label: "Joint damage report",
				excerpt: "Signed by the policyholder and the upstairs neighbour.",
				gist: "joint report signed with the upstairs neighbour",
				brief: "joint report signed",
			},
			receipt: {
				label: "Acknowledgement of receipt",
				excerpt: "Claim opened on 3 March.",
				gist: "claim opened on 3 March",
				brief: "opened 3 March",
			},
			photos: {
				label: "Loss adjuster's photos",
				excerpt: `Photo 4: living-room parquet buckled over 6${NBSP}m².`,
				gist: `living-room parquet buckled over 6${NBSP}m²`,
				brief: "buckled parquet",
				why: "Photos from the adjuster, but they show damage.",
				question: "How much parquet is damaged?",
				answer: `6${NBSP}m², in the living room.`,
			},
			"tenant-mail": {
				label: "Policyholder's email",
				excerpt:
					"The hall cupboard smells musty, and the boxes at the bottom are ruined.",
				gist: "hall cupboard gone mouldy, boxes ruined",
				brief: "mouldy cupboard",
				why: "An email, but it describes damage.",
				question: "Which piece of furniture got wet?",
				answer: "The hall cupboard.",
			},
			electrician: {
				label: "Electrician's note",
				excerpt: "Two living-room sockets out of order, to be replaced.",
				gist: "two living-room sockets out of order",
				brief: "dead sockets",
				why: "It describes damaged equipment.",
				question: "How many sockets are out of order?",
				answer: "Two, in the living room.",
			},
			"floor-quote": {
				label: "Floor fitter's quote",
				excerpt: `Take up and relay oak parquet, 6${NBSP}m²: ${eur(3480)} incl. VAT.`,
				gist: `parquet to be relaid, quoted at ${eur(3480)}`,
				brief: `parquet ${eur(3480)}`,
				why: "It gives a price.",
				question: "How much will the new parquet cost?",
				answer: `${eur(3480)} incl. VAT.`,
			},
			"plumber-invoice": {
				label: "Plumber's invoice",
				excerpt: `Leak detection and seal replacement: ${eur(290)}.`,
				gist: `leak detection billed at ${eur(290)}`,
				brief: `plumber ${eur(290)}`,
				why: "A plumber, but the document gives a price.",
				question: "How much did the leak detection cost?",
				answer: `${eur(290)}.`,
			},
			"paint-quote": {
				label: "Decorator's quote",
				excerpt: `Living-room ceiling, two coats: ${eur(1150)} incl. VAT.`,
				gist: `ceiling to be repainted, quoted at ${eur(1150)}`,
				brief: `painting ${eur(1150)}`,
				why: "It mentions the ceiling, but to give a price.",
				question: "How much will painting the ceiling cost?",
				answer: `${eur(1150)} incl. VAT.`,
			},
			lawyer: {
				label: "Neighbour's solicitor's letter",
				excerpt:
					"My client disputes this: a tradesman had just fitted the hose.",
				gist: "the neighbour disputes it and blames his tradesman",
				brief: "neighbour disputes it",
				why: "A letter, but it says who's to blame.",
				question: "What does the upstairs neighbour say?",
				answer: "He disputes it and blames his tradesman.",
			},
			"plumber-report": {
				label: "Plumber's report",
				excerpt: "Cause: loose hose on the washing machine upstairs.",
				gist: "leak caused by a loose washing-machine hose upstairs",
				brief: "loose hose",
				why: "A plumber, but the document says where the leak comes from.",
				question: "Where is the leak coming from?",
				answer: "A loose hose on the washing machine upstairs.",
			},
			caretaker: {
				label: "Caretaker's statement",
				excerpt: "I saw water running from the upstairs flat on 1 March.",
				gist: "the caretaker saw the water coming from the neighbour's",
				brief: "witness: the caretaker",
				why: "A witness account of where the leak came from.",
				question: "Who saw the water running?",
				answer: "The caretaker, on 1 March.",
			},
			"expert-mail": {
				label: "Loss adjuster's email",
				excerpt: "I'll come and assess the damage on 14 March at 10am.",
				gist: "loss adjuster visiting on 14 March at 10am",
				brief: "adjuster on 14 March",
				why: "It mentions damage, but to set an appointment.",
				question: "When is the adjuster coming?",
				answer: "On 14 March at 10am.",
			},
			reminder: {
				label: "Claims handler's reminder",
				excerpt:
					"If we don't hear from you, the claim will be closed on 30 April.",
				gist: "claim closed on 30 April if there's no reply",
				brief: "deadline 30 April",
				why: "It sets a deadline.",
				question: "How long does the policyholder have to reply?",
				answer: "Until 30 April.",
			},
			syndic: {
				label: "Managing agent's reply",
				excerpt:
					"The managing agent has received the claim and will reply within 15 days.",
				gist: "managing agent notified, reply within 15 days",
				brief: "managing agent within 15 days",
				why: "It says how soon they'll reply.",
				question: "How soon will the managing agent reply?",
				answer: "Within 15 days.",
			},
		},
		model: {
			separator: "; ",
			older: (n) => `Plus ${n} older document${n === 1 ? "" : "s"}.`,
			crowded: (n, latest) => `${n} documents, including ${latest}`,
			line: (shelf, text) => `${shelf}: ${text}.`,
			notFound: "I can't find that information in the file.",
		},
	},
};
