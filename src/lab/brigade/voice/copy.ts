import type { NodeId } from "../../../components/demos/claims-agent/engine";
import type { Lang } from "../../../i18n/ui";
import type { CompetenceId } from "../../../lib/offer/competences";
import { typographize } from "../../../lib/typo";

/** Two passers-by: a line, and sometimes the answer from the next table. */
export type Exchange = readonly [string, string?];

/**
 * What only the voices say. The screen keeps its short texts; with the sound on, the
 * characters say more than they write: the chef explains what the card only names.
 * These texts are heard, and read only with subtitles on.
 */
const raw = {
	fr: {
		/** The chef calls the order to the brigade, as in any kitchen: « Table du chef ! Du RAG ! » */
		call: {
			table: "Table du chef !",
			skills: {
				agents: "Des agents !",
				rag: "Du RAG !",
				llm: "Du LLM !",
				evaluation: "De l'évaluation !",
				production: "De la mise en prod !",
				python: "Du Python !",
				ml: "Du machine learning !",
				nlp: "Du traitement du langage !",
				multimodal: "Du multimodal !",
				health: "Côté santé !",
				insurance: "Côté assurance !",
				industry: "Côté industrie !",
				"local-ai": "De l'IA locale !",
				synthetic: "Des données synthétiques !",
				data: "De la donnée !",
				cloud: "Du cloud !",
				communication: "De la pédagogie !",
				research: "De la R&D !",
				typescript: "Du TypeScript !",
				"coding-assistants": "Des assistants de code !",
				product: "Du produit !",
			} satisfies Record<CompetenceId, string>,
		},
		/** Lyon, 8 pm: bits of conversation from the café terrace and the pavement. */
		street: [
			["Tu reprends un pot ?", "Allez, un dernier !"],
			[
				"C'est quoi, une cuisine d'intelligence artificielle ?",
				"Aucune idée, mais y a du monde !",
			],
			["Santé !"],
			["On se fait un bouchon demain ?", "Avec plaisir !"],
		] as Exchange[],
		spoken: {
			/** The maître d', a « mère lyonnaise »: her bubble says the gist, her voice the welcome. */
			host: {
				welcome:
					"Bonsoir, et bienvenue à La Brigade ! Vous avez fait bon voyage ?",
				expecting:
					"Le chef vous attend : il vous a gardé sa table. Entrez quand vous voulez !",
				thisWay: "Par ici, je vous en prie !",
			},
			/** The chef's welcome at his table, one speech per card of the tour. */
			tour: [
				"Bonsoir, et bienvenue à ma table ! Je suis Solim, le chef de cette maison. Ici, chaque poste de la cuisine est un de mes projets d'IA : la bibliothèque de recettes, la cuisine fermée, la pâtisserie… Mes projets professionnels sont confidentiels, alors je vous les fais goûter autrement : les recettes sont vraies, les produits sont fictifs.",
				"Vous recrutez ? Ici, pas besoin de lire un CV : passez commande. Votre offre d'emploi, c'est votre commande. Collez-la, ou choisissez un profil en bas de l'écran : ma brigade la lit, la prépare, et les postes qui répondent à votre besoin s'allument sous vos yeux.",
				"Et le passe, c'est ici, devant moi. Rien ne sort de la cuisine sans mon contrôle. C'est ma façon de travailler avec l'IA : les agents préparent, mais chaque étape est vérifiée avant d'arriver jusqu'à vous. À vous de jouer !",
			],
			/** The first order, explained by the chef as it cooks: what each step is for. */
			narration: {
				model: [
					"Voilà votre bon. C'est mon commis qui l'a écrit : un modèle de langage, Mistral, a lu votre offre. Pour chaque ligne, il doit citer mot pour mot le passage de l'offre d'où elle vient. En IA, on appelle ça une extraction par LLM.",
					"Mais un modèle peut inventer. Alors je vérifie : chaque citation doit se retrouver dans votre offre. Une ligne qui ne cite rien, je la renvoie. C'est l'ancrage : c'est comme ça qu'on se protège des hallucinations.",
					"Maintenant, chaque poste regarde quelle part de votre commande il sait cuisiner. Plus il en couvre, plus il s'allume. Ici, pas de modèle : c'est du calcul, reproductible, que je peux vous expliquer ligne par ligne.",
					"Et on arrive au passe. Le modèle a lu, le code a vérifié, puis décidé. Le modèle n'a jamais le dernier mot : c'est ça, une IA qu'on peut mettre en production.",
				],
				steps: [
					"Voilà votre bon. Votre offre a été découpée phrase par phrase : c'est la requête, le point de départ de tout le service.",
					"Mon commis file au garde-manger : il prend un bocal pour chaque compétence repérée dans votre offre. C'est l'extraction : on transforme un texte libre en ingrédients qu'on peut compter.",
					"Maintenant, chaque poste regarde quelle part de votre commande il sait cuisiner. Plus il en couvre, plus il s'allume : c'est le rapprochement.",
					"Et on arrive au passe : chaque étape est contrôlée avant de servir. Ce soir, pas de modèle de langage, du code déterministe suffisait. Savoir quand ne pas utiliser un LLM, ça fait aussi partie du métier.",
				],
			},
		},
		/** The chef reads his notebook to the visitor: one line per step of the agent. */
		notebook: {
			open: "Mon carnet de recettes. Voilà comment l'agent a traité ce dossier, étape par étape.",
			nodes: {
				reception:
					"D'abord, la réception. C'est du code, une simple règle : sans déclaration de sinistre, on n'ouvre pas le dossier.",
				classification:
					"Ensuite, le modèle classe les pièces. Sa réponse doit suivre un schéma précis : le code la vérifie avant d'aller plus loin.",
				coverage:
					"Le contrat, c'est du code : le délai, le plafond, la franchise. Aucune place pour l'interprétation.",
				circumstances:
					"Les circonstances, c'est là qu'il faut lire et comprendre : c'est le travail du modèle. Et il doit citer la pièce d'où il tire sa conclusion.",
				consistency:
					"Puis le contrôle de cohérence : sept vérifications. C'est lui qui choisit la suite, pas le modèle.",
				missing:
					"Il manque une pièce : l'agent prépare la demande. Il ne devine pas ce qu'il n'a pas.",
				escalation:
					"Un contrôle a échoué : le dossier part chez un gestionnaire. Un bon agent sait quand passer la main.",
				offer:
					"Tout est en règle : le code calcule le montant, et le modèle rédige le courrier.",
				register:
					"Enfin, chaque pièce est inscrite au bordereau. Tout est tracé, tout peut être rejoué.",
			} satisfies Record<NodeId, string>,
			same: "Même décision que l'agent : bien vu !",
			different:
				"Vous aviez choisi autrement : regardez ce qui est en rouge, c'est ce qui a fait la différence.",
		},
		captions: "Sous-titres",
		credit:
			"Voix de synthèse : Voxtral, de Mistral AI. Les répliques sont écrites à la main.",
	},
	en: {
		call: {
			table: "Chef's table!",
			skills: {
				agents: "Agents!",
				rag: "RAG!",
				llm: "LLMs!",
				evaluation: "Evaluation!",
				production: "Production code!",
				python: "Python!",
				ml: "Machine learning!",
				nlp: "Language processing!",
				multimodal: "Multimodal!",
				health: "Healthcare!",
				insurance: "Insurance!",
				industry: "Industry!",
				"local-ai": "Local AI!",
				synthetic: "Synthetic data!",
				data: "Data!",
				cloud: "Cloud!",
				communication: "Clear explaining!",
				research: "R&D!",
				typescript: "TypeScript!",
				"coding-assistants": "Coding assistants!",
				product: "Product!",
			} satisfies Record<CompetenceId, string>,
		},
		// The street is in Lyon: it speaks French, except for one lost tourist.
		street: [
			["Tu reprends un pot ?", "Allez, un dernier !"],
			[
				"C'est quoi, une cuisine d'intelligence artificielle ?",
				"Aucune idée, mais y a du monde !",
			],
			["Santé !"],
			["Excuse me, is this the AI restaurant?", "Oui, c'est ici !"],
		] as Exchange[],
		spoken: {
			host: {
				welcome:
					"Good evening, and welcome to La Brigade! Did you have a good trip?",
				expecting:
					"The chef is expecting you: he's kept his table for you. Step inside whenever you like!",
				thisWay: "This way, please!",
			},
			tour: [
				"Good evening, and welcome to my table! I'm Solim, the chef of this house. Every station in this kitchen is one of my AI projects: the recipe library, the closed kitchen, the pastry… My work projects are confidential, so I let you taste them another way: the recipes are real, the produce is fictional.",
				"Hiring? Then there's no CV to read here: place an order. Your job ad is your order. Paste it, or pick a profile at the bottom of the screen: my brigade reads it, cooks it, and the stations that match your needs light up before your eyes.",
				"And the pass is right here, in front of me. Nothing leaves this kitchen without my check. That's how I work with AI: the agents prepare, but every step is checked before it reaches you. Over to you!",
			],
			narration: {
				model: [
					"Here's your ticket. My commis wrote it: a language model, Mistral, read your job ad. For every line, it has to quote, word for word, the part of the ad it comes from. In AI terms, that's LLM extraction.",
					"But a model can make things up. So I check: every quote has to be found in your ad. A line that quotes nothing, I send back. That's called grounding: it's how we guard against hallucinations.",
					"Now each station looks at how much of your order it knows how to cook. The more it covers, the brighter it glows. No model here: it's plain arithmetic, reproducible, and I can explain it line by line.",
					"And here we are at the pass. The model read, the code checked, then decided. The model never has the last word: that's what AI you can put into production looks like.",
				],
				steps: [
					"Here's your ticket. Your job ad was split sentence by sentence: that's the query, where the whole service starts.",
					"My commis runs to the pantry and takes one jar for each skill found in your ad. That's extraction: turning free text into ingredients you can count.",
					"Now each station looks at how much of your order it knows how to cook. The more it covers, the brighter it glows: that's matching.",
					"And here we are at the pass: every step is checked before serving. Tonight, no language model: deterministic code was enough. Knowing when not to use an LLM is part of the job too.",
				],
			},
		},
		notebook: {
			open: "My recipe notebook. Here's how the agent handled this claim, step by step.",
			nodes: {
				reception:
					"First, intake. That's code, a simple rule: no claim form, no file.",
				classification:
					"Then the model sorts the documents. Its answer has to follow a strict schema, and code checks it before going any further.",
				coverage:
					"The policy is code: the deadline, the ceiling, the deductible. No room for interpretation.",
				circumstances:
					"The circumstances are where you need to read and understand: that's the model's job. And it has to quote the document its conclusion comes from.",
				consistency:
					"Then the consistency check: seven checks. It picks what happens next, not the model.",
				missing:
					"A document is missing: the agent drafts the request. It doesn't guess what it doesn't have.",
				escalation:
					"A check failed: the claim goes to a claims handler. A good agent knows when to hand over.",
				offer:
					"Everything's in order: code computes the amount, and the model drafts the letter.",
				register:
					"Finally, every document goes into the register. Everything is traced, everything can be replayed.",
			} satisfies Record<NodeId, string>,
			same: "Same decision as the agent: well spotted!",
			different:
				"You chose differently: look at what's in red, that's what made the difference.",
		},
		captions: "Subtitles",
		credit:
			"Synthetic voices: Voxtral, by Mistral AI. Every line is written by hand.",
	},
};

export const voiceCopy = {
	fr: typographize(raw.fr),
	en: raw.en,
} satisfies Record<Lang, unknown>;

export type VoiceCopy = (typeof voiceCopy)[Lang];
