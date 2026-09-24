import type { Case } from "./logic";

/**
 * A fictional technical documentation: generic parts, made-up values, no real product.
 * Each question comes with the pages the search brought back and a three-claim answer.
 * The tests check that every faithful claim is backed by its page and every invented one is not.
 */
export const cases: Case[] = [
	{
		id: "hatch",
		question: "Comment remonter la trappe de visite B ?",
		pages: [
			{
				number: 12,
				doc: "notice de montage",
				title: "trappe de visite B",
				text: [
					"Poser la trappe, puis serrer les vis ",
					{ key: "hatch-order", value: "en croix" },
					", dans l'ordre du schéma.",
				],
				figure: {
					kind: "points",
					shape: "plate",
					mark: "order",
					caption: "trappe B",
					count: { key: "hatch-screws", value: "4 vis" },
				},
			},
			{
				number: 14,
				doc: "tableau des couples",
				title: "couples de serrage",
				text: ["Clé dynamométrique, filetage sec."],
				figure: {
					kind: "table",
					head: ["élément", "couple"],
					rows: [
						{ label: "trappe A", key: "torque-a", value: "18 N·m" },
						{ label: "trappe B", key: "torque-b", value: "25 N·m" },
						{ label: "carter", key: "torque-case", value: "40 N·m" },
					],
				},
			},
			{
				number: 15,
				doc: "notice de montage",
				title: "joint de trappe",
				text: [
					"Remplacer le joint ",
					{ key: "joint-rule", value: "à chaque démontage" },
					".",
				],
				figure: {
					kind: "section",
					joint: { key: "joint-thickness", value: "2 mm" },
				},
			},
		],
		claims: [
			{
				truth: {
					text: "Serrez les 4 vis en croix",
					page: 12,
					key: "hatch-screws",
					value: "4 vis",
				},
				fake: {
					text: "Serrez les 6 vis en croix",
					page: 12,
					key: "hatch-screws",
					value: "6 vis",
				},
			},
			{
				truth: {
					text: "Couple de serrage : 25 N·m",
					page: 14,
					key: "torque-b",
					value: "25 N·m",
				},
				fake: {
					text: "Couple de serrage : 18 N·m",
					page: 14,
					key: "torque-b",
					value: "18 N·m",
				},
			},
			{
				truth: {
					text: "Remplacez le joint à chaque démontage",
					page: 15,
					key: "joint-rule",
					value: "à chaque démontage",
				},
				fake: {
					text: "Graissez le joint avant la pose",
					page: 15,
					key: "joint-grease",
					value: "graissez",
				},
			},
		],
	},
	{
		id: "bracket",
		question: "Comment préparer et fixer le support moteur ?",
		pages: [
			{
				number: 7,
				doc: "plan",
				title: "support moteur",
				text: [
					"Cotes en millimètres, tolérance ",
					{ key: "tolerance", value: "± 0,2 mm" },
					".",
				],
				figure: {
					kind: "bracket",
					hole: { key: "hole-diameter", value: "Ø 12 mm" },
					spacing: { key: "hole-spacing", value: "80 mm" },
				},
			},
			{
				number: 8,
				doc: "fiche matière",
				title: "support moteur",
				text: [
					"Après perçage, ",
					{ key: "deburr", value: "ébavurer" },
					" tous les trous.",
				],
				figure: {
					kind: "table",
					head: ["propriété", "valeur"],
					rows: [
						{ label: "matière", key: "material", value: "acier S355" },
						{ label: "épaisseur", key: "thickness", value: "8 mm" },
						{ label: "finition", key: "finish", value: "zinguée" },
					],
				},
			},
			{
				number: 9,
				doc: "notice de montage",
				title: "fixation sur châssis",
				text: [
					"Serrer les boulons à ",
					{ key: "bracket-torque", value: "50 N·m" },
					", en croix.",
				],
				figure: {
					kind: "points",
					shape: "plate",
					mark: "bolt",
					caption: "platine",
					count: { key: "bracket-bolts", value: "4 boulons" },
				},
			},
		],
		claims: [
			{
				truth: {
					text: "Percez les trous à Ø 12 mm",
					page: 7,
					key: "hole-diameter",
					value: "Ø 12 mm",
				},
				fake: {
					text: "Percez les trous à Ø 14 mm",
					page: 7,
					key: "hole-diameter",
					value: "Ø 14 mm",
				},
			},
			{
				truth: {
					text: "Il faut ébavurer tous les trous",
					page: 8,
					key: "deburr",
					value: "ébavurer",
				},
				fake: {
					text: "Il faut chanfreiner tous les trous à 45°",
					page: 8,
					key: "chamfer",
					value: "chanfreiner",
				},
			},
			{
				truth: {
					text: "Serrez les boulons à 50 N·m",
					page: 9,
					key: "bracket-torque",
					value: "50 N·m",
				},
				fake: {
					text: "Serrez les boulons à 50 N·m",
					page: 19,
					key: "bracket-torque",
					value: "50 N·m",
				},
			},
		],
	},
	{
		id: "thermal",
		question: "Le carter a-t-il tenu à l'essai thermique ?",
		pages: [
			{
				number: 21,
				doc: "note d'essai",
				title: "essai thermique",
				text: [
					"Essai de ",
					{ key: "duration", value: "2 h" },
					" à pleine charge.",
				],
				figure: {
					kind: "curve",
					peak: { key: "peak-temp", value: "95 °C" },
					limit: { key: "temp-limit", value: "110 °C" },
				},
			},
			{
				number: 22,
				doc: "note d'essai",
				title: "instrumentation",
				text: [
					"Un relevé toutes les ",
					{ key: "sampling", value: "10 s" },
					".",
				],
				figure: {
					kind: "points",
					shape: "carter",
					mark: "sensor",
					caption: "carter",
					count: { key: "sensor-count", value: "3 capteurs" },
				},
			},
			{
				number: 23,
				doc: "note d'essai",
				title: "résultats",
				text: [
					"Avis du bureau d'études : ",
					{ key: "verdict", value: "conforme" },
					".",
				],
				figure: {
					kind: "table",
					head: ["mesure", "résultat"],
					rows: [
						{ label: "déformation", key: "deformation", value: "0,1 mm" },
						{ label: "fuite d'huile", key: "leak", value: "aucune" },
						{ label: "fissure", key: "crack", value: "aucune" },
					],
				},
			},
		],
		claims: [
			{
				truth: {
					text: "Le carter a culminé à 95 °C",
					page: 21,
					key: "peak-temp",
					value: "95 °C",
				},
				fake: {
					text: "Le carter a culminé à 110 °C",
					page: 21,
					key: "peak-temp",
					value: "110 °C",
				},
			},
			{
				truth: {
					text: "Essai de 2 h à pleine charge",
					page: 21,
					key: "duration",
					value: "2 h",
				},
				fake: {
					text: "Essai de 20 h à pleine charge",
					page: 21,
					key: "duration",
					value: "20 h",
				},
			},
			{
				truth: {
					text: "Aucune fuite d'huile relevée",
					page: 23,
					key: "leak",
					value: "aucune",
				},
				fake: {
					text: "Il résiste jusqu'à 150 °C",
					page: 23,
					key: "max-temp",
					value: "150 °C",
				},
			},
		],
	},
	{
		id: "hose",
		question: "Que faut-il savoir pour poser le flexible du vérin ?",
		pages: [
			{
				number: 33,
				doc: "guide de pose",
				title: "flexibles hydrauliques",
				text: [
					"Ne jamais ",
					{ key: "twist", value: "vriller" },
					" le flexible au montage.",
				],
				figure: {
					kind: "bend",
					radius: { key: "bend-radius", value: "150 mm" },
				},
			},
			{
				number: 34,
				doc: "guide de pose",
				title: "colliers de maintien",
				text: [
					"Premier collier à ",
					{ key: "clamp-first", value: "50 mm" },
					" du raccord.",
				],
				figure: {
					kind: "clamps",
					spacing: { key: "clamp-spacing", value: "300 mm" },
				},
			},
			{
				number: 35,
				doc: "fiche flexible",
				title: "pressions",
				text: [
					"Valeurs données à ",
					{ key: "rated-temp", value: "20 °C" },
					".",
				],
				figure: {
					kind: "table",
					head: ["pression", "valeur"],
					rows: [
						{ label: "service", key: "p-service", value: "180 bar" },
						{ label: "épreuve", key: "p-test", value: "270 bar" },
						{ label: "éclatement", key: "p-burst", value: "720 bar" },
					],
				},
			},
		],
		claims: [
			{
				truth: {
					text: "Rayon de courbure minimal : 150 mm",
					page: 33,
					key: "bend-radius",
					value: "150 mm",
				},
				fake: {
					text: "Rayon de courbure minimal : 100 mm",
					page: 33,
					key: "bend-radius",
					value: "100 mm",
				},
			},
			{
				truth: {
					text: "Un collier tous les 300 mm",
					page: 34,
					key: "clamp-spacing",
					value: "300 mm",
				},
				fake: {
					text: "Un collier tous les 300 mm",
					page: 43,
					key: "clamp-spacing",
					value: "300 mm",
				},
			},
			{
				truth: {
					text: "Pression de service : 180 bar",
					page: 35,
					key: "p-service",
					value: "180 bar",
				},
				fake: {
					text: "Pression de service : 270 bar",
					page: 35,
					key: "p-service",
					value: "270 bar",
				},
			},
		],
	},
	{
		id: "gearbox",
		question: "Vidange du réducteur : quelle huile, combien, et quand ?",
		pages: [
			{
				number: 52,
				doc: "fiche d'entretien",
				title: "réducteur",
				text: [
					"Capacité : ",
					{ key: "oil-volume", value: "1,8 L" },
					", niveau au voyant.",
				],
				figure: {
					kind: "level",
					level: { key: "oil-level", value: "mi-voyant" },
				},
			},
			{
				number: 53,
				doc: "fiche lubrifiants",
				title: "huiles et graisses",
				text: ["Ne jamais mélanger deux grades."],
				figure: {
					kind: "table",
					head: ["organe", "lubrifiant"],
					rows: [
						{ label: "réducteur", key: "oil-gearbox", value: "75W-90" },
						{ label: "pont", key: "oil-axle", value: "80W-140" },
						{ label: "moyeux", key: "grease-hub", value: "graisse EP2" },
					],
				},
			},
			{
				number: 54,
				doc: "plan d'entretien",
				title: "périodicité",
				text: [
					"Première vidange à ",
					{ key: "first-drain", value: "5 000 km" },
					".",
				],
				figure: {
					kind: "interval",
					every: { key: "drain-interval", value: "60 000 km" },
				},
			},
		],
		claims: [
			{
				truth: {
					text: "Huile de grade 75W-90",
					page: 53,
					key: "oil-gearbox",
					value: "75W-90",
				},
				fake: {
					text: "Huile de grade 80W-140",
					page: 53,
					key: "oil-gearbox",
					value: "80W-140",
				},
			},
			{
				truth: {
					text: "Capacité : 1,8 L",
					page: 52,
					key: "oil-volume",
					value: "1,8 L",
				},
				fake: {
					text: "Capacité : 2,5 L",
					page: 52,
					key: "oil-volume",
					value: "2,5 L",
				},
			},
			{
				truth: {
					text: "Une vidange tous les 60 000 km",
					page: 54,
					key: "drain-interval",
					value: "60 000 km",
				},
				fake: {
					text: "Rincez le réducteur à chaque vidange",
					page: 54,
					key: "flush",
					value: "rincez",
				},
			},
		],
	},
];
