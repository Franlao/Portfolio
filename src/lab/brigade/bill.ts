import type { StationId } from "./stations";

/**
 * The bill: what the visitor tasted during the visit, in the order they tasted it.
 * Orders are all kept; a station appears once, as tasted (its game played) or visited.
 */
export type Tasting =
	| { kind: "order"; label: string }
	| { kind: "visit" | "play"; station: StationId };

export class Bill {
	private readonly items: Tasting[] = [];

	add(tasting: Tasting) {
		if (tasting.kind === "order") {
			if (
				!this.items.some((i) => i.kind === "order" && i.label === tasting.label)
			)
				this.items.push(tasting);
			return;
		}
		const index = this.items.findIndex(
			(i) => i.kind !== "order" && i.station === tasting.station,
		);
		if (index === -1) this.items.push(tasting);
		// Playing a station's game says more than visiting it.
		else if (tasting.kind === "play") this.items[index] = tasting;
	}

	get lines(): readonly Tasting[] {
		return this.items;
	}

	get size(): number {
		return this.items.length;
	}
}
