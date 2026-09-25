import type { Lang } from "../types";
import { type Copy, copy, typeset } from "./copy";
import { type Datum, type Figure, type Page, rng } from "./logic";

/**
 * The figures of the fictional pages, drawn as inline SVG from their description (viewBox 200 × 120).
 * Every value a claim may rely on sits in a <g data-fact> group: that is what the verifier circles.
 * Pure string building, so the tests can check that each value is really on the drawing.
 * The geometry is shared; only the words drawn on it follow the language.
 */

type Of<K extends Figure["kind"]> = Extract<Figure, { kind: K }>;
type Anchor = "start" | "middle" | "end";

const escapeXml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const r = (value: number) => Number(value.toFixed(1));

/** What a drawing needs from its language: the words to write, typeset for it, and its numbers. */
interface Pen {
	words: Copy["figure"];
	/** Groups thousands the way the language writes them. */
	grouped: (value: number) => string;
	text(
		x: number,
		y: number,
		content: string,
		anchor?: Anchor,
		className?: string,
	): string;
}

function penFor(lang: Lang): Pen {
	const set = typeset[lang];
	return {
		words: copy[lang].figure,
		grouped: copy[lang].grouped,
		text(x, y, content, anchor = "start", className = "") {
			const klass = className ? ` class="${className}"` : "";
			return `<text x="${r(x)}" y="${r(y)}" text-anchor="${anchor}"${klass}>${escapeXml(set(content))}</text>`;
		},
	};
}

const path = (d: string, className = "line") =>
	`<path class="${className}" d="${d}"/>`;

function spot(datum: Datum, body: string): string {
	return `<g class="g-library-spot" data-fact="${escapeXml(datum.key)}">${body}</g>`;
}

/** A filled arrowhead whose tip sits on (x, y), pointing along angle (radians). */
function arrow(x: number, y: number, angle: number): string {
	const length = 5;
	const half = 2.2;
	const bx = x - Math.cos(angle) * length;
	const by = y - Math.sin(angle) * length;
	const px = -Math.sin(angle) * half;
	const py = Math.cos(angle) * half;
	return `<path class="fill" d="M${r(x)} ${r(y)}L${r(bx + px)} ${r(by + py)}L${r(bx - px)} ${r(by - py)}Z"/>`;
}

/** A dimension line, arrowheads at both ends. */
function dimension(x1: number, y1: number, x2: number, y2: number): string {
	const angle = Math.atan2(y2 - y1, x2 - x1);
	return (
		path(`M${x1} ${y1}L${x2} ${y2}`, "thin") +
		arrow(x2, y2, angle) +
		arrow(x1, y1, angle + Math.PI)
	);
}

function table(pen: Pen, figure: Of<"table">): string {
	const left = 8;
	const right = 192;
	const top = 10;
	const headHeight = 20;
	const rowHeight = 28;
	const height = headHeight + rowHeight * figure.rows.length;
	const rows = figure.rows
		.map((row, i) => {
			const y = top + headHeight + i * rowHeight;
			const rule = i > 0 ? path(`M${left} ${y}H${right}`, "hair") : "";
			return (
				rule +
				spot(
					row,
					`<rect class="hit" x="${left + 6}" y="${y + 7}" width="${right - left - 12}" height="${rowHeight - 12}"/>` +
						pen.text(left + 8, y + 18, row.label) +
						pen.text(right - 8, y + 18, row.value, "end", "strong"),
				)
			);
		})
		.join("");
	return (
		`<rect class="sheet" x="${left}" y="${top}" width="${right - left}" height="${height}"/>` +
		pen.text(left + 8, top + 14, figure.head[0], "start", "soft") +
		pen.text(right - 8, top + 14, figure.head[1], "end", "soft") +
		path(`M${left} ${top + headHeight}H${right}`, "thin") +
		rows
	);
}

// Where items sit on each outline. Plate screws follow a cross tightening order.
const plateSpots: [number, number][] = [
	[58, 34],
	[142, 82],
	[142, 34],
	[58, 82],
	[100, 34],
	[100, 82],
	[58, 58],
	[142, 58],
];
const carterSpots: [number, number][] = [
	[72, 46],
	[128, 46],
	[100, 76],
	[80, 64],
	[120, 64],
];

export const MAX_POINTS = {
	plate: plateSpots.length,
	carter: carterSpots.length,
};

function points(pen: Pen, figure: Of<"points">): string {
	const count = Number.parseInt(figure.count.value, 10);
	const plate = figure.shape === "plate";
	const outline = plate
		? `<rect class="line" x="44" y="20" width="112" height="76" rx="6"/>`
		: path("M36 26H164L152 96H48Z") + path("M48 34H152L143 88H57Z", "hair");
	const items = (plate ? plateSpots : carterSpots)
		.slice(0, count)
		.map(([x, y], i) => {
			if (figure.mark === "sensor") {
				return (
					`<circle class="fill" cx="${x}" cy="${y}" r="3.5"/>` +
					`<circle class="thin" cx="${x}" cy="${y}" r="7"/>` +
					pen.text(x + 10, y + 4, `T${i + 1}`, "start", "strong")
				);
			}
			const screw =
				`<circle class="line paper" cx="${x}" cy="${y}" r="5.5"/>` +
				path(`M${x - 3} ${y}H${x + 3}M${x} ${y - 3}V${y + 3}`, "thin");
			if (figure.mark === "bolt") return screw;
			// The tightening order, written beside each screw, towards the middle of the plate.
			const side = x < 100 ? 10 : x > 100 ? -10 : 9;
			const anchor: Anchor = x > 100 ? "end" : "start";
			return screw + pen.text(x + side, y + 4, String(i + 1), anchor, "strong");
		})
		.join("");
	return (
		outline +
		spot(figure.count, items) +
		pen.text(100, 113, figure.caption, "middle", "soft")
	);
}

function section(pen: Pen, figure: Of<"section">, id: string): string {
	const hatch = `g-library-hatch-${id}`;
	return (
		`<defs><pattern id="${hatch}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="hair" d="M0 0V6"/></pattern></defs>` +
		`<rect class="edge" x="48" y="18" width="96" height="34" fill="url(#${hatch})"/>` +
		`<rect class="fill" x="48" y="52" width="96" height="8"/>` +
		`<rect class="edge" x="48" y="60" width="96" height="34" fill="url(#${hatch})"/>` +
		pen.text(42, 39, pen.words.hatch, "end", "soft") +
		pen.text(42, 60, pen.words.gasket, "end", "soft") +
		pen.text(42, 81, pen.words.casing, "end", "soft") +
		spot(
			figure.joint,
			path("M146 52H178M146 60H178", "hair") +
				path("M168 38V52M168 60V74", "thin") +
				arrow(168, 52, Math.PI / 2) +
				arrow(168, 60, -Math.PI / 2) +
				pen.text(168, 32, figure.joint.value, "middle", "strong"),
		)
	);
}

function bracket(pen: Pen, figure: Of<"bracket">): string {
	const holes = [62, 138]
		.map(
			(x) =>
				`<circle class="line paper" cx="${x}" cy="58" r="9"/>` +
				path(`M${x} 42V74M${x - 16} 58H${x + 16}`, "axis"),
		)
		.join("");
	// The leader lands on the first hole, up and to the right.
	const tipX = 62 + 9 * Math.cos(-Math.PI / 3);
	const tipY = 58 + 9 * Math.sin(-Math.PI / 3);
	return (
		`<rect class="line" x="24" y="34" width="152" height="48" rx="4"/>` +
		holes +
		spot(
			figure.hole,
			path(`M${r(tipX)} ${r(tipY)}L80 24H134`, "thin") +
				arrow(tipX, tipY, Math.atan2(tipY - 24, tipX - 80)) +
				pen.text(84, 20, figure.hole.value, "start", "strong"),
		) +
		spot(
			figure.spacing,
			path("M62 86V106M138 86V106", "hair") +
				dimension(62, 101, 138, 101) +
				pen.text(100, 96, figure.spacing.value, "middle", "strong"),
		)
	);
}

function curve(pen: Pen, figure: Of<"curve">): string {
	return (
		path("M22 10V100H190") +
		pen.text(26, 12, "°C", "start", "soft") +
		pen.text(190, 113, pen.words.time, "end", "soft") +
		spot(
			figure.limit,
			path("M22 26H190", "thin dash") +
				pen.text(188, 21, pen.words.limit(figure.limit.value), "end", "strong"),
		) +
		// The peak is a node with a horizontal tangent, so it really is the top of the curve.
		path("M22 94C60 92 92 48 112 48S160 56 188 60") +
		spot(
			figure.peak,
			`<circle class="fill" cx="112" cy="48" r="3"/>` +
				path("M112 53V66", "thin") +
				pen.text(106, 78, pen.words.peak(figure.peak.value), "start", "strong"),
		)
	);
}

const tube = (d: string) =>
	`<path class="tube" d="${d}"/><path class="tube-core" d="${d}"/>`;

function bend(pen: Pen, figure: Of<"bend">): string {
	// Centre (86, 46), radius 50: the arrow tip sits on the tube's axis, at 45°.
	const tip = 86 + 50 * Math.SQRT1_2;
	return (
		tube("M18 96H86A50 50 0 0 0 136 46V30") +
		`<rect class="line paper" x="8" y="89" width="12" height="14" rx="1"/>` +
		`<rect class="line paper" x="129" y="20" width="14" height="12" rx="1"/>` +
		spot(
			figure.radius,
			path("M81 46H91M86 41V51", "thin") +
				path(`M86 46L${r(tip - 3.5)} ${r(tip - 40 - 3.5)}`, "thin") +
				arrow(tip, tip - 40, Math.PI / 4) +
				pen.text(84, 32, `R ${figure.radius.value}`, "end", "strong"),
		)
	);
}

function clamps(pen: Pen, figure: Of<"clamps">): string {
	const collars = [48, 112, 176]
		.map(
			(x) =>
				`<rect class="line paper" x="${x - 4}" y="40" width="8" height="20" rx="1"/>` +
				`<rect class="line paper" x="${x - 2}" y="33" width="4" height="7"/>`,
		)
		.join("");
	return (
		tube("M16 50H194") +
		`<rect class="line paper" x="6" y="42" width="12" height="16" rx="1"/>` +
		pen.text(6, 30, pen.words.fitting, "start", "soft") +
		collars +
		spot(
			figure.spacing,
			path("M48 64V90M112 64V90", "hair") +
				dimension(48, 84, 112, 84) +
				pen.text(80, 79, figure.spacing.value, "middle", "strong"),
		)
	);
}

function level(pen: Pen, figure: Of<"level">): string {
	// The callout sits beside the sight glass, so its loop stays inside the drawing.
	return (
		`<rect class="line" x="8" y="18" width="108" height="80" rx="10"/>` +
		`<circle class="line" cx="42" cy="60" r="16"/>` +
		`<circle class="fill" cx="42" cy="60" r="4"/>` +
		pen.text(16, 32, pen.words.gearbox, "start", "soft") +
		spot(
			figure.level,
			`<circle class="line paper" cx="92" cy="62" r="12"/>` +
				`<path class="oil" d="M80 62A12 12 0 0 0 104 62Z"/>` +
				path("M104 62H122", "thin") +
				pen.text(126, 57, pen.words.level, "start", "soft") +
				pen.text(126, 71, figure.level.value, "start", "strong"),
		)
	);
}

function interval(pen: Pen, figure: Of<"interval">): string {
	const every = Number(figure.every.value.replace(/\D/g, ""));
	const ticks = [20, 95, 170];
	const drop = (x: number) =>
		`<path class="soft-fill" d="M${x} 46C${x + 6} 54 ${x + 6} 60 ${x} 60C${x - 6} 60 ${x - 6} 54 ${x} 46Z"/>`;
	return (
		path("M12 72H192") +
		ticks
			.map(
				(x, i) =>
					path(`M${x} 66V78`, "thin") +
					drop(x) +
					pen.text(x, 92, pen.grouped(every * i), "middle"),
			)
			.join("") +
		pen.text(192, 108, "km", "end", "soft") +
		spot(
			figure.every,
			path("M20 26V40M95 26V40", "hair") +
				dimension(20, 32, 95, 32) +
				pen.text(57.5, 24, figure.every.value, "middle", "strong"),
		)
	);
}

/** A description of the figure for screen readers: every value it shows, in words. */
export function figureAlt(figure: Figure, lang: Lang): string {
	const alt = copy[lang].alt;
	switch (figure.kind) {
		case "table":
			return alt.table(
				figure.head[0],
				figure.head[1],
				figure.rows
					.map((row) => alt.row(row.label, row.value))
					.join(alt.rowSeparator),
			);
		case "points":
			return alt[figure.mark](
				figure.caption,
				Number.parseInt(figure.count.value, 10),
			);
		case "section":
			return alt.section(figure.joint.value);
		case "bracket":
			return alt.bracket(figure.hole.value, figure.spacing.value);
		case "curve":
			return alt.curve(figure.peak.value, figure.limit.value);
		case "bend":
			return alt.bend(figure.radius.value);
		case "clamps":
			return alt.clamps(figure.spacing.value);
		case "level":
			return alt.level(figure.level.value);
		case "interval":
			return alt.interval(figure.every.value);
	}
}

function body(pen: Pen, page: Page): string {
	const figure = page.figure;
	switch (figure.kind) {
		case "table":
			return table(pen, figure);
		case "points":
			return points(pen, figure);
		case "section":
			return section(pen, figure, String(page.number));
		case "bracket":
			return bracket(pen, figure);
		case "curve":
			return curve(pen, figure);
		case "bend":
			return bend(pen, figure);
		case "clamps":
			return clamps(pen, figure);
		case "level":
			return level(pen, figure);
		case "interval":
			return interval(pen, figure);
	}
}

/** The whole figure of a page, as an accessible inline SVG, in the language of the page. */
export function renderFigure(page: Page, lang: Lang): string {
	const label = typeset[lang](figureAlt(page.figure, lang));
	return `<svg class="g-library-fig" viewBox="0 0 200 120" role="img" aria-label="${escapeXml(label)}">${body(penFor(lang), page)}</svg>`;
}

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** How far the pencil loop runs outside a box, on each side. */
export function loopPad(box: Box): { x: number; y: number } {
	return { x: 5 + box.width * 0.03, y: 4 + box.height * 0.15 };
}

/**
 * A red-pencil loop around a box: slightly irregular, and it overshoots its start
 * the way a hand closes a circle. A long box gets a squarer loop (a superellipse),
 * so a table row is enclosed without the loop running off the drawing.
 * Returns the path and a spot for the ✓ or ✗ beside it.
 */
export function pencilLoop(
	box: Box,
	seed: number,
): { d: string; tip: { x: number; y: number } } {
	const random = rng(seed);
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const pad = loopPad(box);
	const rx = box.width / 2 + pad.x;
	const ry = box.height / 2 + pad.y;
	const long =
		Math.max(box.width, box.height) /
		Math.max(1, Math.min(box.width, box.height));
	const power = 2 / (2 + Math.min(1.4, (long - 1) * 0.35));
	const bend = (v: number) => Math.sign(v) * Math.abs(v) ** power;
	const start = -2.5 + random() * 0.4;
	const sweep = Math.PI * 2 + 0.5;
	const steps = 48;
	const points: string[] = [];
	for (let i = 0; i <= steps; i++) {
		const angle = start + (sweep * i) / steps;
		const drift = 1 + (i / steps) * 0.04 + (random() - 0.5) * 0.025;
		points.push(
			`${r(cx + bend(Math.cos(angle)) * rx * drift)} ${r(cy + bend(Math.sin(angle)) * ry * drift)}`,
		);
	}
	return {
		d: `M${points.join("L")}`,
		tip: {
			x: Math.min(192, cx + rx * 0.9 + 3),
			y: Math.max(13, cy - ry * 0.9 - 2),
		},
	};
}
