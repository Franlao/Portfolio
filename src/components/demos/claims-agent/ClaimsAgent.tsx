import {
	type Edge,
	Handle,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { type SubmitEvent, useEffect, useState } from "react";
import type { Lang } from "../../../i18n/ui";
import {
	CheckMark,
	CrossMark,
	FreehandFrame,
	FreehandSample,
	RuledSample,
} from "../../sketch/Sketch";
import { copy, formatEuro } from "./copy";
import {
	type CheckId,
	type Circumstance,
	type ClaimFile,
	circumstanceIds,
	defaultFile,
	type NodeId,
	type NodeKind,
	nodeKinds,
	type PieceId,
	pieceIds,
	type Run,
	run,
	schemaNames,
	type Trace,
} from "./engine";
import "./claims-agent.css";

type Status = "idle" | "active" | "done" | "skipped";

interface StepData extends Record<string, unknown> {
	title: string;
	kind: NodeKind;
	kindLabel: string;
	status: Status;
	selected: boolean;
	seed: number;
	sideExit: boolean;
}

type StepNodeType = Node<StepData, "step">;

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const STEP_DELAY_MS = 420;

const positions: Record<NodeId, { x: number; y: number }> = {
	reception: { x: 230, y: 0 },
	classification: { x: 230, y: 100 },
	coverage: { x: 230, y: 200 },
	circumstances: { x: 230, y: 300 },
	consistency: { x: 230, y: 400 },
	missing: { x: 0, y: 530 },
	escalation: { x: 230, y: 530 },
	offer: { x: 460, y: 530 },
	register: { x: 230, y: 650 },
};

const links: { source: NodeId; target: NodeId; side?: boolean }[] = [
	{ source: "reception", target: "classification" },
	{ source: "classification", target: "coverage" },
	{ source: "coverage", target: "circumstances" },
	{ source: "circumstances", target: "consistency" },
	{ source: "consistency", target: "missing" },
	{ source: "consistency", target: "escalation" },
	{ source: "consistency", target: "offer" },
	{ source: "reception", target: "missing", side: true },
	{ source: "missing", target: "register" },
	{ source: "escalation", target: "register" },
	{ source: "offer", target: "register" },
];

function StepNode({ data }: NodeProps<StepNodeType>) {
	return (
		<div
			className={`claim-node is-${data.kind}`}
			data-status={data.status}
			data-selected={data.selected || undefined}
		>
			<Handle type="target" position={Position.Top} isConnectable={false} />
			{data.sideExit && (
				<Handle
					id="side"
					type="source"
					position={Position.Left}
					isConnectable={false}
				/>
			)}
			{data.kind === "model" && (
				<FreehandFrame
					width={NODE_WIDTH}
					height={NODE_HEIGHT}
					seed={data.seed}
				/>
			)}
			<span
				className={`claim-node-title${data.kind === "model" ? " casual" : ""}`}
			>
				{data.title}
			</span>
			<span className="claim-node-kind">{data.kindLabel}</span>
			<Handle
				id="bottom"
				type="source"
				position={Position.Bottom}
				isConnectable={false}
			/>
		</div>
	);
}

const nodeTypes = { step: StepNode };

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);
	useEffect(() => {
		const media = window.matchMedia(query);
		const update = () => setMatches(media.matches);
		update();
		media.addEventListener("change", update);
		return () => media.removeEventListener("change", update);
	}, [query]);
	return matches;
}

const sameFile = (a: ClaimFile, b: ClaimFile) =>
	a.delayDays === b.delayDays &&
	a.quoteAmount === b.quoteAmount &&
	a.circumstance === b.circumstance &&
	a.pieces.length === b.pieces.length &&
	a.pieces.every((p) => b.pieces.includes(p));

export default function ClaimsAgent({ lang }: { lang: Lang }) {
	const t = copy[lang];
	const [file, setFile] = useState<ClaimFile>(defaultFile);
	const [result, setResult] = useState<Run | null>(null);
	const [runFile, setRunFile] = useState<ClaimFile | null>(null);
	const [revealed, setRevealed] = useState(0);
	const [runId, setRunId] = useState(0);
	const [selected, setSelected] = useState<NodeId | null>(null);
	const wide = useMediaQuery("(min-width: 760px)");

	useEffect(() => {
		if (!result) return;
		if (prefersReducedMotion()) {
			setRevealed(result.traces.length);
			return;
		}
		setRevealed(0);
		const timers = result.traces.map((_, i) =>
			window.setTimeout(() => setRevealed(i + 1), (i + 1) * STEP_DELAY_MS),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [result]);

	const running = result !== null && revealed < result.traces.length;
	const finished = result !== null && !running;
	const changed =
		result !== null && runFile !== null && !sameFile(file, runFile);
	const shownPath = result ? result.path.slice(0, revealed) : [];

	const start = (event: SubmitEvent) => {
		event.preventDefault();
		setResult(run(file, lang));
		setRunFile(file);
		setSelected(null);
		setRunId((id) => id + 1);
	};

	const statusOf = (id: NodeId): Status => {
		if (!result) return "idle";
		const index = shownPath.indexOf(id);
		if (index === -1) return finished ? "skipped" : "idle";
		return running && index === shownPath.length - 1 ? "active" : "done";
	};

	const nodes: StepNodeType[] = (Object.keys(positions) as NodeId[]).map(
		(id, i) => {
			const sideExit = links.some((l) => l.side && l.source === id);
			return {
				id,
				type: "step",
				position: positions[id],
				width: NODE_WIDTH,
				height: NODE_HEIGHT,
				// Declared up front so edges render without waiting for DOM measurement.
				handles: [
					{
						type: "target",
						position: Position.Top,
						x: NODE_WIDTH / 2,
						y: 0,
						width: 1,
						height: 1,
					},
					{
						id: "bottom",
						type: "source",
						position: Position.Bottom,
						x: NODE_WIDTH / 2,
						y: NODE_HEIGHT,
						width: 1,
						height: 1,
					},
					...(sideExit
						? [
								{
									id: "side",
									type: "source" as const,
									position: Position.Left,
									x: 0,
									y: NODE_HEIGHT / 2,
									width: 1,
									height: 1,
								},
							]
						: []),
				],
				data: {
					title: t.nodes[id],
					kind: nodeKinds[id],
					kindLabel: t.kinds[nodeKinds[id]],
					status: statusOf(id),
					selected: selected === id,
					seed: 40 + i,
					sideExit,
				},
			};
		},
	);

	const edges: Edge[] = links.map(({ source, target, side }) => {
		const from = shownPath.indexOf(source);
		const walked = from !== -1 && shownPath[from + 1] === target;
		return {
			id: `${source}-${target}`,
			source,
			target,
			sourceHandle: side ? "side" : "bottom",
			type: "smoothstep",
			className: walked ? "is-done" : finished ? "is-skipped" : "is-idle",
		};
	});

	const select = (id: NodeId) => {
		setSelected(id);
		document.getElementById(`journal-${id}`)?.scrollIntoView({
			behavior: prefersReducedMotion() ? "auto" : "smooth",
			block: "nearest",
		});
	};

	const status = !result
		? t.ui.idle
		: running
			? t.ui.running
			: changed
				? t.ui.changed
				: t.ui.outcome[result.outcome];

	const togglePiece = (piece: PieceId, checked: boolean) =>
		setFile((f) => ({
			...f,
			pieces: checked
				? [...f.pieces, piece]
				: f.pieces.filter((p) => p !== piece),
		}));

	return (
		<div className="demo claims">
			<div className="claims-top">
				<form className="claim-file" onSubmit={start}>
					<h3 className="claim-file-title">{t.ui.file}</h3>
					<p className="claim-file-intro">{t.ui.fileIntro}</p>

					<fieldset className="claim-group">
						<legend>{t.ui.received}</legend>
						{pieceIds.map((piece) => (
							<label key={piece} className="claim-choice">
								<input
									type="checkbox"
									checked={file.pieces.includes(piece)}
									onChange={(e) => togglePiece(piece, e.target.checked)}
								/>
								<span>{t.pieces[piece]}</span>
							</label>
						))}
					</fieldset>

					<div className="claim-group">
						<label className="claim-range-label" htmlFor="claim-delay">
							<span>{t.ui.delay}</span>
							<output htmlFor="claim-delay">
								{t.ui.delayUnit(file.delayDays)}
							</output>
						</label>
						<input
							id="claim-delay"
							type="range"
							min={1}
							max={15}
							step={1}
							value={file.delayDays}
							aria-describedby="claim-delay-hint"
							onChange={(e) =>
								setFile((f) => ({ ...f, delayDays: Number(e.target.value) }))
							}
						/>
						<p className="claim-hint" id="claim-delay-hint">
							{t.ui.delayHint}
						</p>
					</div>

					<div className="claim-group">
						<label className="claim-range-label" htmlFor="claim-quote">
							<span>{t.ui.quoteAmount}</span>
							<output htmlFor="claim-quote">
								{formatEuro(lang, file.quoteAmount)}
							</output>
						</label>
						<input
							id="claim-quote"
							type="range"
							min={500}
							max={25000}
							step={100}
							value={file.quoteAmount}
							aria-describedby="claim-quote-hint"
							onChange={(e) =>
								setFile((f) => ({ ...f, quoteAmount: Number(e.target.value) }))
							}
						/>
						<p className="claim-hint" id="claim-quote-hint">
							{t.ui.quoteHint}
						</p>
					</div>

					<fieldset className="claim-group">
						<legend>{t.ui.circumstance}</legend>
						{circumstanceIds.map((c: Circumstance) => (
							<label key={c} className="claim-choice">
								<input
									type="radio"
									name="claim-circumstance"
									checked={file.circumstance === c}
									onChange={() => setFile((f) => ({ ...f, circumstance: c }))}
								/>
								<span>{t.circumstances[c]}</span>
							</label>
						))}
					</fieldset>

					<button type="submit" className="button" disabled={running}>
						{running ? t.ui.running : result ? t.ui.rerun : t.ui.run}
					</button>
					<p
						className="claim-status"
						aria-live="polite"
						data-changed={changed || undefined}
					>
						{status}
					</p>
				</form>

				{wide && (
					<figure className="claims-graph" aria-label={t.ui.graphLabel}>
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={nodeTypes}
							fitView
							fitViewOptions={{ padding: 0.06 }}
							nodesDraggable={false}
							nodesConnectable={false}
							elementsSelectable={false}
							zoomOnScroll={false}
							zoomOnPinch={false}
							zoomOnDoubleClick={false}
							panOnDrag={false}
							panOnScroll={false}
							preventScrolling={false}
							nodesFocusable={false}
							edgesFocusable={false}
							onNodeClick={(_, node) => select(node.id as NodeId)}
						/>
					</figure>
				)}
			</div>

			<section className="journal" aria-labelledby="journal-title">
				<h3 id="journal-title">{t.ui.journal}</h3>
				{!result ? (
					<p className="journal-empty">{t.ui.journalEmpty}</p>
				) : (
					<ol className="journal-list">
						{result.traces.slice(0, revealed).map((trace, i) => (
							<JournalEntry
								key={`${runId}-${trace.node}`}
								trace={trace}
								index={i}
								lang={lang}
								selected={selected === trace.node}
							/>
						))}
					</ol>
				)}
			</section>
		</div>
	);
}

function JournalEntry({
	trace,
	index,
	lang,
	selected,
}: {
	trace: Trace;
	index: number;
	lang: Lang;
	selected: boolean;
}) {
	const t = copy[lang];
	const [open, setOpen] = useState(false);
	useEffect(() => {
		if (selected) setOpen(true);
	}, [selected]);

	const rule = t.rules[trace.node];
	const quote = (text: string) => (lang === "fr" ? `« ${text} »` : `“${text}”`);

	const body = (() => {
		const out = trace.output as Record<string, unknown>;
		switch (trace.node) {
			case "reception":
				return (
					<p>
						{t.summaries.reception(
							out.open as boolean,
							(out.received as unknown[]).length,
						)}
					</p>
				);
			case "classification": {
				const docs = trace.output as { confidence: number }[];
				const min = Math.min(...docs.map((d) => d.confidence));
				return (
					<p className="casual journal-model">
						{t.summaries.classification(
							docs.length,
							min.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB"),
						)}
					</p>
				);
			}
			case "coverage":
				return (
					<p>
						{t.summaries.coverage(
							out.withinDelay as boolean,
							out.quoteAmount === null
								? null
								: formatEuro(lang, out.quoteAmount as number),
							out.exceedsCeiling as boolean,
						)}
					</p>
				);
			case "circumstances":
				return (
					<>
						<p className="casual journal-model">{out.reasoning as string}</p>
						<p className="journal-quote">
							{quote(out.quote as string)}{" "}
							<span>
								{t.summaries.source(
									t.pieces[out.source as PieceId].toLowerCase(),
								)}
							</span>
						</p>
					</>
				);
			case "consistency": {
				const checks = out.checks as { id: CheckId; passed: boolean }[];
				return (
					<>
						<p>
							{t.summaries.consistency(
								checks.filter((c) => c.passed).length,
								checks.length,
							)}
						</p>
						<ul className="journal-checks">
							{checks.map((c, i) => (
								<li key={c.id} data-passed={c.passed}>
									{c.passed ? (
										<CheckMark seed={60 + i} />
									) : (
										<CrossMark seed={60 + i} />
									)}
									<span>{t.checks[c.id]}</span>
								</li>
							))}
						</ul>
					</>
				);
			}
			case "missing":
				return <p>{out.message as string}</p>;
			case "escalation":
				return (
					<>
						<p>{out.message as string}</p>
						<ul className="journal-checks">
							{(out.failedChecks as CheckId[]).map((id, i) => (
								<li key={id} data-passed={false}>
									<CrossMark seed={80 + i} />
									<span>{t.checks[id]}</span>
								</li>
							))}
						</ul>
					</>
				);
			case "offer":
				return (
					<>
						<p className="journal-amount">
							{t.summaries.offer(formatEuro(lang, out.amount as number))}
						</p>
						<p className="casual journal-model">{out.letter as string}</p>
					</>
				);
			case "register":
				return <p>{t.summaries.register((out.entries as unknown[]).length)}</p>;
		}
	})();

	return (
		<li
			className="journal-entry"
			id={`journal-${trace.node}`}
			data-kind={trace.kind}
			data-selected={selected || undefined}
		>
			<span className="journal-no" aria-hidden="true">
				{index + 1}
			</span>
			<div className="journal-main">
				<div className="journal-head">
					<h4>{t.nodes[trace.node]}</h4>
					<span className="journal-kind">
						{trace.kind === "model" ? (
							<FreehandSample seed={index + 90} />
						) : (
							<RuledSample />
						)}
						{t.kinds[trace.kind]}
					</span>
				</div>
				<div className="journal-body">{body}</div>
				<p className="journal-valid">
					{trace.valid ? (
						<CheckMark seed={index + 30} />
					) : (
						<CrossMark seed={index + 30} />
					)}
					<span>
						{trace.valid
							? t.ui.validated(schemaNames[trace.node])
							: t.ui.invalid(schemaNames[trace.node])}
					</span>
				</p>
				{trace.kind === "model" && (
					<p className="journal-note">
						{trace.node === "offer" ? t.offerNote : t.modelNote}
					</p>
				)}
				<details
					className="io"
					open={open}
					onToggle={(e) => setOpen(e.currentTarget.open)}
				>
					<summary>
						{t.ui.input} / {t.ui.output}
						{rule ? ` / ${t.ui.rule}` : ""}
					</summary>
					{rule && (
						<p className="journal-rule">
							<strong>
								{t.ui.rule}
								{lang === "fr" ? " :" : ":"}
							</strong>{" "}
							{rule}
						</p>
					)}
					<div className="io-grid">
						<div>
							<h5>{t.ui.input}</h5>
							<pre>{JSON.stringify(trace.input, null, 2)}</pre>
						</div>
						<div>
							<h5>{t.ui.output}</h5>
							<pre>{JSON.stringify(trace.output, null, 2)}</pre>
						</div>
					</div>
				</details>
			</div>
		</li>
	);
}
