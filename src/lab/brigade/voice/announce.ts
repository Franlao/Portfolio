import type { Demand } from "../../../lib/offer/engine";
import type { VoiceCopy } from "./copy";

/** Past four skills, a call turns into a list: the ticket says the rest. */
export const CALLED = 4;

/** One shout of the call, and the ticket line it names (none for « Table du chef ! »). */
export interface Call {
	text: string;
	line: number | null;
}

/**
 * The order as the chef calls it to the brigade: the table, then the skills that weigh
 * most. Every shout is a recorded clip of a closed list, so the chef can only say what
 * the code has checked: whatever an offer contains, it cannot put words in his mouth.
 */
export function announcement(
	demand: readonly Demand[],
	call: VoiceCopy["call"],
): Call[] {
	return [
		{ text: call.table, line: null },
		...demand
			.slice(0, CALLED)
			.map((d, line) => ({ text: call.skills[d.competence], line })),
	];
}
