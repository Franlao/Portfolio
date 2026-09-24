import gsap from "gsap";
import type { GameContext, StationGame } from "../types";
import { copy, formatCard } from "./copy";
import {
	type Answer,
	type Batch,
	BENCH_SIZE,
	type Bench,
	balanceZone,
	bandMeans,
	type CardField,
	type CardPatient,
	deal,
	fitLine,
	type Measure,
	makeBench,
	measure,
	RESEMBLANCE_MIN,
	RISK_MAX,
	type Round,
	type Side,
	START_FIDELITY,
	scale,
	score,
	variables,
} from "./logic";
import "./game.css";

/**
 * « Vrai ou synthétique ? » : five pairs of batches, one real and one synthetic,
 * then a bench where the visitor tunes the generator between fidelity and privacy.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const SIDES: Side[] = ["a", "b"];
const FIELDS: CardField[] = ["age", "tension", "bmi"];

/** Chart sizes, in viewBox units: the SVG scales to the batch width. */
const HISTOGRAM = { width: 160, height: 76 };
const SCATTER = { width: 160, height: 112, pad: 6 };
const BENCH = { width: 300, height: 180, pad: 8 };

function make<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function draw<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
	const element = document.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, String(value));
	}
	return element;
}

function hiddenText(text: string): HTMLSpanElement {
	return make("span", "visually-hidden", text);
}

/** A small cake drawn in ink, on each batch: the pastry touch, kept light. */
function cake(): SVGSVGElement {
	const icon = draw("svg", {
		viewBox: "0 0 24 24",
		class: "g-pastry-cake",
		"aria-hidden": "true",
	});
	icon.append(
		draw("path", { d: "M3 21h18" }),
		draw("path", { d: "M5 21v-7h14v7" }),
		draw("path", {
			d: "M5 14c1.2 1.4 2.3 1.4 3.5 0s2.3-1.4 3.5 0 2.3 1.4 3.5 0 2.3-1.4 3.5 0",
		}),
		draw("circle", { cx: 12, cy: 12, r: 1.8 }),
		draw("path", { d: "M12 10.2c0-1.6.8-2.7 2.1-3.3" }),
	);
	return icon;
}

/** Small labels under a chart; the chart itself carries the full description. */
function axisRow(labels: string[], hidden = true): HTMLParagraphElement {
	const row = make("p", "g-pastry-axis");
	if (hidden) row.setAttribute("aria-hidden", "true");
	row.append(...labels.map((label) => make("span", undefined, label)));
	return row;
}

function histogramChart(
	counts: number[],
	top: number,
	label: string,
): SVGSVGElement {
	const { width, height } = HISTOGRAM;
	const chart = draw("svg", {
		viewBox: `0 0 ${width} ${height}`,
		class: "g-pastry-chart",
		role: "img",
		"aria-label": label,
	});
	const step = width / counts.length;
	for (const [bin, count] of counts.entries()) {
		if (count === 0) continue;
		const barHeight = Math.max(1, (count / top) * (height - 4));
		chart.append(
			draw("rect", {
				class: "g-pastry-bar",
				x: bin * step + 0.8,
				y: height - barHeight,
				width: step - 1.6,
				height: barHeight,
			}),
		);
	}
	chart.append(
		draw("line", {
			class: "g-pastry-axis-line",
			x1: 0,
			x2: width,
			y1: height,
			y2: height,
		}),
	);
	return chart;
}

const scatterX = (age: number) =>
	SCATTER.pad + scale(age, "age") * (SCATTER.width - 2 * SCATTER.pad);
const scatterY = (tension: number) =>
	SCATTER.height -
	SCATTER.pad -
	scale(tension, "tension") * (SCATTER.height - 2 * SCATTER.pad);

function scatterChart(
	points: [number, number][],
	label: string,
): SVGSVGElement {
	const { width, height, pad } = SCATTER;
	const chart = draw("svg", {
		viewBox: `0 0 ${width} ${height}`,
		class: "g-pastry-chart",
		role: "img",
		"aria-label": label,
	});
	chart.append(
		draw("path", {
			class: "g-pastry-axis-line",
			d: `M${pad / 2} 0V${height - pad / 2}H${width}`,
		}),
	);
	for (const [age, tension] of points) {
		chart.append(
			draw("circle", {
				class: "g-pastry-dot",
				cx: scatterX(age),
				cy: scatterY(tension),
				r: 2.4,
			}),
		);
	}
	return chart;
}

/** The least-squares line, in red: the control that measures the link. */
function trendLine(points: [number, number][]): SVGLineElement {
	const { slope, intercept } = fitLine(points);
	const { min, max } = variables.age;
	return draw("line", {
		class: "g-pastry-trend",
		x1: scatterX(min),
		y1: scatterY(intercept + slope * min),
		x2: scatterX(max),
		y2: scatterY(intercept + slope * max),
	});
}

function cardsTable(
	patients: CardPatient[],
	side: Side,
): { table: HTMLTableElement; cells: HTMLTableCellElement[][] } {
	const table = make("table", "g-pastry-table");
	const caption = make(
		"caption",
		"visually-hidden",
		copy.chart.cards.caption(side),
	);
	const head = make("thead");
	const headRow = make("tr");
	for (const field of FIELDS) {
		const th = make("th", undefined, copy.chart.cards.head[field]);
		th.scope = "col";
		headRow.append(th);
	}
	head.append(headRow);
	const body = make("tbody");
	const cells = patients.map((patient) => {
		const row = make("tr");
		const tds = FIELDS.map((field) =>
			make("td", undefined, formatCard(field, patient[field])),
		);
		row.append(...tds);
		body.append(row);
		return tds;
	});
	table.append(caption, head, body);
	return { table, cells };
}

interface BatchView {
	article: HTMLElement;
	tag: HTMLElement;
	stamp: HTMLElement;
	chart: SVGSVGElement | null;
	cells: HTMLTableCellElement[][];
}

const batchOf = (round: Round, side: Side): Batch =>
	side === round.synthetic ? round.fake : round.real;

const otherSide = (side: Side): Side => (side === "a" ? "b" : "a");

const peak = (batch: Batch) =>
	batch.view === "histogram" ? Math.max(...batch.counts) : 0;

function renderBatch(round: Round, side: Side, top: number): BatchView {
	const batch = batchOf(round, side);
	const article = make("article", "g-pastry-batch");
	const heading = make("h3");
	const tag = make("span", "g-pastry-tag");
	heading.append(cake(), copy.batch(side), tag);
	article.append(heading);

	let chart: SVGSVGElement | null = null;
	let cells: HTMLTableCellElement[][] = [];
	if (batch.view === "histogram") {
		chart = histogramChart(
			batch.counts,
			top,
			copy.chart.histogram(round.variable, batch.counts),
		);
		const axis = copy.chart.axis(round.variable);
		article.append(chart, axisRow([axis.min, axis.name, axis.max]));
	} else if (batch.view === "scatter") {
		chart = scatterChart(
			batch.points,
			copy.chart.scatter(batch.points.length, bandMeans(batch.points)),
		);
		article.append(
			chart,
			axisRow([copy.chart.scatterAxis.y, copy.chart.scatterAxis.x]),
		);
	} else {
		const table = cardsTable(batch.patients, side);
		cells = table.cells;
		article.append(table.table, axisRow([copy.chart.cards.note], false));
	}

	const stamp = make("p", "g-pastry-stamp", copy.stamp);
	stamp.setAttribute("aria-hidden", "true");
	article.append(stamp);
	return { article, tag, stamp, chart, cells };
}

/** The glitch of an impossible round, to name it in the clue. */
function glitchOf(round: Round) {
	if (!round.faulty || round.fake.view !== "cards") return undefined;
	const { row, field } = round.faulty;
	return { field, value: round.fake.patients[row][field] };
}

interface GaugeView {
	item: HTMLLIElement;
	mark: HTMLElement;
	markText: HTMLElement;
	value: HTMLElement;
	fill: HTMLElement;
	detail: HTMLElement;
}

function gauge(label: string, threshold: number): GaugeView {
	const item = make("li", "g-pastry-check");
	const head = make("p", "g-pastry-check-head");
	const mark = make("span", "g-pastry-mark");
	mark.setAttribute("aria-hidden", "true");
	const markText = hiddenText("");
	const value = make("span", "g-pastry-value");
	head.append(mark, markText, make("span", undefined, label), value);
	const bar = make("div", "g-pastry-gauge");
	bar.setAttribute("aria-hidden", "true");
	const fill = make("span", "g-pastry-fill");
	const tick = make("span", "g-pastry-threshold");
	tick.style.left = `${threshold * 100}%`;
	bar.append(fill, tick);
	const detail = make("p", "g-pastry-detail");
	item.append(head, bar, detail);
	return { item, mark, markText, value, fill, detail };
}

function setGauge(
	view: GaugeView,
	ratio: number,
	pass: boolean,
	value: string,
	detail: string,
) {
	view.item.dataset.pass = String(pass);
	view.mark.textContent = pass ? copy.bench.pass : copy.bench.fail;
	view.markText.textContent = pass ? copy.bench.passText : copy.bench.failText;
	view.value.textContent = value;
	view.fill.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
	view.detail.textContent = detail;
}

/** Legend glyphs, drawn with the same classes as the chart. */
function glyph(kind: "real" | "fake" | "copy"): SVGSVGElement {
	const icon = draw("svg", { viewBox: "-8 -8 16 16", "aria-hidden": "true" });
	if (kind === "real")
		icon.append(draw("circle", { class: "g-pastry-real", r: 3.5 }));
	else icon.append(draw("circle", { class: "g-pastry-fake", r: 3 }));
	if (kind === "copy") {
		icon.append(draw("circle", { class: "g-pastry-ring is-on", r: 6.5 }));
	}
	return icon;
}

const benchX = (x: number) => BENCH.pad + x * (BENCH.width - 2 * BENCH.pad);
const benchY = (y: number) =>
	BENCH.height - BENCH.pad - y * (BENCH.height - 2 * BENCH.pad);

const percent = (ratio: number) => Math.round(ratio * 100);

function mountPastry(root: HTMLElement, context: GameContext): () => void {
	const { sound, say, reducedMotion } = context;
	const tweens: gsap.core.Tween[] = [];

	const shell = make("div", "g-pastry");
	shell.classList.toggle("is-still", reducedMotion);
	root.append(shell);

	const live = make("p", "visually-hidden");
	live.setAttribute("aria-live", "polite");
	const announce = (message: string) => {
		live.textContent = message;
	};

	/* Progress. */
	const topBar = make("div", "g-pastry-top");
	const progress = make("p", "g-pastry-progress");
	const tally = make("ol", "g-pastry-tally");
	tally.setAttribute("aria-hidden", "true");
	topBar.append(progress, tally);

	/* The five rounds. */
	const quiz = make("section", "g-pastry-quiz");
	quiz.setAttribute("aria-label", copy.quizLabel);
	const rule = make("p", "g-pastry-note", copy.rule);
	rule.append(make("small", undefined, copy.fictional));
	const pair = make("div", "g-pastry-pair");
	const choices = make("div", "g-pastry-choices");
	choices.setAttribute("role", "group");
	choices.setAttribute("aria-label", copy.choicesLabel);
	const choiceButtons = {} as Record<Side, HTMLButtonElement>;
	for (const side of SIDES) {
		const button = make("button", "g-pastry-choice");
		button.type = "button";
		const key = make("kbd", undefined, side.toUpperCase());
		key.setAttribute("aria-hidden", "true");
		button.append(key, copy.choice(side));
		button.addEventListener("click", () => answer(side));
		choiceButtons[side] = button;
		choices.append(button);
	}
	const reveal = make("div", "g-pastry-reveal");
	reveal.hidden = true;
	const verdict = make("p", "g-pastry-verdict");
	const clue = make("p", "g-pastry-clue");
	const proof = make("p", "g-pastry-proof");
	const next = make("button", "g-pastry-primary");
	next.type = "button";
	next.addEventListener("click", () => nextRound());
	reveal.append(verdict, clue, proof, next);
	quiz.append(rule, pair, choices, reveal);

	/* The bench. */
	const benchSection = make("section", "g-pastry-bench");
	benchSection.setAttribute("aria-label", copy.bench.label);
	benchSection.hidden = true;
	const desk = make("div", "g-pastry-desk");

	const plot = make("figure", "g-pastry-plot");
	const benchChart = draw("svg", {
		viewBox: `0 0 ${BENCH.width} ${BENCH.height}`,
		class: "g-pastry-chart",
		role: "img",
		"aria-label": copy.bench.chart,
	});
	const realLayer = draw("g");
	const fakeLayer = draw("g");
	const ringLayer = draw("g");
	benchChart.append(
		draw("path", {
			class: "g-pastry-axis-line",
			d: `M${BENCH.pad / 2} 0V${BENCH.height - BENCH.pad / 2}H${BENCH.width}`,
		}),
		realLayer,
		fakeLayer,
		ringLayer,
	);
	const legend = make("ul", "g-pastry-legend");
	for (const kind of ["real", "fake", "copy"] as const) {
		const item = make("li");
		item.append(glyph(kind), copy.bench.legend[kind]);
		legend.append(item);
	}
	const benchStamp = make("p", "g-pastry-stamp", copy.bench.stamp);
	benchStamp.setAttribute("aria-hidden", "true");
	plot.append(
		benchChart,
		axisRow([copy.chart.scatterAxis.y, copy.chart.scatterAxis.x]),
		legend,
		benchStamp,
	);

	const controls = make("div", "g-pastry-controls");
	const dial = make("div", "g-pastry-dial");
	const dialHead = make("div", "g-pastry-dial-head");
	const range = make("input", "g-pastry-range");
	range.type = "range";
	range.id = "g-pastry-fidelity";
	range.min = "0";
	range.max = "100";
	range.step = "1";
	const label = make("label", undefined, copy.bench.slider);
	label.htmlFor = range.id;
	const output = make("output");
	output.setAttribute("for", range.id);
	output.setAttribute("aria-hidden", "true");
	dialHead.append(label, output);
	const track = make("div", "g-pastry-track");
	const rail = make("div", "g-pastry-rail");
	const zoneBand = make("div", "g-pastry-zone");
	zoneBand.append(make("span", undefined, copy.bench.zone));
	rail.append(zoneBand);
	track.append(rail, range);
	const ends = make("div", "g-pastry-ends");
	ends.setAttribute("aria-hidden", "true");
	ends.append(
		make("span", undefined, copy.bench.ends.low),
		make("span", undefined, copy.bench.ends.high),
	);
	dial.append(dialHead, track, ends);

	const checks = make("ul", "g-pastry-checks");
	const resemblanceGauge = gauge(copy.bench.resemblance.label, RESEMBLANCE_MIN);
	const riskGauge = gauge(copy.bench.risk.label, RISK_MAX);
	checks.append(resemblanceGauge.item, riskGauge.item);

	const status = make("p", "g-pastry-status");
	const serveRow = make("div", "g-pastry-serve");
	const serveButton = make("button", "g-pastry-primary", copy.bench.serve);
	serveButton.type = "button";
	serveButton.addEventListener("click", () => serve());
	const resultButton = make("button", "g-pastry-primary", copy.bench.result);
	resultButton.type = "button";
	resultButton.addEventListener("click", () => showEnd());
	serveRow.append(serveButton, resultButton);
	controls.append(dial, checks, status, serveRow);
	desk.append(plot, controls);
	benchSection.append(
		make("h3", undefined, copy.bench.heading),
		make("p", "g-pastry-note", copy.bench.note),
		desk,
	);
	range.addEventListener("input", () => updateBench());

	/* The end. */
	const end = make("section", "g-pastry-end");
	end.hidden = true;
	const endScore = make("p", "g-pastry-score");
	const recap = make("ul", "g-pastry-recap");
	const setting = make("p", "g-pastry-setting");
	const again = make("button", "g-pastry-primary", copy.end.again);
	again.type = "button";
	again.addEventListener("click", () => start(true));
	const back = make("button", "g-pastry-link", copy.end.back);
	back.type = "button";
	back.addEventListener("click", () => context.close());
	const actions = make("div", "g-pastry-actions");
	actions.append(again, back);
	end.append(
		make("h3", undefined, copy.end.heading),
		endScore,
		make("p", undefined, copy.end.recap),
		recap,
		setting,
		make("p", "g-pastry-project", copy.end.project),
		actions,
	);

	shell.append(topBar, quiz, benchSection, end, live);

	/* State. */
	let phase: "quiz" | "bench" | "end" = "quiz";
	let rounds: Round[] = [];
	let index = 0;
	let answered = false;
	let answers: Answer[] = [];
	let views: Record<Side, BatchView> | null = null;
	let bench: Bench = makeBench(0);
	let zone: { from: number; to: number } | null = null;
	let current: Measure | null = null;
	let served: Measure | null = null;
	let inZone = false;
	let fakeDots: SVGCircleElement[] = [];
	let rings: SVGCircleElement[] = [];

	function start(focus = false) {
		// Each game gets its own seed: the logic stays deterministic, the next game differs.
		const seed = Math.floor(Math.random() * 0x100000000);
		rounds = deal(seed);
		bench = makeBench(seed);
		zone = balanceZone(bench);
		index = 0;
		answers = [];
		phase = "quiz";
		topBar.hidden = false;
		quiz.hidden = false;
		benchSection.hidden = true;
		end.hidden = true;
		showRound(focus);
	}

	function renderTally() {
		tally.replaceChildren(
			...rounds.map((_, i) => {
				const item = make("li");
				const given = answers[i];
				item.dataset.state = given
					? given.right
						? "right"
						: "wrong"
					: i === index && phase === "quiz"
						? "current"
						: "pending";
				item.textContent = given ? (given.right ? "✓" : "✗") : "";
				return item;
			}),
		);
	}

	function showRound(focus = true) {
		answered = false;
		const round = rounds[index];
		progress.textContent = copy.progress(index, rounds.length);
		const top = Math.max(peak(round.real), peak(round.fake));
		views = {
			a: renderBatch(round, "a", top),
			b: renderBatch(round, "b", top),
		};
		pair.replaceChildren(views.a.article, views.b.article);
		for (const side of SIDES) {
			choiceButtons[side].disabled = false;
			choiceButtons[side].classList.remove("is-chosen");
		}
		reveal.hidden = true;
		renderTally();
		if (!reducedMotion) {
			tweens.push(
				gsap.fromTo(
					[views.a.article, views.b.article],
					{ y: -14, opacity: 0 },
					{
						y: 0,
						opacity: 1,
						duration: 0.32,
						stagger: 0.08,
						ease: "back.out(1.7)",
						clearProps: "transform,opacity",
					},
				),
			);
		}
		if (focus) {
			choiceButtons.a.focus({ preventScroll: true });
			topBar.scrollIntoView({ block: "nearest" });
			announce(progress.textContent);
		}
		sound.pop();
	}

	function answer(side: Side) {
		if (phase !== "quiz" || answered || !views) return;
		answered = true;
		const round = rounds[index];
		const right = side === round.synthetic;
		answers.push({ flaw: round.flaw, right });
		for (const each of SIDES) choiceButtons[each].disabled = true;
		choiceButtons[side].classList.add("is-chosen");

		// The reveal: the synthetic batch turns blue (a model wrote it) and gets the stamp.
		const fake = views[round.synthetic];
		const real = views[otherSide(round.synthetic)];
		fake.article.classList.add("is-synthetic");
		fake.stamp.classList.add("is-visible");
		fake.tag.replaceChildren(hiddenText(copy.stamp));
		real.tag.textContent = copy.realTag;
		if (round.faulty) {
			const cell =
				fake.cells[round.faulty.row]?.[FIELDS.indexOf(round.faulty.field)];
			cell?.classList.add("is-faulty");
			cell?.append(hiddenText(` (${copy.chart.cards.faulty})`));
		}
		if (round.flaw === "link") {
			for (const each of SIDES) {
				const batch = batchOf(round, each);
				if (batch.view === "scatter") {
					views[each].chart?.append(trendLine(batch.points));
				}
			}
		}

		const flaw = copy.flaws[round.flaw];
		verdict.textContent = right
			? copy.right(round.synthetic)
			: copy.wrong(round.synthetic);
		verdict.dataset.right = String(right);
		const explanation = flaw.text(round.variable, glitchOf(round));
		clue.replaceChildren(
			make("strong", undefined, flaw.title),
			` ${explanation}`,
		);
		const proofText = flaw.proof(
			round.check.real,
			round.check.fake,
			round.variable,
		);
		proof.replaceChildren(make("b", undefined, copy.proofLabel), proofText);
		next.textContent = index + 1 < rounds.length ? copy.next : copy.toBench;
		reveal.hidden = false;
		renderTally();

		sound.stamp();
		if (right) {
			sound.good();
			say(copy.shoutRight);
		} else {
			sound.bad();
			say(flaw.shout);
		}
		announce(`${verdict.textContent} ${flaw.title} ${explanation}`);
		next.focus({ preventScroll: true });
		reveal.scrollIntoView({
			block: "nearest",
			behavior: reducedMotion ? "auto" : "smooth",
		});
	}

	function nextRound() {
		index++;
		if (index < rounds.length) showRound();
		else openBench();
	}

	function openBench() {
		phase = "bench";
		quiz.hidden = true;
		benchSection.hidden = false;
		progress.textContent = copy.bench.progress;
		renderTally();
		served = null;
		inZone = false;
		zoneBand.hidden = true;
		if (zone) {
			zoneBand.style.left = `${zone.from}%`;
			zoneBand.style.width = `${Math.max(zone.to - zone.from, 1)}%`;
		}
		benchStamp.classList.remove("is-visible");
		serveButton.hidden = false;
		resultButton.hidden = true;
		range.disabled = false;
		range.value = String(START_FIDELITY);

		// Real patients stay put; the synthetic ones and their copy rings follow the slider.
		realLayer.replaceChildren(
			...bench.real.map((point) =>
				draw("circle", {
					class: "g-pastry-real",
					cx: benchX(point.x),
					cy: benchY(point.y),
					r: 3,
				}),
			),
		);
		fakeDots = bench.real.map(() =>
			draw("circle", { class: "g-pastry-fake", r: 2.6 }),
		);
		rings = bench.real.map(() =>
			draw("circle", { class: "g-pastry-ring", r: 6.5 }),
		);
		fakeLayer.replaceChildren(...fakeDots);
		ringLayer.replaceChildren(...rings);
		updateBench();

		say(copy.bench.shoutStart);
		sound.pop();
		announce(copy.bench.heading);
		range.focus({ preventScroll: true });
		topBar.scrollIntoView({ block: "nearest" });
	}

	function updateBench() {
		if (served) return;
		const fidelity = Number(range.value);
		const result = measure(bench, fidelity);
		current = result;
		for (const [i, point] of result.points.entries()) {
			const cx = benchX(point.x);
			const cy = benchY(point.y);
			fakeDots[i].setAttribute("cx", String(cx));
			fakeDots[i].setAttribute("cy", String(cy));
			rings[i].setAttribute("cx", String(cx));
			rings[i].setAttribute("cy", String(cy));
			rings[i].classList.toggle("is-on", result.copies[i]);
		}
		const resemblance = percent(result.resemblance);
		const risk = percent(result.risk);
		output.textContent = String(fidelity);
		range.setAttribute(
			"aria-valuetext",
			copy.bench.valueText(fidelity, resemblance, risk),
		);
		setGauge(
			resemblanceGauge,
			result.resemblance,
			result.resemblance >= RESEMBLANCE_MIN,
			copy.bench.percent(resemblance),
			copy.bench.resemblance.detail(percent(RESEMBLANCE_MIN)),
		);
		setGauge(
			riskGauge,
			result.risk,
			result.risk <= RISK_MAX,
			copy.bench.percent(risk),
			copy.bench.risk.detail(result.copyCount, BENCH_SIZE, percent(RISK_MAX)),
		);

		// The balance zone lights up the first time the visitor finds it.
		const balanced = result.verdict === "balanced";
		if (balanced && zone) zoneBand.hidden = false;
		if (balanced !== inZone) {
			inZone = balanced;
			announce(balanced ? copy.bench.inZone : copy.bench.outZone);
		}
		status.dataset.tone = "";
		status.textContent = balanced ? copy.bench.inZone : "";
	}

	function serve() {
		if (phase !== "bench" || served || !current) return;
		const result = current;
		const resemblance = percent(result.resemblance);
		const risk = percent(result.risk);
		if (result.verdict === "balanced") {
			served = result;
			range.disabled = true;
			benchStamp.classList.add("is-visible");
			status.dataset.tone = "good";
			status.textContent = copy.bench.served(resemblance, risk);
			serveButton.hidden = true;
			resultButton.hidden = false;
			sound.stamp();
			sound.good();
			say(copy.bench.shoutServed);
			announce(status.textContent);
			resultButton.focus({ preventScroll: true });
			return;
		}
		// Refused: say which control failed, and show where the balance lies.
		if (zone) zoneBand.hidden = false;
		status.dataset.tone = "bad";
		status.textContent =
			result.verdict === "leak"
				? copy.bench.leak(result.copyCount, BENCH_SIZE)
				: copy.bench.bland(resemblance, percent(RESEMBLANCE_MIN));
		sound.bad();
		say(
			result.verdict === "leak" ? copy.bench.shoutLeak : copy.bench.shoutBland,
		);
		announce(status.textContent);
	}

	function showEnd() {
		phase = "end";
		topBar.hidden = true;
		quiz.hidden = true;
		benchSection.hidden = true;
		end.hidden = false;
		const result = score(answers);
		endScore.textContent = copy.end.score(result.right, result.total);
		recap.replaceChildren(
			...answers.map((given) => {
				const item = make("li");
				const mark = make(
					"span",
					"g-pastry-recap-mark",
					given.right ? "✓" : "✗",
				);
				mark.setAttribute("aria-hidden", "true");
				item.append(
					mark,
					copy.flaws[given.flaw].name,
					hiddenText(` (${given.right ? copy.end.found : copy.end.missed})`),
				);
				return item;
			}),
		);
		setting.textContent = served
			? copy.end.setting(percent(served.resemblance), percent(served.risk))
			: "";
		sound.bell();
		say(copy.end.shout);
		announce(endScore.textContent);
		again.focus({ preventScroll: true });
		end.scrollIntoView({ block: "nearest" });
	}

	const onKey = (event: KeyboardEvent) => {
		if (phase !== "quiz" || answered || !shell.isConnected) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === "a" || key === "1") answer("a");
		else if (key === "b" || key === "2") answer("b");
	};
	window.addEventListener("keydown", onKey);

	start();
	say(copy.start);

	return () => {
		window.removeEventListener("keydown", onKey);
		for (const tween of tweens) tween.kill();
		tweens.length = 0;
	};
}

export const game: StationGame = {
	title: copy.title,
	intro: copy.intro,
	mount: mountPastry,
};
