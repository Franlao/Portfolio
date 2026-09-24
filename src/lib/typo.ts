// Written as char codes so the invisible characters stay readable in the source.
const NBSP = String.fromCharCode(0x00a0);
const NARROW_NBSP = String.fromCharCode(0x202f);

/**
 * French typography, so punctuation and numbers never break across lines:
 * a non-breaking space before ":", a narrow one before ; ? ! % and inside guillemets,
 * a narrow one between thousands (15 000), and a non-breaking one before a unit (5 jours, 300 €).
 */
export function frTypo(text: string): string {
	return text
		.replace(/ :/g, `${NBSP}:`)
		.replace(/ ([;?!»%])/g, `${NARROW_NBSP}$1`)
		.replace(/« /g, `«${NARROW_NBSP}`)
		.replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NARROW_NBSP}`)
		.replace(
			/(\d) (€|ms|s|h|jours?|mots|ans|mois|semaines?|minutes?|secondes?)(?!\p{L})/gu,
			`$1${NBSP}$2`,
		);
}

type Typographized<T> = T extends string
	? string
	: T extends (...args: infer A) => infer R
		? (...args: A) => Typographized<R>
		: T extends object
			? { [K in keyof T]: Typographized<T[K]> }
			: T;

/** Applies frTypo to every string, and to the result of every function, in a nested object. */
export function typographize<T>(value: T): Typographized<T> {
	if (typeof value === "string") return frTypo(value) as Typographized<T>;
	if (typeof value === "function") {
		return ((...args: unknown[]) =>
			typographize(value(...args))) as Typographized<T>;
	}
	if (Array.isArray(value)) return value.map(typographize) as Typographized<T>;
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [key, typographize(entry)]),
		) as Typographized<T>;
	}
	return value as Typographized<T>;
}
