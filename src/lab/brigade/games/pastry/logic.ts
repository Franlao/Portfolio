/**
 * « Vrai ou synthétique ? », the pastry station: pure logic, no DOM.
 * Every draw comes from a seeded generator, so a game is reproducible and testable,
 * and a new seed deals a different game. All patients are fictional, the "real" ones included.
 */

export type Random = () => number;

/** mulberry32: a tiny seeded generator, plenty for a game. */
export function seeded(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal draw (Box-Muller). */
export function gaussian(random: Random): number {
	const u = 1 - random(); // in (0, 1], so the log is finite
	const v = random();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Normal draw kept inside [min, max] by rejection, so histograms show no pile-up at the edges. */
function truncated(
	random: Random,
	center: number,
	spread: number,
	min: number,
	max: number,
): number {
	for (let attempt = 0; attempt < 100; attempt++) {
		const value = center + spread * gaussian(random);
		if (value >= min && value <= max) return value;
	}
	return Math.min(max, Math.max(min, center));
}

export function round(value: number, digits = 0): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/* Statistics: the "controls" that compare a synthetic batch with the real one. */

export function mean(values: readonly number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function std(values: readonly number[]): number {
	const center = mean(values);
	return Math.sqrt(mean(values.map((value) => (value - center) ** 2)));
}

export function correlation(
	xs: readonly number[],
	ys: readonly number[],
): number {
	const mx = mean(xs);
	const my = mean(ys);
	let cov = 0;
	let vx = 0;
	let vy = 0;
	for (let i = 0; i < xs.length; i++) {
		cov += (xs[i] - mx) * (ys[i] - my);
		vx += (xs[i] - mx) ** 2;
		vy += (ys[i] - my) ** 2;
	}
	return vx === 0 || vy === 0 ? 0 : cov / Math.sqrt(vx * vy);
}

/** Least-squares line, drawn at the reveal to show the link (or its absence). */
export function fitLine(points: readonly (readonly [number, number])[]): {
	slope: number;
	intercept: number;
} {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	const mx = mean(xs);
	const my = mean(ys);
	let cov = 0;
	let vx = 0;
	for (let i = 0; i < xs.length; i++) {
		cov += (xs[i] - mx) * (ys[i] - my);
		vx += (xs[i] - mx) ** 2;
	}
	const slope = vx === 0 ? 0 : cov / vx;
	return { slope, intercept: my - slope * mx };
}

/** Age bands used to describe a scatter plot in words, for screen readers. */
export const AGE_BANDS: [number, number][] = [
	[18, 39],
	[40, 59],
	[60, 89],
];

/** Mean blood pressure per age band: the trend a sighted visitor reads on the chart. */
export function bandMeans(
	points: readonly (readonly [number, number])[],
): number[] {
	return AGE_BANDS.map(([from, to]) => {
		const inside = points.filter(([age]) => age >= from && age <= to);
		return inside.length > 0 ? mean(inside.map(([, tension]) => tension)) : 0;
	});
}

/* The fictional population. */

export interface Patient {
	/** Years. */
	age: number;
	/** Systolic blood pressure, mmHg. */
	tension: number;
	/** Fasting blood sugar, g/L. */
	glycemia: number;
	/** Body mass index. */
	bmi: number;
}

export function drawPatient(random: Random): Patient {
	const age = Math.round(truncated(random, 52, 16, 18, 89));
	// Blood pressure rises with age: the link a naive generator loses.
	const tension = Math.round(truncated(random, 95 + 0.65 * age, 10, 92, 188));
	// Two groups in blood sugar, without and with diabetes, the second more frequent with age.
	const diabetic = random() < 0.15 + 0.35 * ((age - 18) / 71);
	const glycemia = round(
		diabetic
			? truncated(random, 1.55, 0.15, 1.15, 2.15)
			: truncated(random, 0.95, 0.08, 0.65, 1.2),
		2,
	);
	// BMI leans right: a long tail of high values.
	const bmi = round(
		Math.exp(truncated(random, Math.log(25), 0.24, Math.log(16), Math.log(45))),
		1,
	);
	return { age, tension, glycemia, bmi };
}

function population(random: Random, size: number): Patient[] {
	return Array.from({ length: size }, () => drawPatient(random));
}

export type VariableId = keyof Patient;

export interface Variable {
	min: number;
	max: number;
	bins: number;
}

/** Fixed axes, so both batches of a round are drawn on the same scale. */
export const variables: Record<VariableId, Variable> = {
	age: { min: 18, max: 90, bins: 18 },
	tension: { min: 90, max: 190, bins: 20 },
	glycemia: { min: 0.6, max: 2.2, bins: 16 },
	bmi: { min: 10, max: 46, bins: 18 },
};

export function histogram(values: readonly number[], id: VariableId): number[] {
	const { min, max, bins } = variables[id];
	const counts = Array.from({ length: bins }, () => 0);
	for (const value of values) {
		// A tiny epsilon keeps values sitting on a bin edge in the upper bin despite float error.
		const bin = Math.floor(((value - min) / (max - min)) * bins + 1e-9);
		if (bin >= 0 && bin < bins) counts[bin]++;
	}
	return counts;
}

function binCenter(id: VariableId, bin: number): number {
	const { min, max, bins } = variables[id];
	return min + ((bin + 0.5) * (max - min)) / bins;
}

/** Skewness computed from the histogram, as a comparison tool would. */
export function skewness(counts: readonly number[], id: VariableId): number {
	const total = counts.reduce((sum, count) => sum + count, 0);
	const centers = counts.map((_, bin) => binCenter(id, bin));
	const m = counts.reduce((sum, c, bin) => sum + c * centers[bin], 0) / total;
	const moment = (power: number) =>
		counts.reduce((sum, c, bin) => sum + c * (centers[bin] - m) ** power, 0) /
		total;
	const variance = moment(2);
	return variance === 0 ? 0 : moment(3) / variance ** 1.5;
}

/**
 * Counts the bumps of a distribution: local maxima of the smoothed histogram,
 * kept only when a real dip separates them, so sampling noise is not a bump.
 */
export function countBumps(counts: readonly number[]): number {
	const smooth = counts.map(
		(count, i) =>
			((counts[i - 1] ?? count) + 2 * count + (counts[i + 1] ?? count)) / 4,
	);
	const top = Math.max(...smooth);
	const peaks: number[] = [];
	for (let i = 0; i < smooth.length; i++) {
		const left = smooth[i - 1] ?? -1;
		const right = smooth[i + 1] ?? -1;
		if (smooth[i] >= left && smooth[i] > right && smooth[i] >= 0.1 * top) {
			peaks.push(i);
		}
	}
	let bumps = 0;
	let last = -1;
	for (const peak of peaks) {
		if (last < 0) {
			bumps = 1;
			last = peak;
			continue;
		}
		const dip = Math.min(...smooth.slice(last, peak + 1));
		if (dip < 0.6 * Math.min(smooth[last], smooth[peak])) {
			bumps++;
			last = peak;
		} else if (smooth[peak] > smooth[last]) {
			last = peak;
		}
	}
	return bumps;
}

/** Normal cumulative distribution (Abramowitz and Stegun 7.1.26, error under 1e-7). */
function normalCdf(z: number): number {
	const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
	const poly =
		t *
		(0.254829592 +
			t *
				(-0.284496736 +
					t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
	const erf = 1 - poly * Math.exp(-(z * z) / 2);
	return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** The exact counts a textbook bell would give: computed, not sampled, hence too smooth. */
function bellCounts(
	id: VariableId,
	center: number,
	spread: number,
	total: number,
): number[] {
	const { min, max, bins } = variables[id];
	const width = (max - min) / bins;
	return Array.from({ length: bins }, (_, bin) => {
		const from = normalCdf((min + bin * width - center) / spread);
		const to = normalCdf((min + (bin + 1) * width - center) / spread);
		return Math.round(total * (to - from));
	});
}

/* The rounds: one real batch, one synthetic batch with a telltale flaw. */

export type FlawId =
	| "narrow"
	| "bumps"
	| "skew"
	| "link"
	| "collapse"
	| "impossible";

export const flaws: FlawId[] = [
	"narrow",
	"bumps",
	"skew",
	"link",
	"collapse",
	"impossible",
];

export const ROUNDS = 5;

export type View = "histogram" | "scatter" | "cards";

export const viewOf: Record<FlawId, View> = {
	narrow: "histogram",
	bumps: "histogram",
	skew: "histogram",
	link: "scatter",
	collapse: "cards",
	impossible: "cards",
};

export type Side = "a" | "b";

export interface CardPatient {
	age: number;
	tension: number;
	bmi: number;
}

export type CardField = keyof CardPatient;

export type Batch =
	| { view: "histogram"; counts: number[] }
	| { view: "scatter"; points: [number, number][] }
	| { view: "cards"; patients: CardPatient[] };

export interface Round {
	flaw: FlawId;
	/** Which side the synthetic batch sits on. */
	synthetic: Side;
	real: Batch;
	fake: Batch;
	/** The variable on display (histograms), or the one the flaw is about. */
	variable: VariableId;
	/** The statistic that tells the batches apart, computed on both. */
	check: { real: number; fake: number };
	/** Impossible round: the faulty cell of the synthetic batch. */
	faulty?: { row: number; field: CardField };
}

type Dealt = Omit<Round, "synthetic">;

const HISTOGRAM_SIZE = 400;
const SCATTER_SIZE = 60;
export const CARD_SIZE = 5;

/** Values no living patient can have. */
export const limits: Record<CardField, [number, number]> = {
	age: [0, 120],
	tension: [60, 260],
	bmi: [10, 80],
};

export function outOfLimits(patients: readonly CardPatient[]): number {
	let count = 0;
	for (const patient of patients) {
		for (const field of Object.keys(limits) as CardField[]) {
			const [min, max] = limits[field];
			if (patient[field] < min || patient[field] > max) count++;
		}
	}
	return count;
}

export function ageSpread(patients: readonly CardPatient[]): number {
	const ages = patients.map((p) => p.age);
	return Math.max(...ages) - Math.min(...ages);
}

const toCard = ({ age, tension, bmi }: Patient): CardPatient => ({
	age,
	tension,
	bmi,
});

/** Five patients spread over the ages, like a real waiting room. */
function waitingRoom(random: Random): CardPatient[] {
	let cards = population(random, CARD_SIZE).map(toCard);
	for (let attempt = 0; attempt < 50 && ageSpread(cards) < 30; attempt++) {
		cards = population(random, CARD_SIZE).map(toCard);
	}
	return cards;
}

function narrowRound(random: Random): Dealt {
	const variable: VariableId = random() < 0.5 ? "age" : "tension";
	const { min, max } = variables[variable];
	const real = population(random, HISTOGRAM_SIZE).map((p) => p[variable]);
	// A cautious generator: the right mean, a third of the spread, no rare patients.
	const fake = real.map(() =>
		Math.round(truncated(random, mean(real), std(real) * 0.35, min, max - 1)),
	);
	return {
		flaw: "narrow",
		variable,
		real: { view: "histogram", counts: histogram(real, variable) },
		fake: { view: "histogram", counts: histogram(fake, variable) },
		check: { real: std(real), fake: std(fake) },
	};
}

function bumpsRound(random: Random): Dealt {
	const real = population(random, HISTOGRAM_SIZE).map((p) => p.glycemia);
	// One bell with the right mean and spread: the two groups melt into one.
	const fake = real.map(() =>
		round(truncated(random, mean(real), std(real), 0.6, 2.19), 2),
	);
	const realCounts = histogram(real, "glycemia");
	const fakeCounts = histogram(fake, "glycemia");
	return {
		flaw: "bumps",
		variable: "glycemia",
		real: { view: "histogram", counts: realCounts },
		fake: { view: "histogram", counts: fakeCounts },
		check: { real: countBumps(realCounts), fake: countBumps(fakeCounts) },
	};
}

function skewRound(random: Random): Dealt {
	const real = population(random, HISTOGRAM_SIZE).map((p) => p.bmi);
	const realCounts = histogram(real, "bmi");
	const fakeCounts = bellCounts("bmi", mean(real), std(real), real.length);
	return {
		flaw: "skew",
		variable: "bmi",
		real: { view: "histogram", counts: realCounts },
		fake: { view: "histogram", counts: fakeCounts },
		check: {
			real: skewness(realCounts, "bmi"),
			fake: skewness(fakeCounts, "bmi"),
		},
	};
}

function linkRound(random: Random): Dealt {
	const real = population(random, SCATTER_SIZE).map((p): [number, number] => [
		p.age,
		p.tension,
	]);
	const other = population(random, SCATTER_SIZE);
	const ages = other.map((p) => p.age);
	// Columns learnt one by one: each is right on its own, the link between them is gone.
	let tensions = shuffle(
		other.map((p) => p.tension),
		random,
	);
	for (
		let attempt = 0;
		attempt < 50 && Math.abs(correlation(ages, tensions)) > 0.12;
		attempt++
	) {
		tensions = shuffle(tensions, random);
	}
	const fake = ages.map((age, i): [number, number] => [age, tensions[i]]);
	const corr = (points: [number, number][]) =>
		correlation(
			points.map((p) => p[0]),
			points.map((p) => p[1]),
		);
	return {
		flaw: "link",
		variable: "tension",
		real: { view: "scatter", points: real },
		fake: { view: "scatter", points: fake },
		check: { real: corr(real), fake: corr(fake) },
	};
}

function collapseRound(random: Random): Dealt {
	const real = waitingRoom(random);
	const base = drawPatient(random);
	// Mode collapse: one recipe that passes, served again and again with a pinch of noise.
	const fake = real.map(() => ({
		age: base.age + Math.floor(random() * 3) - 1,
		tension: base.tension + Math.floor(random() * 5) - 2,
		bmi: round(base.bmi + (random() - 0.5) * 0.6, 1),
	}));
	return {
		flaw: "collapse",
		variable: "age",
		real: { view: "cards", patients: real },
		fake: { view: "cards", patients: fake },
		check: { real: ageSpread(real), fake: ageSpread(fake) },
	};
}

/** Out-of-limits values the generator may produce: the shape of a number, not its meaning. */
export const glitches: { field: CardField; value: number }[] = [
	{ field: "age", value: 146 },
	{ field: "age", value: -3 },
	{ field: "bmi", value: 3.4 },
];

function impossibleRound(random: Random): Dealt {
	const real = waitingRoom(random);
	const fake = waitingRoom(random);
	const glitch = glitches[Math.floor(random() * glitches.length)];
	const row = Math.floor(random() * fake.length);
	fake[row] = { ...fake[row], [glitch.field]: glitch.value };
	return {
		flaw: "impossible",
		variable: glitch.field,
		real: { view: "cards", patients: real },
		fake: { view: "cards", patients: fake },
		check: { real: outOfLimits(real), fake: outOfLimits(fake) },
		faulty: { row, field: glitch.field },
	};
}

const builders: Record<FlawId, (random: Random) => Dealt> = {
	narrow: narrowRound,
	bumps: bumpsRound,
	skew: skewRound,
	link: linkRound,
	collapse: collapseRound,
	impossible: impossibleRound,
};

/** Orders the flaws so that two rounds in a row rarely show the same kind of chart. */
export function alternate(picked: readonly FlawId[]): FlawId[] {
	const rest = [...picked];
	const ordered: FlawId[] = [];
	while (rest.length > 0) {
		const previous = ordered.at(-1);
		const left = (view: View) =>
			rest.filter((flaw) => viewOf[flaw] === view).length;
		let best = -1;
		for (let i = 0; i < rest.length; i++) {
			if (previous && viewOf[rest[i]] === viewOf[previous]) continue;
			// The most represented kind goes first, or it ends up in a row at the end.
			if (best < 0 || left(viewOf[rest[i]]) > left(viewOf[rest[best]])) {
				best = i;
			}
		}
		ordered.push(...rest.splice(Math.max(best, 0), 1));
	}
	return ordered;
}

/** Deals a game: five of the six flaws, in a varied order, the synthetic side balanced. */
export function deal(seed: number): Round[] {
	const random = seeded(seed);
	const picked = alternate(shuffle(flaws, random).slice(0, ROUNDS));
	const sides = shuffle<Side>(
		["a", "a", "b", "b", random() < 0.5 ? "a" : "b"],
		random,
	);
	return picked.map((flaw, i) => ({
		...builders[flaw](random),
		synthetic: sides[i],
	}));
}

/* The bench: one slider from "unrecognisable" to "carbon copy". */

export const BENCH_SIZE = 40;
/** Two patients closer than this (on axes scaled to 0..1) are the same person. */
export const COPY_RADIUS = 0.006;
export const RESEMBLANCE_MIN = 0.8;
export const RISK_MAX = 0.1;
export const START_FIDELITY = 8;

/** Spread of the synthetic patients around the data the generator learnt from. */
const NOISE_LOOSE = 0.5;
const NOISE_TIGHT = 0.0015;

export interface Point {
	x: number;
	y: number;
}

export interface Bench {
	/** Real patients, on axes scaled to 0..1 (age, blood pressure). */
	real: Point[];
	/** Fixed random directions: the slider only changes how far each patient strays. */
	offsets: Point[];
}

export function scale(value: number, id: VariableId): number {
	const { min, max } = variables[id];
	return (value - min) / (max - min);
}

export function makeBench(seed: number): Bench {
	// A separate stream, so the bench does not depend on the rounds dealt before it.
	const random = seeded(seed ^ 0x5bd1e995);
	const real = population(random, BENCH_SIZE).map((p) => ({
		x: scale(p.age, "age"),
		y: scale(p.tension, "tension"),
	}));
	const offsets = real.map(() => ({
		x: gaussian(random),
		y: gaussian(random),
	}));
	return { real, offsets };
}

/**
 * Log scale: every step of the slider tightens the generator by the same factor.
 * At the far end the generator hands back its training data: a carbon copy.
 */
export function noiseScale(fidelity: number): number {
	if (fidelity >= 100) return 0;
	return NOISE_LOOSE * (NOISE_TIGHT / NOISE_LOOSE) ** (fidelity / 100);
}

/** Folds a value back into 0..1, like a ball bouncing off the walls of the chart. */
function reflect(value: number): number {
	let v = value;
	for (let i = 0; i < 8 && (v < 0 || v > 1); i++) v = v < 0 ? -v : 2 - v;
	return Math.min(1, Math.max(0, v));
}

export function synthesize(bench: Bench, fidelity: number): Point[] {
	const spread = noiseScale(fidelity);
	return bench.real.map((point, i) => ({
		x: reflect(point.x + spread * bench.offsets[i].x),
		y: reflect(point.y + spread * bench.offsets[i].y),
	}));
}

/**
 * How well the synthetic batch keeps the statistical properties of the real one:
 * means, spreads and the age and blood pressure link. 1 means identical.
 */
export function resemblance(real: Point[], synthetic: Point[]): number {
	const xs = (points: Point[]) => points.map((p) => p.x);
	const ys = (points: Point[]) => points.map((p) => p.y);
	const link = (points: Point[]) => correlation(xs(points), ys(points));
	const gaps = [
		Math.abs(mean(xs(synthetic)) - mean(xs(real))) / 0.15,
		Math.abs(mean(ys(synthetic)) - mean(ys(real))) / 0.15,
		Math.abs(std(xs(synthetic)) / std(xs(real)) - 1) / 0.5,
		Math.abs(std(ys(synthetic)) / std(ys(real)) - 1) / 0.5,
		Math.abs(link(synthetic) - link(real)) / 0.5,
	];
	return 1 - mean(gaps.map((gap) => Math.min(1, gap)));
}

export type Verdict = "bland" | "leak" | "balanced";

export interface Measure {
	points: Point[];
	/** For each synthetic patient: is it nearly identical to a real one? */
	copies: boolean[];
	copyCount: number;
	resemblance: number;
	/** Share of synthetic patients close enough to a real one to re-identify them. */
	risk: number;
	verdict: Verdict;
}

export function measure(bench: Bench, fidelity: number): Measure {
	const points = synthesize(bench, fidelity);
	const copies = points.map((p) =>
		bench.real.some((r) => Math.hypot(p.x - r.x, p.y - r.y) < COPY_RADIUS),
	);
	const copyCount = copies.filter(Boolean).length;
	const similar = resemblance(bench.real, points);
	const risk = copyCount / points.length;
	const verdict: Verdict =
		risk > RISK_MAX ? "leak" : similar < RESEMBLANCE_MIN ? "bland" : "balanced";
	return { points, copies, copyCount, resemblance: similar, risk, verdict };
}

/** The longest run of slider values where the batch passes both controls. */
export function balanceZone(bench: Bench): { from: number; to: number } | null {
	let best: { from: number; to: number } | null = null;
	let from = -1;
	for (let fidelity = 0; fidelity <= 101; fidelity++) {
		const ok =
			fidelity <= 100 && measure(bench, fidelity).verdict === "balanced";
		if (ok && from < 0) from = fidelity;
		if (!ok && from >= 0) {
			const run = { from, to: fidelity - 1 };
			if (!best || run.to - run.from > best.to - best.from) best = run;
			from = -1;
		}
	}
	return best;
}

/* The score. */

export interface Answer {
	flaw: FlawId;
	right: boolean;
}

export function score(answers: readonly Answer[]): {
	right: number;
	total: number;
} {
	return {
		right: answers.filter((answer) => answer.right).length,
		total: answers.length,
	};
}
