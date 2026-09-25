export type StationId =
	| "pass"
	| "delivery"
	| "library"
	| "coldroom"
	| "pastry"
	| "tools";

export interface StationDef {
	id: StationId;
	/** Project slug in src/data/projects.ts. Its name and concept live in copy.ts. */
	slug: string;
	/** Where the camera looks when visiting the station. */
	focus: [number, number, number];
	/** Where the floating tag sits. */
	tag: [number, number, number];
	/** Glow ring on the floor. */
	ring: [number, number, number];
}

export const stations: StationDef[] = [
	{
		id: "pass",
		slug: "claims-agent",
		focus: [1.3, 1.2, 2.6],
		tag: [3.4, 3.9, 3.1],
		ring: [1.3, 0, 2.3],
	},
	{
		id: "delivery",
		slug: "clair",
		focus: [-6.6, 1, 3.2],
		tag: [-6.8, 2.9, 3.2],
		ring: [-6.6, 0, 3.2],
	},
	{
		id: "library",
		slug: "multimodal-rag",
		focus: [5.3, 1.4, -4],
		tag: [6.5, 3.3, -4.3],
		ring: [5.3, 0, -3.6],
	},
	{
		id: "coldroom",
		slug: "clinical-extraction",
		focus: [6.2, 1.2, 2.8],
		tag: [6.2, 3.3, 2.8],
		ring: [6.2, 0, 2.8],
	},
	{
		id: "pastry",
		slug: "synthetic-health-data",
		focus: [-3.3, 1, 1.7],
		tag: [-3.3, 2.6, 1.7],
		ring: [-3.3, 0, 1.7],
	},
	{
		id: "tools",
		slug: "llm-tooling",
		focus: [-4.8, 1.4, -4.6],
		tag: [-4.8, 3.4, -4.9],
		ring: [-4.8, 0, -4.2],
	},
];
