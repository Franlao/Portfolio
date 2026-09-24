import type { StationId } from "../stations";
import type { StationGame } from "./types";

/**
 * One mini-game per station, loaded only when the visitor opens it.
 * The pass has its own game (« Coup de feu au passe », in rush.ts).
 */
export const games: Partial<
	Record<StationId, () => Promise<{ game: StationGame }>>
> = {
	delivery: () => import("./delivery/game"),
	library: () => import("./library/game"),
	coldroom: () => import("./coldroom/game"),
	pastry: () => import("./pastry/game"),
	tools: () => import("./tools/game"),
};
