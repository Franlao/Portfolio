/**
 * Content of « La réserve qui se range seule ». Everything here is fictional:
 * a made-up water damage claim, its shelves, and the pieces that arrive one by one.
 * The summaries a model would write are pre-written as fragments (gist, brief) and replayed.
 */

// frTypo does not know every unit (m², h): those get their non-breaking space here.
const NBSP = String.fromCharCode(0x00a0);

export type ShelfId = "damage" | "amounts" | "liability" | "followup";

export interface Shelf {
	id: ShelfId;
	name: string;
	/** What belongs here, shown under the name. */
	hint: string;
	/** Shelf summary while the shelf is empty. */
	emptyGist: string;
	/** This shelf's line in the file summary while the shelf is empty. */
	emptyBrief: string;
}

export interface Piece {
	id: string;
	label: string;
	/** Raw content of the document, shown as data. */
	excerpt: string;
	/** The shelf the piece belongs to, judged on what it says. */
	shelf: ShelfId;
	/** What the model keeps of this piece in the shelf summary. */
	gist: string;
	/** What survives one level higher, in the file summary. */
	brief: string;
}

/** A piece delivered during the game: it explains its shelf and answers one control question. */
export interface Crate extends Piece {
	why: string;
	question: string;
	answer: string;
}

export const FILE_NUMBER = "26-0417";

export const shelves: Shelf[] = [
	{
		id: "damage",
		name: "Dégâts",
		hint: "ce qui est abîmé",
		emptyGist: "Aucun dégât décrit pour l'instant.",
		emptyBrief: "rien de constaté",
	},
	{
		id: "amounts",
		name: "Montants",
		hint: "ce que ça coûte",
		emptyGist: "Aucun chiffrage pour l'instant.",
		emptyBrief: "rien de chiffré",
	},
	{
		id: "liability",
		name: "Responsabilité",
		hint: "d'où vient la faute",
		emptyGist: "Aucune responsabilité établie pour l'instant.",
		emptyBrief: "rien d'établi",
	},
	{
		id: "followup",
		name: "Suivi",
		hint: "rendez-vous, relances, délais",
		emptyGist: "Aucun rendez-vous pour l'instant.",
		emptyBrief: "rien de prévu",
	},
];

/** Already indexed when the game starts: the Montants shelf is still empty. */
export const initialPieces: Piece[] = [
	{
		id: "declaration",
		label: "Déclaration de l'assurée",
		excerpt: "Plafond du séjour taché, l'eau vient de l'étage.",
		shelf: "damage",
		gist: "plafond du séjour taché par une fuite venue de l'étage",
		brief: "plafond taché",
	},
	{
		id: "constat",
		label: "Constat amiable",
		excerpt: "Signé par l'assurée et le voisin du dessus.",
		shelf: "liability",
		gist: "constat signé avec le voisin du dessus",
		brief: "constat signé",
	},
	{
		id: "receipt",
		label: "Accusé de réception",
		excerpt: "Dossier ouvert le 3 mars.",
		shelf: "followup",
		gist: "dossier ouvert le 3 mars",
		brief: "ouvert le 3 mars",
	},
];

// Several crates look like they belong elsewhere (a plumber's invoice, a lawyer's letter):
// the game is about filing a piece by what it says, not by who sent it.
export const crates: Crate[] = [
	{
		id: "photos",
		label: "Photos de l'expert",
		excerpt: `Photo 4 : parquet du séjour gondolé sur 6${NBSP}m².`,
		shelf: "damage",
		gist: `parquet du séjour gondolé sur 6${NBSP}m²`,
		brief: "parquet gondolé",
		why: "Des photos de l'expert, mais elles montrent un dégât.",
		question: "Quelle surface de parquet est abîmée ?",
		answer: `6${NBSP}m², dans le séjour.`,
	},
	{
		id: "tenant-mail",
		label: "Courriel de l'assurée",
		excerpt:
			"Le placard de l'entrée sent le moisi, les cartons du bas sont perdus.",
		shelf: "damage",
		gist: "placard de l'entrée moisi, cartons perdus",
		brief: "placard moisi",
		why: "Un courriel, mais il décrit un dégât.",
		question: "Quel meuble a pris l'eau ?",
		answer: "Le placard de l'entrée.",
	},
	{
		id: "electrician",
		label: "Note de l'électricien",
		excerpt: "Deux prises du séjour hors service, à remplacer.",
		shelf: "damage",
		gist: "deux prises du séjour hors service",
		brief: "prises hors service",
		why: "Elle décrit du matériel abîmé.",
		question: "Combien de prises sont hors service ?",
		answer: "Deux, dans le séjour.",
	},
	{
		id: "floor-quote",
		label: "Devis du parqueteur",
		excerpt: `Dépose et pose de parquet chêne, 6${NBSP}m² : 3 480 € TTC.`,
		shelf: "amounts",
		gist: "parquet à refaire, devis de 3 480 €",
		brief: "parquet à 3 480 €",
		why: "Elle donne un prix.",
		question: "Combien coûte le nouveau parquet ?",
		answer: "3 480 € TTC.",
	},
	{
		id: "plumber-invoice",
		label: "Facture du plombier",
		excerpt: "Recherche de fuite et remplacement du joint : 290 €.",
		shelf: "amounts",
		gist: "recherche de fuite facturée 290 €",
		brief: "plombier à 290 €",
		why: "Un plombier, mais la pièce donne un prix.",
		question: "Combien a coûté la recherche de fuite ?",
		answer: "290 €.",
	},
	{
		id: "paint-quote",
		label: "Devis du peintre",
		excerpt: "Plafond du séjour, deux couches : 1 150 € TTC.",
		shelf: "amounts",
		gist: "plafond à repeindre, devis de 1 150 €",
		brief: "peinture à 1 150 €",
		why: "Elle parle du plafond, mais pour donner un prix.",
		question: "Combien coûte la peinture du plafond ?",
		answer: "1 150 € TTC.",
	},
	{
		id: "lawyer",
		label: "Lettre de l'avocat du voisin",
		excerpt:
			"Mon client conteste : le flexible venait d'être posé par un artisan.",
		shelf: "liability",
		gist: "le voisin conteste et met en cause son artisan",
		brief: "le voisin conteste",
		why: "Une lettre, mais elle dit qui est en cause.",
		question: "Que répond le voisin du dessus ?",
		answer: "Il conteste et met en cause son artisan.",
	},
	{
		id: "plumber-report",
		label: "Rapport du plombier",
		excerpt: "Origine : flexible du lave-linge du dessus mal serré.",
		shelf: "liability",
		gist: "fuite due au flexible mal serré du lave-linge du dessus",
		brief: "flexible mal serré",
		why: "Un plombier, mais la pièce dit d'où vient la fuite.",
		question: "D'où vient la fuite ?",
		answer: "Du flexible mal serré du lave-linge du dessus.",
	},
	{
		id: "caretaker",
		label: "Attestation de la gardienne",
		excerpt: "J'ai vu l'eau couler de chez le voisin du dessus, le 1er mars.",
		shelf: "liability",
		gist: "la gardienne a vu l'eau venir de chez le voisin",
		brief: "témoin : la gardienne",
		why: "Un témoignage sur l'origine de la fuite.",
		question: "Qui a vu l'eau couler ?",
		answer: "La gardienne, le 1er mars.",
	},
	{
		id: "expert-mail",
		label: "Courriel de l'expert",
		excerpt: `Je passerai constater les dégâts le 14 mars à 10${NBSP}h.`,
		shelf: "followup",
		gist: `visite de l'expert le 14 mars à 10${NBSP}h`,
		brief: "expert le 14 mars",
		why: "Elle parle de dégâts, mais pour fixer un rendez-vous.",
		question: "Quand passe l'expert ?",
		answer: `Le 14 mars à 10${NBSP}h.`,
	},
	{
		id: "reminder",
		label: "Relance du gestionnaire",
		excerpt: "Sans réponse de votre part, le dossier sera classé le 30 avril.",
		shelf: "followup",
		gist: "dossier classé le 30 avril faute de réponse",
		brief: "échéance le 30 avril",
		why: "Elle fixe une échéance.",
		question: "Jusqu'à quand l'assurée peut-elle répondre ?",
		answer: "Jusqu'au 30 avril.",
	},
	{
		id: "syndic",
		label: "Réponse du syndic",
		excerpt: "Le syndic a bien reçu la déclaration et répondra sous 15 jours.",
		shelf: "followup",
		gist: "syndic prévenu, réponse sous 15 jours",
		brief: "syndic sous 15 jours",
		why: "Elle donne un délai de réponse.",
		question: "Sous quel délai répond le syndic ?",
		answer: "Sous 15 jours.",
	},
];
