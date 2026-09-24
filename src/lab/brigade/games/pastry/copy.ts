import { typographize } from "../../../../lib/typo";
import {
	AGE_BANDS,
	type CardField,
	type FlawId,
	type Side,
	type VariableId,
	variables,
} from "./logic";

// Written as a char code so the invisible character stays readable in the source.
const NBSP = String.fromCharCode(0x00a0);

/** French number: decimal comma and a true minus sign. */
export function frNumber(value: number, digits = 0): string {
	const text = Math.abs(value).toFixed(digits).replace(".", ",");
	const isZero = /^[0,]+$/.test(text);
	return value < 0 && !isZero ? `−${text}` : text;
}

const letter = (side: Side) => side.toUpperCase();

const plural = (count: number, word: string) =>
	`${count}${NBSP}${word}${count > 1 ? "s" : ""}`;

const variableText: Record<
	VariableId,
	{ the: string; of: string; mean: string; unit: string; digits: number }
> = {
	age: {
		the: "l'âge",
		of: "de l'âge",
		mean: "l'âge moyen",
		unit: "ans",
		digits: 0,
	},
	tension: {
		the: "la tension",
		of: "de la tension",
		mean: "la tension moyenne",
		unit: `${NBSP}mmHg`,
		digits: 0,
	},
	glycemia: {
		the: "la glycémie à jeun",
		of: "de la glycémie à jeun",
		mean: "la glycémie moyenne",
		unit: `${NBSP}g/L`,
		digits: 1,
	},
	bmi: {
		the: "l'IMC",
		of: "de l'IMC",
		mean: "l'IMC moyen",
		unit: "",
		digits: 0,
	},
};

/** "14 ans" or "14 mmHg": the unit glued to its number. */
function withUnit(value: number, id: VariableId, digits = 0): string {
	const { unit } = variableText[id];
	const number = frNumber(value, digits);
	return unit === "ans" ? `${number}${NBSP}ans` : `${number}${unit}`;
}

function glitchText(field: CardField, value: number): string {
	if (field === "bmi") return `Un IMC de ${frNumber(value, 1)}`;
	if (value < 0) return `Un âge de ${frNumber(value)} ans`;
	return `Un patient de ${frNumber(value)} ans`;
}

interface FlawCopy {
	/** Short name, for the recap at the end. */
	name: string;
	title: string;
	/** What gives the synthetic batch away. */
	text: (
		variable: VariableId,
		glitch?: { field: CardField; value: number },
	) => string;
	/** The control that tells the batches apart. */
	proof: (real: number, fake: number, variable: VariableId) => string;
	/** Chef's bubble when the visitor missed it, under 30 characters. */
	shout: string;
}

const flaws: Record<FlawId, FlawCopy> = {
	narrow: {
		name: "des valeurs trop sages",
		title: "Trop sage.",
		text: (variable) =>
			`Tout le monde se serre autour de ${variableText[variable].mean} : les patients extrêmes ont disparu, alors qu'une étude ne peut pas s'en passer.`,
		proof: (real, fake, variable) =>
			`écart-type ${variableText[variable].of} : réel ${withUnit(real, variable)} · synthétique ${withUnit(fake, variable)}`,
		shout: "Trop sage !",
	},
	bumps: {
		name: "deux populations fondues en une",
		title: "Il manque une bosse.",
		text: () =>
			"La vraie glycémie a deux bosses : les patients sans diabète et ceux qui en ont un. Le générateur les a fondues en une seule cloche : la moyenne est juste, la forme ne l'est pas.",
		proof: (real, fake) =>
			`nombre de bosses : réel ${real} · synthétique ${fake}`,
		shout: "Il manque une bosse !",
	},
	skew: {
		name: "une cloche trop parfaite",
		title: "Trop parfait.",
		text: () =>
			"Une cloche symétrique de manuel, sans le moindre accroc. Le vrai IMC penche à droite, avec une longue traîne de valeurs élevées, et presque personne sous 16.",
		proof: (real, fake) =>
			`asymétrie : réel ${frNumber(real, 1)} · synthétique ${frNumber(fake, 1)}`,
		shout: "Trop parfait !",
	},
	link: {
		name: "le lien entre l'âge et la tension, perdu",
		title: "Le lien a disparu.",
		text: () =>
			"Chaque colonne prise à part est juste, mais chez les vrais patients la tension monte avec l'âge. Le générateur a appris les colonnes une par une.",
		proof: (real, fake) =>
			`corrélation entre l'âge et la tension : réel ${frNumber(real, 2)} · synthétique ${frNumber(fake, 2)}`,
		shout: "Le lien a disparu !",
	},
	collapse: {
		name: "toujours le même patient",
		title: "Toujours le même gâteau.",
		text: () =>
			"Le générateur a trouvé une recette qui passe et la ressert à chaque fois. C'est l'effondrement de mode, un défaut classique des GAN.",
		proof: (real, fake) =>
			`écart entre le plus jeune et le plus âgé : réel ${plural(real, "an")} · synthétique ${plural(fake, "an")}`,
		shout: "Toujours le même !",
	},
	impossible: {
		name: "une valeur impossible",
		title: "Impossible.",
		text: (_, glitch) =>
			`${glitch ? glitchText(glitch.field, glitch.value) : "Une valeur impossible"} : le générateur imite la forme des chiffres sans en connaître le sens. Un contrôle des bornes l'aurait arrêté.`,
		proof: (real, fake) =>
			`valeurs hors bornes : réel ${real} · synthétique ${fake}`,
		shout: "Ça n'existe pas !",
	},
};

const text = {
	title: "Vrai ou synthétique ?",
	intro:
		"Démasquez les fournées de patients synthétiques, puis réglez vous-même le générateur.",
	start: "À vous la pâtisserie !",

	quizLabel: "Les fournées",
	rule: "Une fournée vient de vrais patients, l'autre du générateur. Laquelle est synthétique ?",
	fictional: "Toutes les données sont fictives, les « vraies » comprises.",
	progress: (index: number, total: number) =>
		`Fournée ${index + 1} sur ${total}`,
	batch: (side: Side) => `Fournée ${letter(side)}`,
	choice: (side: Side) => `La fournée ${letter(side)}`,
	choicesLabel: "Laquelle sort du générateur ?",
	realTag: "vraie",
	stamp: "synthétique",
	right: (side: Side) =>
		`✓ Bien vu : la fournée ${letter(side)} sort du générateur.`,
	wrong: (side: Side) =>
		`✗ Raté : la copie, c'était la fournée ${letter(side)}.`,
	proofLabel: "le contrôle",
	next: "Fournée suivante",
	toBench: "Passer au réglage",
	shoutRight: "Bien vu !",
	flaws,

	chart: {
		histogram: (id: VariableId, counts: number[]) => {
			const { min, max } = variables[id];
			const { the, digits } = variableText[id];
			return `Histogramme de ${the}, de ${frNumber(min, digits)} à ${withUnit(max, id, digits)}, en ${counts.length} tranches : ${counts.join(" ; ")}.`;
		},
		axis: (id: VariableId) => {
			const { min, max } = variables[id];
			const { digits } = variableText[id];
			const names: Record<VariableId, string> = {
				age: "âge, en ans",
				tension: "tension, en mmHg",
				glycemia: "glycémie, en g/L",
				bmi: "IMC",
			};
			return {
				min: frNumber(min, digits),
				name: names[id],
				max: frNumber(max, digits),
			};
		},
		scatter: (size: number, means: number[]) =>
			`Nuage de ${size} patients, l'âge en abscisse et la tension en ordonnée. Tension moyenne ${AGE_BANDS.map(
				([from, to], i) =>
					`de ${from} à ${to} ans : ${withUnit(means[i], "tension")}`,
			).join(" ; ")}.`,
		scatterAxis: { x: "âge →", y: "↑ tension" },
		cards: {
			caption: (side: Side) => `Fournée ${letter(side)}, cinq patients`,
			head: { age: "âge", tension: "tension", bmi: "IMC" },
			note: "âge en ans, tension en mmHg",
			faulty: "valeur impossible",
		},
	},

	bench: {
		label: "Le réglage du générateur",
		progress: "Réglage du générateur",
		heading: "À vous de régler le générateur",
		note: "Trop libre, le générateur sert n'importe quoi. Trop fidèle, il recopie de vrais patients. Trouvez le réglage qui passe les deux contrôles, puis servez la fournée.",
		chart:
			"Nuage de quarante vrais patients et de quarante patients synthétiques, l'âge en abscisse et la tension en ordonnée.",
		legend: {
			real: "vrais patients",
			fake: "patients synthétiques",
			copy: "copie d'un vrai patient",
		},
		slider: "Fidélité du générateur",
		ends: { low: "méconnaissable", high: "copie conforme" },
		zone: "zone d'équilibre",
		resemblance: {
			label: "ressemblance",
			detail: (min: number) =>
				`Moyennes, dispersions et corrélation, comparées aux vraies. Seuil : ${min} % minimum.`,
		},
		risk: {
			label: "risque de ré-identification",
			detail: (count: number, total: number, max: number) =>
				`${count} patient${count > 1 ? "s" : ""} synthétique${count > 1 ? "s" : ""} sur ${total} presque identique${count > 1 ? "s" : ""} à un vrai. Seuil : ${max} % maximum.`,
		},
		percent: (value: number) => `${value} %`,
		pass: "✓",
		fail: "✗",
		passText: "contrôle réussi",
		failText: "contrôle échoué",
		valueText: (fidelity: number, resemblance: number, risk: number) =>
			`${fidelity} sur 100 : ressemblance ${resemblance} %, risque ${risk} %`,
		inZone: "✓ Zone d'équilibre : les deux contrôles passent.",
		outZone: "Hors de la zone d'équilibre.",
		serve: "Servir cette fournée",
		bland: (resemblance: number, min: number) =>
			`✗ Refusée : ${resemblance} % de ressemblance, il en faut ${min}. Les chercheurs n'en tireraient rien.`,
		leak: (count: number, total: number) =>
			`✗ Refusée : ${count} patients synthétiques sur ${total} sont presque identiques à de vrais patients. On pourrait les ré-identifier.`,
		served: (resemblance: number, risk: number) =>
			`✓ Servie : ${resemblance} % de ressemblance, ${risk} % de risque. Des patients crédibles, qui ne sont personne.`,
		stamp: "servi",
		result: "Voir le résultat",
		shoutStart: "Réglez le générateur !",
		shoutBland: "Ça ne ressemble à rien !",
		shoutLeak: "Pas de copie en vitrine !",
		shoutServed: "Fournée servie !",
	},

	end: {
		heading: "La vitrine est prête",
		score: (right: number, total: number) =>
			`Vous avez démasqué ${right} fournée${right > 1 ? "s" : ""} synthétique${right > 1 ? "s" : ""} sur ${total}.`,
		recap: "Ce qui trahit une fournée synthétique :",
		found: "trouvé",
		missed: "manqué",
		setting: (resemblance: number, risk: number) =>
			`Votre réglage : ${resemblance} % de ressemblance, ${risk} % de risque de ré-identification.`,
		project:
			"C'est le principe de mon Synthetic Healthcare Data Generator, un projet personnel de 2025 : des GAN, des VAE et des LLM (via l'API Mistral) génèrent des données de santé synthétiques qui préservent les propriétés statistiques des données réelles. Une interface interactive permet de configurer la génération et d'analyser les résultats par comparaison.",
		again: "Rejouer",
		back: "Revenir à la cuisine",
		shout: "Vitrine prête !",
	},
};

/** Every displayed string goes through French typography. */
export const copy = typographize(text);

/** Card values, as a French lab sheet prints them. */
export function formatCard(field: CardField, value: number): string {
	return frNumber(value, field === "bmi" ? 1 : 0);
}
