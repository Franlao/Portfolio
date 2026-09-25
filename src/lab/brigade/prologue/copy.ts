import type { Lang } from "../../../i18n/ui";
import { typographize } from "../../../lib/typo";

/**
 * The arrival: the visitor booked on their phone, a taxi drops them in front of the
 * restaurant, the maître d' opens the car door and welcomes them, then the front of
 * the house opens and the chef says hello. During the first order, each station is
 * named as it works, in kitchen words first and in AI words second: the visitor
 * learns the trade by watching it.
 */
const raw = {
	fr: {
		facade: {
			name: "La Brigade",
			tagline: "Cuisine d'intelligence artificielle",
			windowLeft: "Cuisine ouverte",
			windowRight: ["Recettes vraies,", "produits fictifs"],
			doorPlate: "Ouvert",
			board: ["Ce soir", "6 postes", "à goûter"],
		},
		// The visitor's phone: the booking they made on the way, and the restaurant's messages.
		phone: {
			label: "Votre téléphone",
			time: "20:04",
			contact: "La Brigade",
			status: "Restaurant, Lyon 2e",
			greeting: "Bonsoir ! Votre table du chef est réservée pour ce soir.",
			booking: {
				kicker: "Réservation confirmée",
				title: "La Brigade, table du chef",
				rows: [
					{ term: "Pour", value: "vous, qui recrutez" },
					{ term: "Objet", value: "trouver votre AI Engineer" },
					{ term: "Chef", value: "Solim Laokpezi" },
					{ term: "Durée", value: "2 minutes, à votre rythme" },
				],
				stamp: "Confirmée",
			},
			house:
				"Ici, pas de CV à lire : les projets se goûtent. Recettes de la maison confidentielles, produits fictifs.",
			arrived:
				"Votre taxi est arrivé. Notre maître d'hôtel vous ouvre la portière.",
			typing: "La Brigade écrit…",
			enter: "Entrer",
			menu: "Pressé ? Lire la carte (version texte)",
		},
		host: {
			welcome: "Bienvenue à La Brigade !",
			thisWay: "Par ici !",
		},
		menuTag: "La carte",
		ding: "Ding !",
		tour: {
			label: "L'accueil du chef",
			steps: [
				"Bonsoir ! Je suis Solim, le chef. Chaque poste est un de mes projets.",
				"Vous recrutez ? Votre offre d'emploi, c'est votre commande.",
				"Et rien ne sort sans mon contrôle, au passe.",
			],
			step: (n: number, total: number) => `${n} sur ${total}`,
			next: "Suivant",
			done: "À vous !",
			skip: "Passer",
		},
		bubbles: { hello: "Bonsoir !", order: "Une commande ?" },
		// The first order, told step by step: the kitchen word, then the AI word.
		narration: {
			label: "Ce qui se passe en cuisine",
			inAi: "En IA",
			// When Mistral reads the offer: the model reads, the code checks and decides.
			model: [
				{
					kitchen:
						"Le commis, un modèle de langage, a lu votre offre. Pour chaque ligne du bon, il cite l'offre.",
					ai: "l'extraction par un LLM",
				},
				{
					kitchen:
						"Le chef vérifie que chaque ligne du bon cite bien votre offre. Seules les lignes vérifiées comptent.",
					ai: "l'ancrage, contre les hallucinations",
				},
				{
					kitchen:
						"Les postes s'allument selon la part de la commande qu'ils couvrent. Là, c'est du calcul.",
					ai: "le rapprochement",
				},
				{
					kitchen:
						"Le passe : le modèle a lu, le code a vérifié et décidé. Rien ne sort sans contrôle.",
					ai: "la validation",
				},
			],
			steps: [
				{
					kitchen: "Le bon : votre offre, lue phrase par phrase.",
					ai: "la requête",
				},
				{
					kitchen:
						"Le garde-manger : un bocal par compétence repérée dans l'offre.",
					ai: "l'extraction",
				},
				{
					kitchen:
						"Les postes s'allument selon la part de la commande qu'ils couvrent.",
					ai: "le rapprochement",
				},
				{
					kitchen:
						"Le passe : chaque étape est contrôlée avant de servir. Ici, sans modèle de langage : du code déterministe suffit.",
					ai: "la validation",
				},
			],
		},
		replay: "Revoir l'arrivée",
	},
	en: {
		facade: {
			name: "La Brigade",
			tagline: "Artificial intelligence kitchen",
			windowLeft: "Open kitchen",
			windowRight: ["Real recipes,", "fictional produce"],
			doorPlate: "Open",
			board: ["Tonight", "6 stations", "to taste"],
		},
		phone: {
			label: "Your phone",
			time: "20:04",
			contact: "La Brigade",
			status: "Restaurant, Lyon",
			greeting: "Good evening! Your chef's table is booked for tonight.",
			booking: {
				kicker: "Booking confirmed",
				title: "La Brigade, chef's table",
				rows: [
					{ term: "For", value: "you, the one hiring" },
					{ term: "Purpose", value: "find your AI Engineer" },
					{ term: "Chef", value: "Solim Laokpezi" },
					{ term: "Time", value: "2 minutes, at your own pace" },
				],
				stamp: "Confirmed",
			},
			house:
				"No CV to read here: you taste the projects. House recipes are confidential, the produce is fictional.",
			arrived: "Your taxi is here. Our maître d' is opening the door for you.",
			typing: "La Brigade is typing…",
			enter: "Step inside",
			menu: "In a hurry? Read the menu (text version)",
		},
		host: {
			welcome: "Welcome to La Brigade!",
			thisWay: "This way!",
		},
		menuTag: "The menu",
		ding: "Ding!",
		tour: {
			label: "The chef's welcome",
			steps: [
				"Good evening! I'm Solim, the chef. Every station is one of my projects.",
				"Hiring? Your job description is your order.",
				"And nothing leaves without my check, at the pass.",
			],
			step: (n: number, total: number) => `${n} of ${total}`,
			next: "Next",
			done: "Over to you!",
			skip: "Skip",
		},
		bubbles: { hello: "Good evening!", order: "Your order?" },
		narration: {
			label: "What the kitchen is doing",
			inAi: "In AI terms",
			model: [
				{
					kitchen:
						"The commis, a language model, read your job ad. For every line of the ticket, it quotes the ad.",
					ai: "LLM extraction",
				},
				{
					kitchen:
						"The chef checks that every line of the ticket really quotes your job ad. Only checked lines count.",
					ai: "grounding, against hallucinations",
				},
				{
					kitchen:
						"Each station lights up with the share of the order it covers. That part is plain arithmetic.",
					ai: "matching",
				},
				{
					kitchen:
						"The pass: the model read, the code checked and decided. Nothing leaves unchecked.",
					ai: "validation",
				},
			],
			steps: [
				{
					kitchen:
						"The ticket: your job description, read sentence by sentence.",
					ai: "the query",
				},
				{
					kitchen:
						"The pantry: one jar for each skill found in the description.",
					ai: "extraction",
				},
				{
					kitchen:
						"Each station lights up with the share of the order it covers.",
					ai: "matching",
				},
				{
					kitchen:
						"The pass: every step is checked before serving. No language model needed here: plain deterministic code does the job.",
					ai: "validation",
				},
			],
		},
		replay: "Replay the arrival",
	},
};

export const prologueCopy = {
	fr: typographize(raw.fr),
	en: raw.en,
} satisfies Record<Lang, unknown>;

export type PrologueCopy = (typeof prologueCopy)[Lang];
