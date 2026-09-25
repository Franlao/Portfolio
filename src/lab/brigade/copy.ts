import type {
	CheckId,
	Outcome,
	PieceId,
} from "../../components/demos/claims-agent/engine";
import type { Lang } from "../../i18n/ui";
import { typographize } from "../../lib/typo";
import type { RushCaseId } from "./rush";
import type { StationId } from "./stations";

/**
 * Every string the Brigade shell shows: the static page (Brigade.astro) and the dynamic text of main.ts.
 * The mini-games keep their own copy in games/<station>/.
 * French goes through typographize, English is written with its own punctuation (“ ”, no space before ! ? :).
 */
interface BrigadeCopy {
	meta: { title: string; description: string };
	intro: {
		/** Accessible name of the 3D canvas. */
		canvas: string;
		role: string;
		/** The side door to the text version. */
		menu: string;
		text: string;
	};
	/** Label of the language switch, next to the sound toggle. */
	language: string;
	sound: { enable: string; disable: string };
	orders: {
		title: string;
		kind: string;
		writeKind: string;
		writeLabel: string;
	};
	write: {
		label: string;
		placeholder: string;
		send: string;
		cancel: string;
		tooShort: string;
		noSkill: string;
		/** Title of the ticket for a pasted job ad. */
		ticketTitle: (words: number) => string;
		/** Where the offer goes when a language model reads it. */
		privacy: string;
	};
	ticket: {
		number: (padded: string) => string;
		table: string;
		quantity: (count: number) => string;
		foot: (words: number, mentions: number) => string;
		/** While the model reads the offer. */
		reading: string;
		/** When the model read the offer and the pass checked its quotes. */
		footModel: (checked: number) => string;
	};
	dish: {
		title: string;
		intro: string;
		note: string;
		/** "Le passe, 67 % de votre commande": the percentage comes formatted. */
		meta: (station: string, share: string) => string;
		/** Followed by what the offer asks and the house does not cook. */
		outside: string;
	};
	/** The bill: what the visitor tasted, and how to reach the chef. */
	bill: {
		open: string;
		title: string;
		table: string;
		empty: string;
		order: (label: string) => string;
		visit: (station: string) => string;
		play: (station: string) => string;
		price: string;
		total: string;
		totalValue: string;
		settle: string;
		write: string;
		mailSubject: string;
		cv: string;
		/** Read by screen readers after links that open a new tab. */
		newTab: string;
		share: string;
		shared: string;
		/** Shown on the share button once the link is copied. */
		copied: string;
		/** When the clipboard is blocked: the link is shown, selected, to copy by hand. */
		copyThis: string;
		/** Accessible name of the field holding the link. */
		linkLabel: string;
		close: string;
	};
	visit: {
		back: string;
		play: string;
		takePass: string;
		read: string;
		soon: string;
	};
	stations: Record<StationId, { name: string; concept: string }>;
	/** The stamp the chef puts on the plate. */
	stamp: string;
	/** Speech bubbles, under 30 characters. */
	bubbles: {
		coming: string;
		yes: string;
		heat: string;
		service: string;
		right: string;
		wrong: string;
		rushStart: string;
		rushEnd: string;
		invite: string;
		bill: string;
		nothing: string;
	};
	quit: string;
	rush: {
		title: string;
		relax: string;
		rulesTitle: string;
		rules: string[];
		delay: string;
		quote: string;
		decision: string;
		outcomes: Record<Outcome, string>;
		stamps: Record<Outcome, string>;
		pieces: Record<PieceId, string>;
		stories: Record<RushCaseId, string>;
		progress: (index: number, total: number) => string;
		days: (count: number) => string;
		notReceived: string;
		verdict: {
			right: string;
			late: string;
			wrong: string;
			/** The outcome comes lowercased, the time formatted. */
			chef: (outcome: string, ms: string) => string;
		};
		next: string;
		result: string;
		endTitle: string;
		score: (right: number, total: number, seconds: number) => string;
		/** The time comes formatted. */
		chefScore: (total: number, ms: string) => string;
		again: string;
		howItDecides: string;
	};
}

const raw: Record<Lang, BrigadeCopy> = {
	fr: {
		meta: {
			title: "Solim Laokpezi, AI Engineer : La Brigade",
			description:
				"AI Engineer à Lyon. Mes projets servis par une brigade de cuisine : passez commande, la cuisine prépare ceux qui répondent à votre poste.",
		},
		intro: {
			canvas:
				"La cuisine en 3D. Les postes sont aussi accessibles par les étiquettes.",
			role: "AI Engineer, Lyon",
			menu: "Pressé ? Lisez la carte (version texte)",
			text: "Mes agents IA travaillent comme une brigade : chacun son poste, et rien ne sort sans passer par le chef. Passez commande, la cuisine prépare les projets qui répondent à votre poste.",
		},
		language: "Langue",
		sound: { enable: "Activer le son", disable: "Couper le son" },
		orders: {
			title: "Passer commande",
			kind: "Commande",
			writeKind: "Votre offre",
			writeLabel: "Écrire ma commande",
		},
		write: {
			label:
				"Collez l'offre d'emploi : la brigade la lit comme un bon de commande.",
			placeholder: "Collez ici le texte de l'offre.",
			send: "Envoyer en cuisine",
			cancel: "Annuler",
			tooShort: "La commande est trop courte : il faut au moins 20 mots.",
			noSkill:
				"La brigade ne reconnaît aucun ingrédient dans cette commande. Collez la description du poste.",
			ticketTitle: (words) => `Votre offre (${words} mots)`,
			privacy:
				"Votre offre est lue par un modèle de langage Mistral, hébergé en Europe, puis oubliée. S'il ne répond pas, la brigade la lit elle-même.",
		},
		ticket: {
			number: (padded) => `Commande n° ${padded}`,
			table: "Table : recruteur",
			quantity: (count) => `${count} ×`,
			foot: (words, mentions) =>
				`${words} mots lus, ${mentions} mention${mentions > 1 ? "s" : ""} relevée${mentions > 1 ? "s" : ""}`,
			reading: "Le commis lit votre offre…",
			footModel: (checked) => {
				const s = checked > 1 ? "s" : "";
				return `Lu par un modèle de langage : ${checked} exigence${s}, chacune vérifiée dans votre offre`;
			},
		},
		dish: {
			title: "Le plat est prêt",
			intro: "Pour ce poste, la brigade vous sert :",
			note: "Choisissez un plat pour visiter son poste.",
			meta: (station, share) => `${station}, ${share} de votre commande`,
			outside: "Pas au menu :",
		},
		bill: {
			open: "L'addition",
			title: "L'addition",
			table: "Table du chef · recruteur",
			empty:
				"Rien goûté pour l'instant : passez commande, ou visitez un poste.",
			order: (label) => `Commande : ${label}`,
			visit: (station) => `Visite : ${station}`,
			play: (station) => `Dégustation : ${station}`,
			price: "offert",
			total: "Total",
			totalValue: "0 €",
			settle:
				"C'est la maison qui invite. Pour régler, un échange avec le chef suffit.",
			write: "Écrire au chef",
			mailSubject: "Rencontre via La Brigade",
			cv: "Le CV à emporter (PDF)",
			newTab: "(s'ouvre dans un nouvel onglet)",
			share: "Transmettre la cuisine à un collègue",
			shared: "Lien copié : il ouvre directement la cuisine.",
			copied: "✓ Lien copié",
			copyThis: "Copiez ce lien (Ctrl+C) : il ouvre directement la cuisine.",
			linkLabel: "Lien vers la cuisine",
			close: "Fermer",
		},
		visit: {
			back: "Revenir à la cuisine",
			play: "Jouer à ce poste",
			takePass: "Prendre le passe",
			read: "Lire le projet",
			soon: "Ce poste ouvre bientôt.",
		},
		stations: {
			pass: {
				name: "Le passe",
				concept:
					"Rien ne sort sans le contrôle du chef : chaque décision de l'agent est vérifiée, et la raison est notée, avant que l'assiette parte.",
			},
			delivery: {
				name: "Les livraisons",
				concept:
					"Quand une nouvelle pièce arrive au dossier, seule l'étagère concernée est réorganisée, pas toute la réserve.",
			},
			library: {
				name: "La bibliothèque de recettes",
				concept:
					"Une question, et le commis revient avec la bonne page, schémas compris.",
			},
			coldroom: {
				name: "La cuisine fermée",
				concept:
					"Ici, rien ne quitte la pièce : les données médicales restent sur place, et le modèle vient à elles.",
			},
			pastry: {
				name: "La pâtisserie",
				concept:
					"Des gâteaux qui ressemblent aux vrais sans en être : des données réalistes, mais synthétiques.",
			},
			tools: {
				name: "La batterie de cuisine",
				concept:
					"Les outils de toute la brigade : librairies internes, SDK, et le choix des assistants de code.",
			},
		},
		stamp: "Vérifié",
		bubbles: {
			coming: "Ça marche !",
			yes: "Oui chef !",
			heat: "Ça chauffe !",
			service: "Service !",
			right: "Bien vu !",
			wrong: "Non !",
			rushStart: "À vous le passe !",
			rushEnd: "Service terminé !",
			invite: "Une commande ?",
			bill: "L'addition ?",
			nothing: "Rien à cuisiner !",
		},
		quit: "Quitter",
		rush: {
			title: "Coup de feu au passe",
			relax: "Sans chrono",
			rulesTitle: "Le règlement de la maison",
			rules: [
				"Déclaration sous 5 jours.",
				"Plafond de garantie : 15 000 €.",
				"Pièces obligatoires : déclaration, photos, devis.",
				"Version contestée : il faut l'attestation du voisin.",
				"Orage ou tempête : exclusion possible, au gestionnaire de trancher.",
			],
			delay: "Déclaré au bout de",
			quote: "Devis",
			decision: "Votre décision",
			outcomes: {
				offer: "Proposer l'indemnisation",
				missing: "Réclamer une pièce",
				escalation: "Transmettre au gestionnaire",
			},
			stamps: {
				offer: "Indemnisé",
				missing: "Pièce réclamée",
				escalation: "Transmis",
			},
			pieces: {
				declaration: "Déclaration de sinistre",
				photos: "Photos des dégâts",
				quote: "Devis de réparation",
				statement: "Attestation du voisin",
			},
			stories: {
				clean: "Le camion a reculé dans le portail du voisin. Tout est là.",
				"no-quote":
					"Marche arrière, portail plié. L'assuré a envoyé ses photos.",
				late: "Un rétroviseur contre un portail, déclaré après le week-end prolongé.",
				storm:
					"Une branche est tombée sur le portail pendant l'orage de la nuit.",
				disputed: "Le chauffeur jure que le portail était déjà abîmé.",
				ceiling:
					"Le portail en fer forgé d'une maison de maître, entièrement à refaire.",
				shared:
					"Versions contradictoires, mais le voisin a signé son attestation.",
			},
			progress: (index, total) => `Dossier ${index} sur ${total}`,
			days: (count) => `${count} jour${count > 1 ? "s" : ""}`,
			notReceived: "non reçu",
			verdict: {
				right: "Bien vu : même décision que le chef.",
				late: "Trop tard : le chef a tranché sans vous.",
				wrong: "Pas tout à fait.",
				chef: (outcome, ms) => `Le chef : ${outcome}, en ${ms} ms.`,
			},
			next: "Dossier suivant",
			result: "Voir le résultat",
			endTitle: "Service terminé",
			score: (right, total, seconds) => {
				const plural = right > 1 ? "s" : "";
				return `Vous : ${right} bonne${plural} décision${plural} sur ${total}, en ${seconds} s.`;
			},
			chefScore: (total, ms) =>
				`Le chef, c'est-à-dire l'agent : ${total} sur ${total}, en ${ms} ms au total, avec la raison de chaque décision. C'est tout l'intérêt d'un agent auditable : il applique le règlement à chaque fois, et il dit pourquoi.`,
			again: "Rejouer",
			howItDecides: "Voir comment l'agent décide",
		},
	},
	en: {
		meta: {
			title: "Solim Laokpezi, AI Engineer: La Brigade",
			description:
				"AI Engineer in Lyon. My projects, served by a kitchen brigade: place an order and the kitchen prepares the ones that fit your role.",
		},
		intro: {
			canvas:
				"The kitchen in 3D. Every station can also be reached from its label.",
			role: "AI Engineer, Lyon",
			menu: "In a hurry? Read the menu (text version)",
			text: "My AI agents work like a kitchen brigade: everyone has a station, and nothing goes out until the chef has checked it. Place an order and the kitchen will cook up the projects that fit your role.",
		},
		language: "Language",
		sound: { enable: "Turn sound on", disable: "Turn sound off" },
		orders: {
			title: "Place an order",
			kind: "Order",
			writeKind: "Your job ad",
			writeLabel: "Write my own order",
		},
		write: {
			label: "Paste the job ad: the brigade reads it like an order ticket.",
			placeholder: "Paste the text of the job ad here.",
			send: "Send to the kitchen",
			cancel: "Cancel",
			tooShort: "This order is too short: it needs at least 20 words.",
			noSkill:
				"The brigade can't find a single ingredient in this order. Paste the description of the role.",
			ticketTitle: (words) => `Your job ad (${words} words)`,
			privacy:
				"Your job ad is read by a Mistral language model, hosted in Europe, then forgotten. If the model does not answer, the brigade reads it itself.",
		},
		ticket: {
			number: (padded) => `Order no. ${padded}`,
			table: "Table: recruiter",
			quantity: (count) => `${count} ×`,
			foot: (words, mentions) =>
				`${words} words read, ${mentions} mention${mentions === 1 ? "" : "s"} spotted`,
			reading: "The commis is reading your job ad…",
			footModel: (checked) =>
				`Read by a language model: ${checked} requirement${checked === 1 ? "" : "s"}, each one checked against your job ad`,
		},
		dish: {
			title: "Your dish is ready",
			intro: "For this role, the brigade serves:",
			note: "Pick a dish to visit its station.",
			meta: (station, share) => `${station}, ${share} of your order`,
			outside: "Not on the menu:",
		},
		bill: {
			open: "The bill",
			title: "The bill",
			table: "Chef's table · recruiter",
			empty: "Nothing tasted yet: place an order, or visit a station.",
			order: (label) => `Order: ${label}`,
			visit: (station) => `Visit: ${station}`,
			play: (station) => `Tasting: ${station}`,
			price: "on the house",
			total: "Total",
			totalValue: "€0",
			settle:
				"The house is treating you. To settle, a conversation with the chef will do.",
			write: "Write to the chef",
			mailSubject: "Meeting via La Brigade",
			cv: "The CV to take away (PDF)",
			newTab: "(opens in a new tab)",
			share: "Pass the kitchen on to a colleague",
			shared: "Link copied: it opens straight onto the kitchen.",
			copied: "✓ Link copied",
			copyThis: "Copy this link (Ctrl+C): it opens straight onto the kitchen.",
			linkLabel: "Link to the kitchen",
			close: "Close",
		},
		visit: {
			back: "Back to the kitchen",
			play: "Play this station",
			takePass: "Take the pass",
			read: "Read about the project",
			soon: "This station opens soon.",
		},
		stations: {
			pass: {
				name: "The pass",
				concept:
					"Nothing leaves without the chef's check: every decision the agent makes is verified, and its reason written down, before the plate goes out.",
			},
			delivery: {
				name: "Deliveries",
				concept:
					"When a new document reaches the file, only the shelf it concerns gets rearranged, not the whole storeroom.",
			},
			library: {
				name: "The recipe library",
				concept:
					"Ask a question, and the commis comes back with the right page, diagrams included.",
			},
			coldroom: {
				name: "The sealed kitchen",
				concept:
					"Nothing leaves this room: the medical data stays put, and the model comes to it.",
			},
			pastry: {
				name: "The pastry station",
				concept:
					"Cakes that look like the real thing but aren't: realistic data, entirely synthetic.",
			},
			tools: {
				name: "The cookware",
				concept:
					"The whole brigade's kit: in-house libraries, SDKs, and the choice of coding assistants.",
			},
		},
		stamp: "Checked",
		bubbles: {
			coming: "Coming up!",
			yes: "Yes, chef!",
			heat: "Heating up!",
			service: "Service!",
			right: "Spot on!",
			wrong: "No!",
			rushStart: "The pass is yours!",
			rushEnd: "Service over!",
			invite: "Any orders?",
			bill: "The bill?",
			nothing: "Nothing to cook!",
		},
		quit: "Quit",
		rush: {
			title: "Rush at the pass",
			relax: "No timer",
			rulesTitle: "House rules",
			rules: [
				"Claims filed within 5 days.",
				"Coverage ceiling: €15,000.",
				"Required documents: claim form, photos, repair quote.",
				"Disputed account: the neighbour's statement is needed.",
				"Storm damage: a possible exclusion, for the claims handler to decide.",
			],
			delay: "Filed after",
			quote: "Repair quote",
			decision: "Your call",
			outcomes: {
				offer: "Offer a settlement",
				missing: "Request a document",
				escalation: "Refer to the claims handler",
			},
			stamps: {
				offer: "Settled",
				missing: "Docs requested",
				escalation: "Referred",
			},
			pieces: {
				declaration: "Claim form",
				photos: "Photos of the damage",
				quote: "Repair quote",
				statement: "Neighbour's statement",
			},
			stories: {
				clean:
					"The lorry reversed into the neighbour's gate. Everything's here.",
				"no-quote":
					"Reversing, one bent gate. The policyholder has sent photos.",
				late: "A wing mirror against a gate, reported after the bank holiday weekend.",
				storm: "A branch came down on the gate in last night's storm.",
				disputed: "The driver swears the gate was already damaged.",
				ceiling:
					"The wrought-iron gate of a manor house, to be rebuilt from scratch.",
				shared:
					"Conflicting accounts, but the neighbour has signed a statement.",
			},
			progress: (index, total) => `Claim ${index} of ${total}`,
			days: (count) => `${count} day${count === 1 ? "" : "s"}`,
			notReceived: "not received",
			verdict: {
				right: "Spot on: same call as the chef.",
				late: "Too late: the chef made the call without you.",
				wrong: "Not quite.",
				chef: (outcome, ms) => `The chef: ${outcome}, in ${ms} ms.`,
			},
			next: "Next claim",
			result: "See the result",
			endTitle: "Service over",
			score: (right, total, seconds) =>
				`You: ${right} good call${right === 1 ? "" : "s"} out of ${total}, in ${seconds} s.`,
			chefScore: (total, ms) =>
				`The chef, in other words the agent: ${total} out of ${total}, in ${ms} ms all told, with the reason behind every decision. That's the whole point of an auditable agent: it applies the rules every single time, and it tells you why.`,
			again: "Play again",
			howItDecides: "See how the agent decides",
		},
	},
};

export const copy: Record<Lang, BrigadeCopy> = {
	fr: typographize(raw.fr),
	en: raw.en,
};

interface VerdictReasons {
	missing: (piece: string) => string;
	complete: string;
	failed: Record<CheckId, string>;
}

/**
 * The reasons judge() (rush.ts) gives for a verdict. They stay plain text, like the engine's own output
 * and as rush.test.ts checks them: main.ts applies French typography when it shows them.
 */
export const verdictReasons: Record<Lang, VerdictReasons> = {
	fr: {
		missing: (piece) => `Pièce manquante : ${piece}`,
		complete: "Dossier complet, dans les délais et sous le plafond",
		failed: {
			source: "La citation du modèle ne vient d'aucune pièce reçue",
			classified: "Une pièce n'a pas été classée",
			required: "Une pièce obligatoire manque",
			delay: "Déclaration hors délai",
			ceiling: "Montant au-dessus du plafond",
			liability: "Responsabilité non établie",
			exclusion: "Exclusion possible : événement climatique",
		},
	},
	en: {
		missing: (piece) => `Missing document: ${piece}`,
		complete: "Complete, on time and under the ceiling",
		failed: {
			source: "The model quoted a document never received",
			classified: "A document was left unclassified",
			required: "A required document is missing",
			delay: "Claim filed late",
			ceiling: "Amount above the ceiling",
			liability: "Liability not established",
			exclusion: "Possible exclusion: weather event",
		},
	},
};

/** Locale for Intl: percentages, amounts and milliseconds. */
export const intlLocale: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };
