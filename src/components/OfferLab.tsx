import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import {
	type SubmitEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	getTranslations,
	type Lang,
	stepResults,
	summaryText,
} from "../i18n/ui";
import { competenceById } from "../lib/offer/competences";
import {
	type Analysis,
	analyze,
	type Evidence,
	type StepId,
} from "../lib/offer/engine";
import { presets } from "../lib/offer/presets";
import { $verifiedFor } from "../lib/offer/store";
import type { ProjectCard } from "../lib/projects";
import { CheckMark, CrossMark, Legend, ShareBar } from "./sketch/Sketch";
import "./offer-lab.css";

interface Props {
	lang: Lang;
	projects: ProjectCard[];
}

const STEPS: {
	id: StepId;
	title:
		| "step.segment.title"
		| "step.detect.title"
		| "step.match.title"
		| "step.summary.title";
	desc:
		| "step.segment.desc"
		| "step.detect.desc"
		| "step.match.desc"
		| "step.summary.desc";
}[] = [
	{ id: "segment", title: "step.segment.title", desc: "step.segment.desc" },
	{ id: "detect", title: "step.detect.title", desc: "step.detect.desc" },
	{ id: "match", title: "step.match.title", desc: "step.match.desc" },
	{ id: "summary", title: "step.summary.title", desc: "step.summary.desc" },
];

/** Index of the step after which the project register is re-ranked. */
const RANK_AFTER = 3;
const STEP_DELAY_MS = 550;
const PREVIEW_ITEMS = 6;

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shortens long arrays so the JSON stays readable. */
function preview(value: unknown, more: (count: number) => string): unknown {
	if (Array.isArray(value)) {
		const head = value.slice(0, PREVIEW_ITEMS).map((v) => preview(v, more));
		return value.length > PREVIEW_ITEMS
			? [...head, more(value.length - PREVIEW_ITEMS)]
			: head;
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([k, v]) => [k, preview(v, more)]),
		);
	}
	return value;
}

export default function OfferLab({ lang, projects }: Props) {
	const t = getTranslations(lang);
	const results = stepResults[lang];
	const [text, setText] = useState("");
	const [presetId, setPresetId] = useState<string | null>(null);
	const [analysis, setAnalysis] = useState<Analysis | null>(null);
	const [error, setError] = useState<"too-short" | "no-skill" | null>(null);
	const [revealed, setRevealed] = useState(0);
	const [runId, setRunId] = useState(0);
	const pipelineRef = useRef<HTMLElement>(null);
	const ledgerRef = useRef<HTMLOListElement>(null);
	const flipState = useRef<Flip.FlipState | null>(null);

	const titles = useMemo(
		() => new Map(projects.map((p) => [p.slug, p.title])),
		[projects],
	);
	const label = (id: string) => competenceById.get(id)?.label[lang] ?? id;
	const quoted = (value: string) =>
		lang === "fr" ? `« ${value} »` : `“${value}”`;
	const percent = (value: number) =>
		new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
			style: "percent",
			maximumFractionDigits: 0,
		}).format(value);

	useEffect(() => {
		gsap.registerPlugin(Flip);
	}, []);

	const captureLedger = useCallback(() => {
		const items = ledgerRef.current?.querySelectorAll("[data-flip-id]");
		if (items?.length && !prefersReducedMotion())
			flipState.current = Flip.getState(items);
	}, []);

	// Ink the steps one after another after each analysis.
	useEffect(() => {
		if (runId === 0) return;
		if (prefersReducedMotion()) {
			setRevealed(STEPS.length);
			return;
		}
		setRevealed(0);
		const timers = STEPS.map((_, i) =>
			window.setTimeout(
				() => {
					if (i + 1 === RANK_AFTER) captureLedger();
					setRevealed(i + 1);
				},
				(i + 1) * STEP_DELAY_MS,
			),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [runId, captureLedger]);

	const ranked = analysis !== null && revealed >= RANK_AFTER;
	const matches = useMemo(
		() =>
			new Map(
				ranked && analysis ? analysis.matches.map((m) => [m.project, m]) : [],
			),
		[ranked, analysis],
	);
	const ordered = useMemo(() => {
		if (!ranked || !analysis) return projects;
		const bySlug = new Map(projects.map((p) => [p.slug, p]));
		return analysis.matches.flatMap((m) => bySlug.get(m.project) ?? []);
	}, [ranked, analysis, projects]);
	const orderKey = ordered.map((p) => p.slug).join();

	// Animate the register from its previous order to the new one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: orderKey is the trigger, the state lives in a ref.
	useLayoutEffect(() => {
		if (!flipState.current) return;
		Flip.from(flipState.current, { duration: 0.7, ease: "power2.inOut" });
		flipState.current = null;
	}, [orderKey]);

	const quotesByCompetence = useMemo(() => {
		const map = new Map<string, Evidence[]>();
		for (const e of analysis?.evidence ?? []) {
			map.set(e.competence, [...(map.get(e.competence) ?? []), e]);
		}
		return map;
	}, [analysis]);

	const run = (value: string, fromPreset: string | null) => {
		const result = analyze(value, projects);
		if (!result.ok) {
			setError(result.reason);
			setAnalysis(null);
			setRevealed(0);
			$verifiedFor.set(null);
			return;
		}
		captureLedger();
		setError(null);
		setAnalysis(result);
		setRunId((id) => id + 1);
		const preset = presets.find((p) => p.id === fromPreset);
		$verifiedFor.set(
			preset
				? preset.label[lang]
				: `${t("verified.pasted")} (${result.words} ${t("verified.words")})`,
		);
		pipelineRef.current?.scrollIntoView({
			behavior: prefersReducedMotion() ? "auto" : "smooth",
			block: "start",
		});
	};

	const onSubmit = (event: SubmitEvent) => {
		event.preventDefault();
		run(text, presetId);
	};

	const stepResult = (id: StepId): string => {
		if (!analysis) return "";
		switch (id) {
			case "segment":
				return results.segment(analysis.segments.length, analysis.words);
			case "detect":
				return results.detect(analysis.demand.length, analysis.evidence.length);
			case "match": {
				const best = analysis.matches[0];
				return best && best.coverage > 0
					? results.match(
							titles.get(best.project) ?? best.project,
							Math.round(best.coverage * 100),
						)
					: results.noMatch;
			}
			case "summary": {
				const { lead, best, runnerUp, uncovered } = analysis.summary;
				const bestMatch = analysis.matches.find((m) => m.project === best);
				return summaryText[lang]({
					lead: lead.map(label),
					best: best ? (titles.get(best) ?? best) : null,
					pct: Math.round((bestMatch?.coverage ?? 0) * 100),
					runnerUp: runnerUp ? (titles.get(runnerUp) ?? runnerUp) : null,
					uncovered: uncovered.map(label),
				});
			}
		}
	};

	return (
		<>
			<form className="sheet-row lab" onSubmit={onSubmit} noValidate>
				<label className="sheet-main lab-label" htmlFor="offer-text">
					{t("lab.label")}
				</label>
				<div className="sheet-aside lab-presets">
					<p id="presets-label">{t("lab.presets")}</p>
					<ul aria-labelledby="presets-label">
						{presets.map((preset) => (
							<li key={preset.id}>
								<button
									type="button"
									className="lab-preset"
									aria-pressed={presetId === preset.id}
									onClick={() => {
										const value = preset.text[lang];
										setText(value);
										setPresetId(preset.id);
										run(value, preset.id);
									}}
								>
									{preset.label[lang]}
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="sheet-main lab-field">
					<textarea
						id="offer-text"
						className="lab-input"
						rows={6}
						value={text}
						placeholder={t("lab.placeholder")}
						aria-describedby="offer-privacy offer-error"
						onChange={(event) => {
							setText(event.target.value);
							setPresetId(null);
						}}
					/>
					<div className="lab-actions">
						<button type="submit" className="button">
							{t("lab.analyze")}
						</button>
						<p className="lab-privacy" id="offer-privacy">
							{t("lab.privacy")}
						</p>
					</div>
					<p className="lab-error" id="offer-error" role="alert">
						{error === "too-short"
							? t("lab.tooShort")
							: error === "no-skill"
								? t("lab.noSkill")
								: ""}
					</p>
				</div>
			</form>

			<section
				className="sheet-row pipeline"
				ref={pipelineRef}
				aria-labelledby="pipeline-title"
			>
				<h2 className="sheet-main pipeline-title" id="pipeline-title">
					{t("pipeline.title")}
				</h2>
				<Legend lang={lang} className="sheet-aside pipeline-legend" />
				<ol className="steps">
					{STEPS.map((step, index) => {
						const state = !analysis
							? "planned"
							: index < revealed
								? "done"
								: "pending";
						const record = analysis?.steps[index];
						return (
							<li key={step.id} className="step" data-state={state}>
								<span className="step-no" aria-hidden="true">
									{index + 1}
								</span>
								<div className="step-body">
									<div className="step-head">
										<h3 className="step-title">{t(step.title)}</h3>
										<span className="step-kind">{t("pipeline.kind")}</span>
									</div>
									<p className="step-desc">{t(step.desc)}</p>
									{state === "done" && record && (
										<div className="step-result" key={runId}>
											<p
												className={
													step.id === "summary" ? "step-summary" : "step-line"
												}
											>
												{stepResult(step.id)}
											</p>
											<p className="step-check">
												{record.valid ? (
													<CheckMark seed={index + 2} />
												) : (
													<CrossMark seed={index + 2} />
												)}
												<span>
													{record.valid
														? results.valid(record.schema)
														: results.invalid(record.schema)}
												</span>
											</p>
											<details className="io">
												<summary>{t("pipeline.inspect")}</summary>
												{step.id === "detect" && (
													<div className="io-quotes">
														<h4>{t("pipeline.quotes")}</h4>
														<ul>
															{analysis?.demand.map((d) => (
																<li key={d.competence}>
																	<strong>{label(d.competence)}</strong>{" "}
																	{(quotesByCompetence.get(d.competence) ?? [])
																		.slice(0, 4)
																		.map((e) => quoted(e.quote))
																		.join(" ")}
																</li>
															))}
														</ul>
													</div>
												)}
												<div className="io-grid">
													<div>
														<h4>{t("pipeline.input")}</h4>
														<pre>
															{JSON.stringify(
																preview(record.input, results.more),
																null,
																2,
															)}
														</pre>
													</div>
													<div>
														<h4>{t("pipeline.output")}</h4>
														<pre>
															{JSON.stringify(
																preview(record.output, results.more),
																null,
																2,
															)}
														</pre>
													</div>
												</div>
											</details>
										</div>
									)}
								</div>
							</li>
						);
					})}
				</ol>
			</section>

			<section
				className="sheet-row projects"
				id="projects"
				aria-labelledby="projects-title"
			>
				<div className="sheet-main projects-head">
					<h2 id="projects-title">{t("projects.title")}</h2>
					<p className="projects-lede" aria-live="polite">
						{ranked ? t("projects.ranked") : t("projects.default")}
					</p>
					<p className="projects-note">{t("projects.confidential")}</p>
				</div>
				<ol className="ledger" ref={ledgerRef}>
					{ordered.map((project, index) => {
						const match = matches.get(project.slug);
						const pct = match ? Math.round(match.coverage * 100) : null;
						return (
							<li
								key={project.slug}
								className="entry"
								data-flip-id={project.slug}
							>
								<span className="entry-no" aria-hidden="true">
									{index + 1}
								</span>
								<div className="entry-main">
									<h3 className="entry-title">
										{project.href ? (
											<a href={project.href}>{project.title}</a>
										) : (
											project.title
										)}
									</h3>
									<p className="entry-meta">
										{project.org}, {project.period}
									</p>
									<p className="entry-summary">{project.summary}</p>
									{match && (
										<p className="entry-why">
											{match.matched.length > 0 ? (
												<>
													<span className="entry-why-label">
														{t("projects.matches")}{" "}
													</span>
													{match.matched.slice(0, 4).map((id, i) => {
														const quote =
															quotesByCompetence.get(id)?.[0]?.quote;
														return (
															<span key={id}>
																{i > 0 && ", "}
																{label(id)}
																{quote && (
																	<span className="entry-quote">
																		{" "}
																		({quoted(quote)})
																	</span>
																)}
															</span>
														);
													})}
												</>
											) : (
												t("projects.noMatch")
											)}
										</p>
									)}
								</div>
								<div className="entry-side">
									{pct !== null && (
										<p className="entry-score">
											<ShareBar
												value={match?.coverage ?? 0}
												seed={index + 21}
											/>
											<span>
												<strong>{percent(match?.coverage ?? 0)}</strong>{" "}
												{t("projects.coverage")}
											</span>
										</p>
									)}
									<p className="entry-demo">
										{project.demo === "ready" && project.href ? (
											<a href={project.href}>{t("projects.openDemo")}</a>
										) : project.demo === "soon" ? (
											t("projects.demoSoon")
										) : (
											t("projects.demoNone")
										)}
									</p>
								</div>
							</li>
						);
					})}
				</ol>
			</section>
		</>
	);
}
