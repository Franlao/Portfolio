import { useId } from "react";
import { getTranslations, type Lang } from "../../i18n/ui";
import {
	sketchCheck,
	sketchCross,
	sketchLine,
	sketchRect,
	sketchWave,
} from "../../lib/sketch";
import "./sketch.css";

function Paths({ paths }: { paths: string[] }) {
	return (
		<>
			{paths.map((d, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: paths are a fixed drawing
				<path key={i} d={d} />
			))}
		</>
	);
}

/** Red pencil tick: a check that passed. */
export function CheckMark({
	seed = 3,
	label,
}: {
	seed?: number;
	label?: string;
}) {
	return (
		<svg
			className="sketch sketch-check"
			viewBox="0 0 17 16"
			width="17"
			height="16"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<Paths paths={sketchCheck(seed)} />
		</svg>
	);
}

/** Red pencil cross: a check that failed. */
export function CrossMark({
	seed = 5,
	label,
}: {
	seed?: number;
	label?: string;
}) {
	return (
		<svg
			className="sketch sketch-check"
			viewBox="0 0 16 16"
			width="16"
			height="16"
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<Paths paths={sketchCross(seed)} />
		</svg>
	);
}

/** Ruled graphite line: deterministic code. */
export function RuledSample() {
	return (
		<svg
			className="sketch sketch-code"
			viewBox="0 0 40 12"
			width="40"
			height="12"
			aria-hidden="true"
		>
			<line x1="1" y1="6" x2="39" y2="6" />
		</svg>
	);
}

/** Freehand blue line: a model step. */
export function FreehandSample({ seed = 7 }: { seed?: number }) {
	return (
		<svg
			className="sketch sketch-model"
			viewBox="0 0 40 12"
			width="40"
			height="12"
			aria-hidden="true"
		>
			<Paths paths={sketchWave(38, seed)} />
		</svg>
	);
}

/** Freehand frame around a model step, drawn at a fixed size and stretched to fit. */
export function FreehandFrame({
	width,
	height,
	seed,
}: {
	width: number;
	height: number;
	seed: number;
}) {
	return (
		<svg
			className="sketch sketch-model sketch-frame"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<Paths paths={sketchRect(width, height, seed)} />
		</svg>
	);
}

/** Red pencil bar whose length shows a share between 0 and 1. */
export function ShareBar({ value, seed }: { value: number; seed: number }) {
	const length = Math.max(2, Math.round(value * 118));
	return (
		<svg
			className="sketch sketch-bar"
			viewBox="0 0 120 10"
			width="120"
			height="10"
			aria-hidden="true"
		>
			<line className="sketch-bar-track" x1="1" y1="5" x2="119" y2="5" />
			<Paths paths={sketchLine(1, 5, length, 5, seed)} />
		</svg>
	);
}

export function Legend({
	lang,
	className = "",
}: {
	lang: Lang;
	className?: string;
}) {
	const t = getTranslations(lang);
	const titleId = useId();
	return (
		<aside className={`legend ${className}`} aria-labelledby={titleId}>
			<h2 className="legend-title" id={titleId}>
				{t("legend.title")}
			</h2>
			<ul className="legend-list">
				<li>
					<RuledSample />
					<span>{t("legend.code")}</span>
				</li>
				<li>
					<FreehandSample />
					<span>{t("legend.model")}</span>
				</li>
				<li>
					<CheckMark seed={11} />
					<span>{t("legend.check")}</span>
				</li>
			</ul>
		</aside>
	);
}
