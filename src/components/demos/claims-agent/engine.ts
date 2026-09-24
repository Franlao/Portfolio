import { z } from "zod";
import type { Lang } from "../../../i18n/ui";
import { copy, formatEuro } from "./copy";

export const pieceIds = [
	"declaration",
	"photos",
	"quote",
	"statement",
] as const;
export type PieceId = (typeof pieceIds)[number];

export const circumstanceIds = ["reversing", "storm", "disputed"] as const;
export type Circumstance = (typeof circumstanceIds)[number];

export type NodeId =
	| "reception"
	| "classification"
	| "coverage"
	| "circumstances"
	| "consistency"
	| "missing"
	| "escalation"
	| "offer"
	| "register";

export type NodeKind = "code" | "model";

export type CheckId =
	| "source"
	| "classified"
	| "required"
	| "delay"
	| "ceiling"
	| "liability"
	| "exclusion";

export type Outcome = "offer" | "missing" | "escalation";

export interface ClaimFile {
	pieces: PieceId[];
	delayDays: number;
	quoteAmount: number;
	circumstance: Circumstance;
}

export const CONTRACT = {
	delayLimitDays: 5,
	ceiling: 15000,
	deductible: 300,
} as const;

export const defaultFile: ClaimFile = {
	pieces: ["declaration", "photos", "quote"],
	delayDays: 3,
	quoteAmount: 4200,
	circumstance: "reversing",
};

export const nodeKinds: Record<NodeId, NodeKind> = {
	reception: "code",
	classification: "model",
	coverage: "code",
	circumstances: "model",
	consistency: "code",
	missing: "code",
	escalation: "code",
	offer: "model",
	register: "code",
};

const fileNames: Record<PieceId, string> = {
	declaration: "declaration_sinistre.pdf",
	photos: "photos_portail.jpg",
	quote: "devis_menuiserie.pdf",
	statement: "attestation_voisin.pdf",
};

/** Confidence the (precomputed) classifier gives to each document. */
const confidence: Record<PieceId, number> = {
	declaration: 0.99,
	photos: 0.97,
	quote: 0.95,
	statement: 0.93,
};

const piece = z.enum(pieceIds);
const check = z.enum([
	"source",
	"classified",
	"required",
	"delay",
	"ceiling",
	"liability",
	"exclusion",
]);

export const schemas = {
	reception: z.object({
		open: z.boolean(),
		received: z.array(piece),
		missing: z.array(piece),
	}),
	classification: z.array(
		z.object({
			file: z.string(),
			type: piece,
			confidence: z.number().min(0).max(1),
		}),
	),
	coverage: z.object({
		withinDelay: z.boolean(),
		quoteAmount: z.number().nullable(),
		exceedsCeiling: z.boolean(),
		payableBase: z.number().nullable(),
	}),
	circumstances: z.object({
		liability: z.enum(["insured", "shared", "undetermined"]),
		exclusion: z.enum(["weather"]).nullable(),
		reasoning: z.string().min(1),
		quote: z.string().min(1),
		source: piece,
	}),
	consistency: z.object({
		checks: z.array(z.object({ id: check, passed: z.boolean() })),
		route: z.enum(["offer", "missing", "escalation"]),
	}),
	missing: z.object({ request: z.array(piece).min(1), message: z.string() }),
	escalation: z.object({
		failedChecks: z.array(check).min(1),
		message: z.string(),
	}),
	offer: z.object({
		amount: z.number().nonnegative(),
		liabilityShare: z.union([z.literal(1), z.literal(0.5)]),
		letter: z.string().min(1),
	}),
	register: z.object({
		entries: z.array(
			z.object({
				number: z.number().int().positive(),
				piece,
				file: z.string(),
			}),
		),
	}),
} satisfies Record<NodeId, z.ZodType>;

export const schemaNames: Record<NodeId, string> = {
	reception: "Intake",
	classification: "ClassifiedDocument[]",
	coverage: "PolicyCheck",
	circumstances: "CircumstanceAnalysis",
	consistency: "ConsistencyReport",
	missing: "DocumentRequest",
	escalation: "Handover",
	offer: "SettlementOffer",
	register: "DocumentRegister",
};

export interface Trace {
	node: NodeId;
	kind: NodeKind;
	input: unknown;
	output: unknown;
	valid: boolean;
}

export interface Run {
	path: NodeId[];
	traces: Trace[];
	outcome: Outcome;
}

function requiredPieces(circumstance: Circumstance): PieceId[] {
	const base: PieceId[] = ["declaration", "photos", "quote"];
	return circumstance === "disputed" ? [...base, "statement"] : base;
}

export function run(file: ClaimFile, lang: Lang): Run {
	const t = copy[lang];
	const traces: Trace[] = [];
	const received = pieceIds.filter((p) => file.pieces.includes(p));
	const has = (p: PieceId) => received.includes(p);

	const record = (node: NodeId, input: unknown, output: unknown) => {
		traces.push({
			node,
			kind: nodeKinds[node],
			input,
			output,
			valid: schemas[node].safeParse(output).success,
		});
	};

	const register = () =>
		record(
			"register",
			{ received },
			{
				entries: received.map((p, i) => ({
					number: i + 1,
					piece: p,
					file: fileNames[p],
				})),
			},
		);

	const requestMissing = (missing: PieceId[]) =>
		record(
			"missing",
			{ required: requiredPieces(file.circumstance), received },
			{
				request: missing,
				message: t.missingLetter(
					missing.map((p) => t.pieces[p].toLowerCase()).join(", "),
				),
			},
		);

	// 1. Intake (code): a claim form is needed to open the file.
	const opened = has("declaration");
	record(
		"reception",
		{ pieces: received },
		{ open: opened, received, missing: opened ? [] : ["declaration"] },
	);
	if (!opened) {
		requestMissing(["declaration"]);
		register();
		return { path: traces.map((tr) => tr.node), traces, outcome: "missing" };
	}

	// 2. Classification (model, precomputed).
	const classification = received.map((p) => ({
		file: fileNames[p],
		type: p,
		confidence: confidence[p],
	}));
	record(
		"classification",
		{ files: received.map((p) => fileNames[p]) },
		classification,
	);

	// 3. Policy check (code).
	const quoteAmount = has("quote") ? file.quoteAmount : null;
	const coverage = {
		withinDelay: file.delayDays <= CONTRACT.delayLimitDays,
		quoteAmount,
		exceedsCeiling: quoteAmount !== null && quoteAmount > CONTRACT.ceiling,
		payableBase:
			quoteAmount === null ? null : Math.min(quoteAmount, CONTRACT.ceiling),
	};
	record(
		"coverage",
		{ delayDays: file.delayDays, quoteAmount, contract: CONTRACT },
		coverage,
	);

	// 4. Circumstance analysis (model, precomputed).
	const variant =
		file.circumstance === "disputed" && has("statement")
			? "disputedWithStatement"
			: file.circumstance;
	const circumstances = {
		liability:
			file.circumstance === "reversing"
				? "insured"
				: variant === "disputedWithStatement"
					? "shared"
					: "undetermined",
		exclusion: file.circumstance === "storm" ? "weather" : null,
		reasoning: t.reasoning[variant],
		quote: t.quotes[variant],
		source: variant === "disputedWithStatement" ? "statement" : "declaration",
	} as const;
	record(
		"circumstances",
		{
			documents: received.filter(
				(p) => p === "declaration" || p === "statement",
			),
		},
		circumstances,
	);

	// 5. Consistency check (code): verifies the model's output and routes the file.
	const missing = requiredPieces(file.circumstance).filter((p) => !has(p));
	const checks: { id: CheckId; passed: boolean }[] = [
		{ id: "source", passed: has(circumstances.source) },
		{ id: "classified", passed: classification.length === received.length },
		{ id: "required", passed: missing.length === 0 },
		{ id: "delay", passed: coverage.withinDelay },
		{ id: "ceiling", passed: !coverage.exceedsCeiling },
		{ id: "liability", passed: circumstances.liability !== "undetermined" },
		{ id: "exclusion", passed: circumstances.exclusion === null },
	];
	const failed = checks.filter((c) => !c.passed).map((c) => c.id);
	const route: Outcome =
		missing.length > 0 ? "missing" : failed.length > 0 ? "escalation" : "offer";
	record(
		"consistency",
		{
			coverage,
			liability: circumstances.liability,
			exclusion: circumstances.exclusion,
		},
		{ checks, route },
	);

	// 6. Outcome.
	if (route === "missing") {
		requestMissing(missing);
	} else if (route === "escalation") {
		record(
			"escalation",
			{ failedChecks: failed },
			{ failedChecks: failed, message: t.escalation },
		);
	} else {
		const share = circumstances.liability === "shared" ? 0.5 : 1;
		const base = coverage.payableBase ?? 0;
		const amount = Math.max(0, Math.round(base * share) - CONTRACT.deductible);
		record(
			"offer",
			{
				payableBase: base,
				liabilityShare: share,
				deductible: CONTRACT.deductible,
			},
			{
				amount,
				liabilityShare: share,
				letter: t.letter(
					formatEuro(lang, amount),
					formatEuro(lang, base),
					share < 1,
				),
			},
		);
	}

	register();
	return { path: traces.map((tr) => tr.node), traces, outcome: route };
}
