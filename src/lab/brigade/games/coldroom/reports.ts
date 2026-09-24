import type { Report } from "./logic";

/**
 * Three fictional hospital reports. Patients, dates and values are invented: plausible enough
 * to read like the real thing, never close enough to pass for a real record (no year, no name).
 * A clickable passage is written [text|role]; the role says what the passage really is,
 * so every trap (a consultation date, a family history, the usual treatment) can explain itself.
 * The model's answers are pre-computed and replayed, like every model step on this site.
 */
export const REPORTS: readonly Report[] = [
	{
		id: "pneumo",
		service: "Médecine interne",
		patient: "patient n° 0417, 67 ans",
		paragraphs: [
			"Patient [vu par son médecin le 9 mars|consult], puis [hospitalisé le 12 mars|entry] pour [fièvre et toux|reason] depuis quatre jours.",
			"Antécédents : [diabète de type 2|history]. Dans la famille : [infarctus du père|family].",
			"Traitement habituel : [metformine|usual], [500 mg matin et soir|usualDose].",
			"La radiographie montre [une pneumopathie|diagnosis]. Évolution favorable sous antibiotique.",
			"[Sortie le 16 mars|exit] avec [amoxicilline|discharge], [1 g trois fois par jour|dosage] pendant sept jours.",
		],
		values: {
			consult: "9 mars",
			entry: "12 mars",
			reason: "fièvre et toux",
			history: "diabète de type 2",
			family: "infarctus (père)",
			usual: "metformine",
			usualDose: "500 mg × 2 par jour",
			diagnosis: "pneumopathie",
			exit: "16 mars",
			discharge: "amoxicilline",
			dosage: "1 g × 3 par jour",
		},
		model: {
			entry: { role: "entry", confidence: 0.94 },
			reason: { role: "reason", confidence: 0.89 },
			history: { role: "history", confidence: 0.92 },
			discharge: { role: "discharge", confidence: 0.86 },
			dosage: { role: "usualDose", confidence: 0.44 },
		},
		modelSeconds: [1.4, 2.9, 4.3, 5.8, 7.2],
	},
	{
		id: "cardio",
		service: "Cardiologie",
		patient: "patiente n° 1182, 74 ans",
		paragraphs: [
			"Patiente [vue le 28 janvier|consult] en consultation, puis [admise le 3 février|entry] pour [un essoufflement|reason] et des chevilles gonflées.",
			"Antécédents : [hypertension artérielle|history]. Sa sœur est suivie pour [un asthme|family].",
			"Traitement habituel : [amlodipine|usual], [5 mg le matin|usualDose].",
			"L'échographie confirme [une insuffisance cardiaque|diagnosis]. Nette amélioration.",
			"[Sortie le 9 février|exit] sous [furosémide|discharge], [40 mg chaque matin|dosage]. Amlodipine arrêtée.",
		],
		values: {
			consult: "28 janvier",
			entry: "3 février",
			reason: "essoufflement",
			history: "hypertension artérielle",
			family: "asthme (sœur)",
			usual: "amlodipine",
			usualDose: "5 mg par jour",
			diagnosis: "insuffisance cardiaque",
			exit: "9 février",
			discharge: "furosémide",
			dosage: "40 mg par jour",
		},
		model: {
			entry: { role: "consult", confidence: 0.52 },
			reason: { role: "reason", confidence: 0.9 },
			history: { role: "history", confidence: 0.93 },
			discharge: { role: "discharge", confidence: 0.88 },
			dosage: { role: "dosage", confidence: 0.84 },
		},
		modelSeconds: [1.6, 3.2, 4.4, 6.1, 7.6],
	},
	{
		id: "digest",
		service: "Gastro-entérologie",
		patient: "patient n° 2093, 52 ans",
		paragraphs: [
			"[Entré le 21 octobre|entry] pour [des douleurs abdominales|reason] et des vomissements. Son médecin l'avait [vu le 19 octobre|consult].",
			"Antécédents : [une appendicectomie|history] dans l'enfance. [Migraines chez sa mère|family].",
			"Traitement habituel : [oméprazole|usual], [20 mg le soir|usualDose].",
			"Le bilan retrouve [une gastro-entérite sévère|diagnosis], avec déshydratation. Réhydraté, il va mieux.",
			"[Sortie le 24 octobre|exit]. Prescription : [paracétamol|discharge], [1 g, trois fois par jour|dosage] au plus, si douleur.",
		],
		values: {
			entry: "21 octobre",
			reason: "douleurs abdominales",
			consult: "19 octobre",
			history: "appendicectomie",
			family: "migraines (mère)",
			usual: "oméprazole",
			usualDose: "20 mg par jour",
			diagnosis: "gastro-entérite sévère",
			exit: "24 octobre",
			discharge: "paracétamol",
			dosage: "1 g × 3 par jour au plus",
		},
		model: {
			entry: { role: "entry", confidence: 0.91 },
			reason: { role: "reason", confidence: 0.87 },
			history: { role: "history", confidence: 0.58 },
			discharge: { role: "discharge", confidence: 0.9 },
			dosage: { role: "dosage", confidence: 0.79 },
		},
		modelSeconds: [1.3, 2.8, 4.5, 5.9, 7.4],
	},
];
