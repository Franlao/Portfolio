import {
	copy as claims,
	formatEuro,
} from "../../../components/demos/claims-agent/copy";
import {
	type CheckId,
	type ClaimFile,
	type NodeId,
	type NodeKind,
	type Outcome,
	type PieceId,
	run,
	schemaNames,
} from "../../../components/demos/claims-agent/engine";
import type { Lang } from "../../../i18n/ui";

/**
 * The agent's recipe for one claim: the real engine's run, step by step, in the words
 * of the chef's notebook. What code decided, what a model wrote, what was checked.
 */

export interface RecipeCheck {
	id: CheckId;
	label: string;
	passed: boolean;
}

export interface RecipeStep {
	node: NodeId;
	kind: NodeKind;
	title: string;
	/** The rule a code step applies. */
	rule: string | null;
	/** What the step decided, in one sentence written by code. */
	result: string | null;
	/** What a model wrote: the documents' types, its reasoning, the letter. */
	written: string[];
	/** The passage the model quotes, and the document it comes from. */
	quote: { text: string; source: string } | null;
	checks: RecipeCheck[];
	/** The rest of the output: documents requested, failed checks, the register. */
	list: string[];
	/** The schema the output was validated against. */
	schema: string;
	valid: boolean;
}

export interface Recipe {
	steps: RecipeStep[];
	outcome: Outcome;
	/** Checks that failed: they decided the route, the notebook marks them in red. */
	failed: CheckId[];
}

/** The three ways out of the consistency check. */
export const ROUTES: Outcome[] = ["offer", "missing", "escalation"];

export function recipe(file: ClaimFile, lang: Lang): Recipe {
	const t = claims[lang];
	const result = run(file, lang);
	const percent = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const failed: CheckId[] = [];

	const steps = result.traces.map((trace): RecipeStep => {
		const step: RecipeStep = {
			node: trace.node,
			kind: trace.kind,
			title: t.nodes[trace.node],
			rule: t.rules[trace.node] ?? null,
			result: null,
			written: [],
			quote: null,
			checks: [],
			list: [],
			schema: schemaNames[trace.node],
			valid: trace.valid,
		};
		switch (trace.node) {
			case "reception": {
				const out = trace.output as { open: boolean; received: PieceId[] };
				step.result = t.summaries.reception(out.open, out.received.length);
				break;
			}
			case "classification": {
				const out = trace.output as {
					file: string;
					type: PieceId;
					confidence: number;
				}[];
				step.written = out.map(
					(o) =>
						`${o.file} → ${t.pieces[o.type]} (${percent.format(o.confidence)})`,
				);
				break;
			}
			case "coverage": {
				const out = trace.output as {
					withinDelay: boolean;
					quoteAmount: number | null;
					exceedsCeiling: boolean;
				};
				step.result = t.summaries.coverage(
					out.withinDelay,
					out.quoteAmount === null ? null : formatEuro(lang, out.quoteAmount),
					out.exceedsCeiling,
				);
				break;
			}
			case "circumstances": {
				const out = trace.output as {
					reasoning: string;
					quote: string;
					source: PieceId;
				};
				step.written = [out.reasoning];
				step.quote = {
					text: out.quote,
					source: t.summaries.source(t.pieces[out.source]),
				};
				break;
			}
			case "consistency": {
				const out = trace.output as {
					checks: { id: CheckId; passed: boolean }[];
				};
				step.checks = out.checks.map((c) => ({
					id: c.id,
					label: t.checks[c.id],
					passed: c.passed,
				}));
				failed.push(...out.checks.filter((c) => !c.passed).map((c) => c.id));
				step.result = t.summaries.consistency(
					out.checks.filter((c) => c.passed).length,
					out.checks.length,
				);
				break;
			}
			case "missing": {
				const out = trace.output as { request: PieceId[]; message: string };
				step.result = out.message;
				step.list = out.request.map((p) => t.pieces[p]);
				break;
			}
			case "escalation": {
				const out = trace.output as {
					failedChecks: CheckId[];
					message: string;
				};
				step.result = out.message;
				step.list = out.failedChecks.map((c) => t.checks[c]);
				break;
			}
			case "offer": {
				const out = trace.output as { amount: number; letter: string };
				// The amount is computed by code, the letter drafted by the model.
				step.result = t.summaries.offer(formatEuro(lang, out.amount));
				step.written = [out.letter];
				break;
			}
			case "register": {
				const out = trace.output as {
					entries: { number: number; file: string }[];
				};
				step.result = t.summaries.register(out.entries.length);
				step.list = out.entries.map((e) => `${e.number}. ${e.file}`);
				break;
			}
		}
		return step;
	});

	return { steps, outcome: result.outcome, failed };
}
