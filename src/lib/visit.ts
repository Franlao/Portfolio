/**
 * What the visitor did on La Brigade, kept for the browser session: another page of the
 * site (a project page, the menu) can say what they ordered, and coming back to the
 * kitchen loses nothing. Session storage only: nothing leaves the browser, and it is
 * gone when the tab closes.
 */
const KEY = "brigade.visit";

export type VisitOutcome = "offer" | "missing" | "escalation";

/** One claim of the game at the pass, and what the visitor decided. */
export interface VisitRound {
	id: string;
	choice: VisitOutcome | null;
}

export interface Visit {
	/** The last order's label, as its ticket shows it. */
	order: string | null;
	/** The bill's lines (see lab/brigade/bill.ts), checked when read back. */
	bill: unknown[];
	/** The last game at the pass. */
	rounds: VisitRound[];
}

const empty = (): Visit => ({ order: null, bill: [], rounds: [] });

export function readVisit(): Visit {
	try {
		const raw = window.sessionStorage.getItem(KEY);
		if (!raw) return empty();
		const saved = JSON.parse(raw) as Partial<Visit>;
		return {
			order: typeof saved.order === "string" ? saved.order : null,
			bill: Array.isArray(saved.bill) ? saved.bill : [],
			rounds: Array.isArray(saved.rounds) ? saved.rounds : [],
		};
	} catch {
		// Storage blocked or corrupted: the visit starts afresh.
		return empty();
	}
}

export function saveVisit(patch: Partial<Visit>) {
	try {
		window.sessionStorage.setItem(
			KEY,
			JSON.stringify({ ...readVisit(), ...patch }),
		);
	} catch {
		// Storage blocked: the visit simply is not remembered.
	}
}
