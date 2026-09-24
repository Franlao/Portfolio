import { copy } from "../../components/demos/claims-agent/copy";
import {
	type ClaimFile,
	type Outcome,
	type PieceId,
	run,
} from "../../components/demos/claims-agent/engine";

/**
 * « Coup de feu au passe » : claims arrive one after another, the player decides,
 * then the chef (the real claims engine) gives its verdict and the reason.
 */

export interface RushCase {
	id: string;
	story: string;
	file: ClaimFile;
	/** What the rules expect. The tests check the engine agrees. */
	expected: Outcome;
}

const all: PieceId[] = ["declaration", "photos", "quote"];

export const rushCases: RushCase[] = [
	{
		id: "clean",
		story: "Le camion a reculé dans le portail du voisin. Tout est là.",
		file: {
			pieces: all,
			delayDays: 3,
			quoteAmount: 4200,
			circumstance: "reversing",
		},
		expected: "offer",
	},
	{
		id: "no-quote",
		story: "Marche arrière, portail plié. L'assuré a envoyé ses photos.",
		file: {
			pieces: ["declaration", "photos"],
			delayDays: 2,
			quoteAmount: 3100,
			circumstance: "reversing",
		},
		expected: "missing",
	},
	{
		id: "late",
		story:
			"Un rétroviseur contre un portail, déclaré après le week-end prolongé.",
		file: {
			pieces: all,
			delayDays: 9,
			quoteAmount: 2800,
			circumstance: "reversing",
		},
		expected: "escalation",
	},
	{
		id: "storm",
		story: "Une branche est tombée sur le portail pendant l'orage de la nuit.",
		file: {
			pieces: all,
			delayDays: 1,
			quoteAmount: 6500,
			circumstance: "storm",
		},
		expected: "escalation",
	},
	{
		id: "disputed",
		story: "Le chauffeur jure que le portail était déjà abîmé.",
		file: {
			pieces: all,
			delayDays: 4,
			quoteAmount: 3900,
			circumstance: "disputed",
		},
		expected: "missing",
	},
	{
		id: "ceiling",
		story:
			"Le portail en fer forgé d'une maison de maître, entièrement à refaire.",
		file: {
			pieces: all,
			delayDays: 2,
			quoteAmount: 19000,
			circumstance: "reversing",
		},
		expected: "escalation",
	},
	{
		id: "shared",
		story: "Versions contradictoires, mais le voisin a signé son attestation.",
		file: {
			pieces: [...all, "statement"],
			delayDays: 3,
			quoteAmount: 5000,
			circumstance: "disputed",
		},
		expected: "offer",
	},
];

export const ROUNDS = 6;

export interface Verdict {
	outcome: Outcome;
	/** Human-readable reasons, in French. */
	reasons: string[];
	/** Time the engine took, measured for real. */
	ms: number;
}

/** Runs the real claims engine on a case and explains its decision. */
export function judge(file: ClaimFile): Verdict {
	const start = performance.now();
	const result = run(file, "fr");
	const ms = performance.now() - start;
	const t = copy.fr;
	const missing = result.traces.find((trace) => trace.node === "missing")
		?.output as { request: PieceId[] } | undefined;
	const consistency = result.traces.find(
		(trace) => trace.node === "consistency",
	)?.output as
		| { checks: { id: keyof typeof t.checks; passed: boolean }[] }
		| undefined;
	const reasons =
		result.outcome === "missing" && missing
			? missing.request.map(
					(piece) => `Pièce manquante : ${t.pieces[piece].toLowerCase()}`,
				)
			: result.outcome === "escalation" && consistency
				? consistency.checks
						.filter((c) => !c.passed)
						.map((c) => failedCheck[c.id])
				: ["Dossier complet, dans les délais et sous le plafond"];
	return { outcome: result.outcome, reasons, ms };
}

const failedCheck: Record<string, string> = {
	source: "La citation du modèle ne vient d'aucune pièce reçue",
	classified: "Une pièce n'a pas été classée",
	required: "Une pièce obligatoire manque",
	delay: "Déclaration hors délai",
	ceiling: "Montant au-dessus du plafond",
	liability: "Responsabilité non établie",
	exclusion: "Exclusion possible : événement climatique",
};

export const outcomeLabel: Record<Outcome, string> = {
	offer: "Proposer l'indemnisation",
	missing: "Réclamer une pièce",
	escalation: "Transmettre au gestionnaire",
};

/** Picks the rounds of a game: every outcome appears, the order changes each time. */
export function deal(random: () => number = Math.random): RushCase[] {
	const shuffled = [...rushCases].sort(() => random() - 0.5);
	return shuffled.slice(0, ROUNDS);
}

export interface Round {
	rushCase: RushCase;
	choice: Outcome | null;
	verdict: Verdict;
	seconds: number;
}

export function score(rounds: Round[]) {
	const right = rounds.filter((r) => r.choice === r.verdict.outcome).length;
	const playerSeconds = rounds.reduce((sum, r) => sum + r.seconds, 0);
	const chefMs = rounds.reduce((sum, r) => sum + r.verdict.ms, 0);
	return { right, total: rounds.length, playerSeconds, chefMs };
}
