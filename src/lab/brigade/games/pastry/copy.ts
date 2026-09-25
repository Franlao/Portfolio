import { typographize } from "../../../../lib/typo";
import type { Lang } from "../types";
import {
	AGE_BANDS,
	type CardField,
	type FlawId,
	type Side,
	type VariableId,
	variables,
} from "./logic";

/*
 * Every displayed string, in French and in English. Both objects have the same shape
 * (the type checks it, and a test walks it); only the words and the number format change,
 * the values come from the same seeded logic.
 */

// Written as a char code so the invisible character stays readable in the source.
const NBSP = String.fromCharCode(0x00a0);

/** French number: decimal comma and a true minus sign. */
export function frNumber(value: number, digits = 0): string {
	const text = Math.abs(value).toFixed(digits).replace(".", ",");
	const isZero = /^[0,]+$/.test(text);
	return value < 0 && !isZero ? `−${text}` : text;
}

const enFormats = new Map<number, Intl.NumberFormat>();

/** British number, through Intl: decimal point, thousands comma, never a "-0.0". */
export function enNumber(value: number, digits = 0): string {
	let format = enFormats.get(digits);
	if (!format) {
		format = new Intl.NumberFormat("en-GB", {
			minimumFractionDigits: digits,
			maximumFractionDigits: digits,
		});
		enFormats.set(digits, format);
	}
	// Rounding first turns a tiny negative into -0, and -0 === 0: no stray minus sign.
	const rounded = Number(value.toFixed(digits));
	return format.format(rounded === 0 ? 0 : rounded);
}

const letter = (side: Side) => side.toUpperCase();

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

/* French. */

const frPlural = (count: number, word: string) =>
	`${count}${NBSP}${word}${count > 1 ? "s" : ""}`;

const frVariable: Record<
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
function frWithUnit(value: number, id: VariableId, digits = 0): string {
	const { unit } = frVariable[id];
	const number = frNumber(value, digits);
	return unit === "ans" ? `${number}${NBSP}ans` : `${number}${unit}`;
}

function frGlitch(field: CardField, value: number): string {
	if (field === "bmi") return `Un IMC de ${frNumber(value, 1)}`;
	if (value < 0) return `Un âge de ${frNumber(value)} ans`;
	return `Un patient de ${frNumber(value)} ans`;
}

const frFlaws: Record<FlawId, FlawCopy> = {
	narrow: {
		name: "des valeurs trop sages",
		title: "Trop sage.",
		text: (variable) =>
			`Tout le monde se serre autour de ${frVariable[variable].mean} : les patients extrêmes ont disparu, alors qu'une étude ne peut pas s'en passer.`,
		proof: (real, fake, variable) =>
			`écart-type ${frVariable[variable].of} : réel ${frWithUnit(real, variable)} · synthétique ${frWithUnit(fake, variable)}`,
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
			`écart entre le plus jeune et le plus âgé : réel ${frPlural(real, "an")} · synthétique ${frPlural(fake, "an")}`,
		shout: "Toujours le même !",
	},
	impossible: {
		name: "une valeur impossible",
		title: "Impossible.",
		text: (_, glitch) =>
			`${glitch ? frGlitch(glitch.field, glitch.value) : "Une valeur impossible"} : le générateur imite la forme des chiffres sans en connaître le sens. Un contrôle des bornes l'aurait arrêté.`,
		proof: (real, fake) =>
			`valeurs hors bornes : réel ${real} · synthétique ${fake}`,
		shout: "Ça n'existe pas !",
	},
};

const fr = {
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
	flaws: frFlaws,

	chart: {
		histogram: (id: VariableId, counts: number[]) => {
			const { min, max } = variables[id];
			const { the, digits } = frVariable[id];
			return `Histogramme de ${the}, de ${frNumber(min, digits)} à ${frWithUnit(max, id, digits)}, en ${counts.length} tranches : ${counts.join(" ; ")}.`;
		},
		axis: (id: VariableId) => {
			const { min, max } = variables[id];
			const { digits } = frVariable[id];
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
					`de ${from} à ${to} ans : ${frWithUnit(means[i], "tension")}`,
			).join(" ; ")}.`,
		scatterAxis: { x: "âge →", y: "↑ tension" },
		cards: {
			caption: (side: Side) => `Fournée ${letter(side)}, cinq patients`,
			head: { age: "âge", tension: "tension", bmi: "IMC" },
			note: "âge en ans, tension en mmHg",
			faulty: "valeur impossible",
		},
		/** Card values, as a French lab sheet prints them. */
		cardValue: (field: CardField, value: number) =>
			frNumber(value, field === "bmi" ? 1 : 0),
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

export type Copy = typeof fr;

/* English: an idiomatic rewrite, not a word-for-word one. No frTypo, “ ” quotes, en-GB numbers. */

const n = enNumber;

const years = (count: number) => {
	const text = n(count);
	return `${text} ${text === "1" ? "year" : "years"}`;
};

const enVariable: Record<
	VariableId,
	{ name: string; mean: string; unit: string; digits: number }
> = {
	age: { name: "age", mean: "the average age", unit: "", digits: 0 },
	tension: {
		name: "blood pressure",
		mean: "the average blood pressure",
		unit: " mmHg",
		digits: 0,
	},
	glycemia: {
		name: "fasting blood sugar",
		mean: "the average blood sugar",
		unit: " g/L",
		digits: 1,
	},
	bmi: { name: "BMI", mean: "the average BMI", unit: "", digits: 0 },
};

/** "14 years" or "14 mmHg". */
function enWithUnit(value: number, id: VariableId, digits = 0): string {
	if (id === "age") return years(value);
	return `${n(value, digits)}${enVariable[id].unit}`;
}

function enGlitch(field: CardField, value: number): string {
	if (field === "bmi") return `A BMI of ${n(value, 1)}`;
	if (value < 0) return `An age of ${years(value)}`;
	return `A ${n(value)}-year-old patient`;
}

const enFlaws: Record<FlawId, FlawCopy> = {
	narrow: {
		name: "values that play it too safe",
		title: "Too tame.",
		text: (variable) =>
			`Everyone huddles around ${enVariable[variable].mean}: the extreme patients have vanished, yet no study can do without them.`,
		proof: (real, fake, variable) =>
			`standard deviation of ${enVariable[variable].name}: real ${enWithUnit(real, variable)} · synthetic ${enWithUnit(fake, variable)}`,
		shout: "Too tame!",
	},
	bumps: {
		name: "two groups blended into one",
		title: "A bump's gone missing.",
		text: () =>
			"Real blood sugar has two bumps: patients without diabetes and those with it. The generator blended them into a single bell: the average is right, the shape isn't.",
		proof: (real, fake) =>
			`number of bumps: real ${n(real)} · synthetic ${n(fake)}`,
		shout: "A bump's gone missing!",
	},
	skew: {
		name: "a bell curve that's too perfect",
		title: "Too perfect.",
		text: () =>
			"A textbook symmetrical bell, without a single wobble. Real BMI leans right, with a long tail of high values, and hardly anyone under 16.",
		proof: (real, fake) =>
			`skewness: real ${n(real, 1)} · synthetic ${n(fake, 1)}`,
		shout: "Too perfect!",
	},
	link: {
		name: "the link between age and blood pressure, lost",
		title: "The link is gone.",
		text: () =>
			"Each column is right on its own, but in real patients blood pressure rises with age. The generator learnt the columns one at a time.",
		proof: (real, fake) =>
			`correlation between age and blood pressure: real ${n(real, 2)} · synthetic ${n(fake, 2)}`,
		shout: "The link is gone!",
	},
	collapse: {
		name: "the same patient every time",
		title: "Same cake, every time.",
		text: () =>
			"The generator found one recipe that gets through and serves it up again and again. That's mode collapse, a classic GAN failure.",
		proof: (real, fake) =>
			`gap between the youngest and the oldest: real ${years(real)} · synthetic ${years(fake)}`,
		shout: "Same old cake!",
	},
	impossible: {
		name: "an impossible value",
		title: "Impossible.",
		text: (_, glitch) =>
			`${glitch ? enGlitch(glitch.field, glitch.value) : "An impossible value"}: the generator mimics what numbers look like without knowing what they mean. A range check would have stopped it.`,
		proof: (real, fake) =>
			`out-of-range values: real ${n(real)} · synthetic ${n(fake)}`,
		shout: "Not humanly possible!",
	},
};

const en: Copy = {
	title: "Real or synthetic?",
	intro:
		"Unmask the batches of synthetic patients, then tune the generator yourself.",
	start: "Pastry's all yours!",

	quizLabel: "The batches",
	rule: "One batch comes from real patients, the other from the generator. Which one is synthetic?",
	fictional: "All the data is fictional, the “real” batches included.",
	progress: (index: number, total: number) =>
		`Batch ${n(index + 1)} of ${n(total)}`,
	batch: (side: Side) => `Batch ${letter(side)}`,
	choice: (side: Side) => `Batch ${letter(side)}`,
	choicesLabel: "Which one came out of the generator?",
	realTag: "real",
	stamp: "synthetic",
	right: (side: Side) =>
		`✓ Well spotted: batch ${letter(side)} came out of the generator.`,
	wrong: (side: Side) => `✗ Not quite: batch ${letter(side)} was the fake.`,
	proofLabel: "the check",
	next: "Next batch",
	toBench: "On to the generator",
	shoutRight: "Well spotted!",
	flaws: enFlaws,

	chart: {
		histogram: (id: VariableId, counts: number[]) => {
			const { min, max } = variables[id];
			const { name, digits } = enVariable[id];
			return `Histogram of ${name}, from ${n(min, digits)} to ${enWithUnit(max, id, digits)}, in ${n(counts.length)} bins: ${counts.map((count) => n(count)).join(", ")}.`;
		},
		axis: (id: VariableId) => {
			const { min, max } = variables[id];
			const { digits } = enVariable[id];
			const names: Record<VariableId, string> = {
				age: "age, in years",
				tension: "blood pressure, mmHg",
				glycemia: "blood sugar, in g/L",
				bmi: "BMI",
			};
			return {
				min: n(min, digits),
				name: names[id],
				max: n(max, digits),
			};
		},
		scatter: (size: number, means: number[]) =>
			`Scatter plot of ${n(size)} patients, with age along the bottom and blood pressure up the side. Average blood pressure ${AGE_BANDS.map(
				([from, to], i) =>
					`from ${n(from)} to ${n(to)} years old: ${enWithUnit(means[i], "tension")}`,
			).join("; ")}.`,
		scatterAxis: { x: "age →", y: "↑ blood pressure" },
		cards: {
			caption: (side: Side) => `Batch ${letter(side)}, five patients`,
			// "BP" keeps the column narrow on a phone; the note under the table spells it out.
			head: { age: "age", tension: "BP", bmi: "BMI" },
			note: "age in years, blood pressure (BP) in mmHg",
			faulty: "impossible value",
		},
		cardValue: (field: CardField, value: number) =>
			n(value, field === "bmi" ? 1 : 0),
	},

	bench: {
		label: "Tuning the generator",
		progress: "Tuning the generator",
		heading: "Your turn to tune the generator",
		note: "Too loose, and the generator serves up any old thing. Too faithful, and it copies real patients. Find the setting that passes both checks, then serve the batch.",
		chart:
			"Scatter plot of forty real patients and forty synthetic ones, with age along the bottom and blood pressure up the side.",
		legend: {
			real: "real patients",
			fake: "synthetic patients",
			copy: "copy of a real patient",
		},
		slider: "Generator fidelity",
		ends: { low: "unrecognisable", high: "carbon copy" },
		zone: "sweet spot",
		resemblance: {
			label: "likeness",
			detail: (min: number) =>
				`Averages, spreads and correlation, compared with the real ones. Threshold: at least ${n(min)}%.`,
		},
		risk: {
			label: "re-identification risk",
			detail: (count: number, total: number, max: number) =>
				`${n(count)} of ${n(total)} synthetic patients ${count === 1 ? "is" : "are"} nearly identical to a real one. Threshold: at most ${n(max)}%.`,
		},
		percent: (value: number) => `${n(value)}%`,
		pass: "✓",
		fail: "✗",
		passText: "check passed",
		failText: "check failed",
		valueText: (fidelity: number, resemblance: number, risk: number) =>
			`${n(fidelity)} out of 100: likeness ${n(resemblance)}%, risk ${n(risk)}%`,
		inZone: "✓ Sweet spot: both checks pass.",
		outZone: "Outside the sweet spot.",
		serve: "Serve this batch",
		bland: (resemblance: number, min: number) =>
			`✗ Sent back: ${n(resemblance)}% likeness, it needs ${n(min)}. Researchers would get nothing out of it.`,
		leak: (count: number, total: number) =>
			`✗ Sent back: ${n(count)} of ${n(total)} synthetic patients are nearly identical to real ones. They could be re-identified.`,
		served: (resemblance: number, risk: number) =>
			`✓ Served: ${n(resemblance)}% likeness, ${n(risk)}% risk. Believable patients who are nobody at all.`,
		stamp: "served",
		result: "See how you did",
		shoutStart: "Tune the generator!",
		shoutBland: "What a dog's dinner!",
		shoutLeak: "No copies in the window!",
		shoutServed: "Batch served!",
	},

	end: {
		heading: "The shop window is ready",
		score: (right: number, total: number) =>
			`You unmasked ${n(right)} of the ${n(total)} synthetic batches.`,
		recap: "What gives a synthetic batch away:",
		found: "spotted",
		missed: "missed",
		setting: (resemblance: number, risk: number) =>
			`Your setting: ${n(resemblance)}% likeness, ${n(risk)}% re-identification risk.`,
		project:
			"That's the idea behind my Synthetic Healthcare Data Generator, a personal project from 2025: GANs, VAEs and LLMs (via the Mistral API) generate synthetic health data that keeps the statistical properties of the real data. An interactive interface lets you configure the generation and analyse the results through comparison.",
		again: "Play again",
		back: "Back to the kitchen",
		shout: "The window's ready!",
	},
};

/** French goes through French typography; English is left as written. */
export const copies: Record<Lang, Copy> = { fr: typographize(fr), en };
