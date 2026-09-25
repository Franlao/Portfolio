import { MISTRAL_API_KEY } from "astro:env/server";
import type { APIRoute } from "astro";
import { z } from "zod";
import { countWords, MIN_WORDS } from "../../lib/offer/engine";
import {
	ReadingSchema,
	readingJsonSchema,
	readingPrompt,
} from "../../lib/offer/reader";

/**
 * Reads a job offer with Mistral and returns the model's reading, unverified: the page
 * checks every quote itself, in front of the visitor. The key never leaves the server,
 * and the offer is neither logged nor stored beyond a short in-memory cache.
 */
export const prerender = false;

/** Compared on a real offer: Medium reads the finest, for about a second more than Small. */
const MODEL = "mistral-medium-latest";
/** In development only, another model can be asked for, to compare them on the same offer. */
const TRIAL_MODELS = [
	"mistral-small-latest",
	"mistral-medium-latest",
	"mistral-large-latest",
] as const;
const MAX_CHARACTERS = 20_000;
const TIMEOUT_MS = 12_000;
/** Per visitor, a handful of offers every ten minutes is plenty for a recruiter. */
const LIMIT = { calls: 8, windowMs: 10 * 60_000 };

const Body = z.object({
	text: z.string().min(1).max(MAX_CHARACTERS),
	model: z.enum(TRIAL_MODELS).optional(),
});

// Best effort only: each serverless instance keeps its own memory.
const recent = new Map<string, number[]>();
const cache = new Map<string, z.infer<typeof ReadingSchema>>();

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	});

async function fingerprint(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function allowed(visitor: string, now: number): boolean {
	const calls = (recent.get(visitor) ?? []).filter(
		(time) => now - time < LIMIT.windowMs,
	);
	const ok = calls.length < LIMIT.calls;
	if (ok) calls.push(now);
	if (recent.size > 5_000) recent.clear();
	recent.set(visitor, calls);
	return ok;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	if (!MISTRAL_API_KEY) return json(503, { error: "unavailable" });
	const body = Body.safeParse(await request.json().catch(() => null));
	if (!body.success) return json(400, { error: "invalid" });
	const text = body.data.text;
	const model = (import.meta.env.DEV && body.data.model) || MODEL;
	if (countWords(text) < MIN_WORDS) return json(400, { error: "too-short" });

	const key = await fingerprint(`${model}|${text}`);
	const cached = cache.get(key);
	if (cached) return json(200, { reading: cached, model });
	const visitor =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		clientAddress;
	if (!allowed(visitor, Date.now())) return json(429, { error: "busy" });

	let response: Response;
	try {
		response = await fetch("https://api.mistral.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				authorization: `Bearer ${MISTRAL_API_KEY}`,
			},
			body: JSON.stringify({
				model,
				temperature: 0,
				max_tokens: 2_000,
				messages: [
					{ role: "system", content: readingPrompt() },
					{ role: "user", content: text },
				],
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "reading",
						strict: true,
						schema: readingJsonSchema,
					},
				},
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		return json(504, { error: "timeout" });
	}
	if (!response.ok) return json(502, { error: "model" });

	const payload = (await response.json().catch(() => null)) as {
		choices?: { message?: { content?: unknown } }[];
	} | null;
	const content = payload?.choices?.[0]?.message?.content;
	let reading: z.infer<typeof ReadingSchema>;
	try {
		reading = ReadingSchema.parse(
			JSON.parse(typeof content === "string" ? content : ""),
		);
	} catch {
		return json(502, { error: "shape" });
	}
	if (cache.size > 200) cache.clear();
	cache.set(key, reading);
	return json(200, { reading, model });
};
