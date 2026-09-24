import {
	type Crate,
	crates,
	initialPieces,
	type Piece,
	type Shelf,
	type ShelfId,
	shelves,
} from "./data";

/**
 * « La réserve qui se range seule » : the pure logic, no DOM.
 * A claims file is a small tree: one file summary on top, one summary per shelf, then the pieces.
 * Filing a new piece rewrites only the summaries on its path to the top (its shelf, then the file);
 * a full reindex would rewrite every summary of the tree. The summaries are composed from
 * pre-written fragments, so the result is the same whichever way it is computed.
 */

export const DELIVERIES = 7;
export const CHECKS = 3;

/** A node that carries a summary: a shelf, or the whole file at the top. */
export type NodeId = ShelfId | "file";

export interface Placement {
	piece: Piece;
	/** Where the visitor put it, which may not be where it belongs. */
	shelf: ShelfId;
}

export interface Reserve {
	placements: Placement[];
	summaries: Record<NodeId, string>;
}

export interface Filing {
	crate: Crate;
	shelf: ShelfId;
	right: boolean;
	/** Summaries rewritten by the incremental update, from the shelf up to the file. */
	rewritten: NodeId[];
	/** Summaries a full reindex would have rewritten instead. */
	fullCost: number;
}

/** Seeded generator (mulberry32), so a game can be replayed and tested. */
export function seeded(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], random: () => number): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Picks the deliveries of a game: every shelf gets at least one crate, in a random order. */
export function deal(random: () => number, count = DELIVERIES): Crate[] {
	const pool = shuffle(crates, random);
	const picked = shelves.map(
		(shelf) => pool.find((crate) => crate.shelf === shelf.id) as Crate,
	);
	const rest = pool.filter((crate) => !picked.includes(crate));
	return shuffle(
		[...picked, ...rest.slice(0, Math.max(0, count - picked.length))],
		random,
	);
}

export function shelfById(id: ShelfId): Shelf {
	return shelves.find((shelf) => shelf.id === id) as Shelf;
}

export function onShelf(placements: Placement[], id: ShelfId): Piece[] {
	return placements.filter((p) => p.shelf === id).map((p) => p.piece);
}

const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1);

/** Keep summaries short: past three pieces, the oldest ones are only counted. */
const KEEP = 3;

/** What the model writes for a shelf, from the pieces actually on it. */
export function shelfSummary(placements: Placement[], id: ShelfId): string {
	const gists = onShelf(placements, id).map((piece) => piece.gist);
	if (gists.length === 0) return shelfById(id).emptyGist;
	const older = gists.length - KEEP;
	const text = `${capitalize(gists.slice(-KEEP).join(" ; "))}.`;
	if (older <= 0) return text;
	const s = older > 1 ? "s" : "";
	return `${text} Et ${older} pièce${s} plus ancienne${s}.`;
}

/** The summary of summaries: one line per shelf. */
export function fileSummary(placements: Placement[]): string {
	return shelves
		.map((shelf) => {
			const briefs = onShelf(placements, shelf.id).map((piece) => piece.brief);
			const line =
				briefs.length === 0
					? shelf.emptyBrief
					: briefs.length > KEEP
						? `${briefs.length} pièces, dont ${briefs.slice(-2).join(", ")}`
						: briefs.join(", ");
			return `${shelf.name} : ${line}.`;
		})
		.join("\n");
}

/** Rewrites every summary of the tree: what a full reindex does. */
export function fullReindex(placements: Placement[]): Record<NodeId, string> {
	const summaries = { file: fileSummary(placements) } as Record<NodeId, string>;
	for (const shelf of shelves) {
		summaries[shelf.id] = shelfSummary(placements, shelf.id);
	}
	return summaries;
}

/** Every summary of the tree: one per shelf, plus the file. */
export const SUMMARY_NODES = shelves.length + 1;

/** The nodes above a leaf, bottom first. */
export function pathToTop(shelf: ShelfId): NodeId[] {
	return [shelf, "file"];
}

export function initialReserve(): Reserve {
	const placements = initialPieces.map((piece) => ({
		piece,
		shelf: piece.shelf,
	}));
	return { placements, summaries: fullReindex(placements) };
}

/** Files a crate on a shelf and rewrites only the summaries on its path. */
export function file(
	reserve: Reserve,
	crate: Crate,
	shelf: ShelfId,
): { reserve: Reserve; filing: Filing } {
	const placements = [...reserve.placements, { piece: crate, shelf }];
	const rewritten = pathToTop(shelf);
	const summaries = { ...reserve.summaries };
	for (const node of rewritten) {
		summaries[node] =
			node === "file"
				? fileSummary(placements)
				: shelfSummary(placements, node);
	}
	return {
		reserve: { placements, summaries },
		filing: {
			crate,
			shelf,
			right: crate.shelf === shelf,
			rewritten,
			fullCost: SUMMARY_NODES,
		},
	};
}

export function tally(filings: Filing[]) {
	return {
		full: filings.reduce((sum, f) => sum + f.fullCost, 0),
		incremental: filings.reduce((sum, f) => sum + f.rewritten.length, 0),
	};
}

export const NOT_FOUND = "Je ne trouve pas cette information dans le dossier.";

export interface Check {
	crate: Crate;
	/** The shelf the question leads to, through the summaries. */
	target: ShelfId;
	/** Where the answering piece actually sits. */
	placedIn: ShelfId;
	found: boolean;
	reply: string;
}

/**
 * The control questions, one per delivered crate. Misfiled crates are asked first:
 * they are the ones that show what a badly kept index costs.
 */
export function control(
	reserve: Reserve,
	filings: Filing[],
	count = CHECKS,
): Check[] {
	const ordered = [
		...filings.filter((f) => !f.right),
		...filings.filter((f) => f.right),
	];
	return ordered.slice(0, count).map(({ crate, shelf }) => {
		// The search follows the summaries down to the shelf that matches the question,
		// then only reads the pieces on that shelf.
		const target = crate.shelf;
		const found = onShelf(reserve.placements, target).includes(crate);
		return {
			crate,
			target,
			placedIn: shelf,
			found,
			reply: found ? crate.answer : NOT_FOUND,
		};
	});
}

export function score(filings: Filing[], checks: Check[]) {
	return {
		filed: filings.filter((f) => f.right).length,
		total: filings.length,
		found: checks.filter((c) => c.found).length,
		asked: checks.length,
		...tally(filings),
	};
}
