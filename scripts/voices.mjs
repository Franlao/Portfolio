/**
 * Records La Brigade's voices with Voxtral (Mistral), then checks every take the way the
 * site checks the model's reading of an offer: a speech-to-text model transcribes it back,
 * and only a take that says what the script says is kept.
 *
 * Writes public/voices/<lang>/ (the clips and manifest.json, which the page reads) and
 * src/lab/brigade/voice/voices.lock.json (which voice said each line, and what the check
 * heard). Only new or changed lines are recorded.
 *
 *   npm run voices                  record what changed
 *   npm run voices -- --dry         list what would be recorded, and the cost
 *   npm run voices -- --lang fr     one language
 *   npm run voices -- --force       record everything again
 *   npm run voices -- --retry       record again the lines the check refused
 *
 * Needs MISTRAL_API_KEY (in .env) and ffmpeg on the PATH, and ELEVENLABS_API_KEY for
 * the roles cast from ElevenLabs.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const API = "https://api.mistral.ai/v1";
/** Voxtral TTS, in dollars per 1,000 characters. */
const PRICE = 0.016;
const PARALLEL = 4;
/** Each take gets this many tries before the next take in the cast is tried. */
const TRIES = 3;

const args = process.argv.slice(2);
const option = (name) =>
	args.includes(name) ? args[args.indexOf(name) + 1] : null;
const dry = args.includes("--dry");
const force = args.includes("--force");
const retry = args.includes("--retry");
const langs = option("--lang") ? [option("--lang")] : ["fr", "en"];

const root = process.cwd();
const bundle = join(root, "node_modules/.cache/voice-recording.mjs");
await build({
	entryPoints: [join(root, "src/lab/brigade/voice/recording.ts")],
	bundle: true,
	platform: "node",
	format: "esm",
	outfile: bundle,
	logLevel: "warning",
});
const {
	script,
	cast,
	DESIGNED,
	ELEVENLABS_MODEL,
	lineKey,
	heardAs,
	passes,
	TTS_MODEL,
	STT_MODEL,
	ENVELOPE_STEP,
} = await import(`${pathToFileURL(bundle).href}?${Date.now()}`);

const key = process.env.MISTRAL_API_KEY;
if (!dry && !key) {
	console.error("MISTRAL_API_KEY is missing: add it to .env.");
	process.exit(1);
}

const LOCK = join(root, "src/lab/brigade/voice/voices.lock.json");
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : {};
const hash = (value) => createHash("sha1").update(value).digest("hex");

/** fetch, tried again while the service is busy. */
async function request(url, init, attempt = 0) {
	const res = await fetch(url, init);
	if ((res.status === 429 || res.status >= 500) && attempt < 4) {
		await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
		return request(url, init, attempt + 1);
	}
	if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
	return res;
}

async function call(path, init) {
	const res = await request(`${API}${path}`, {
		...init,
		headers: { Authorization: `Bearer ${key}`, ...init.headers },
	});
	return res.json();
}

/** ElevenLabs, for the voices Mistral does not have. */
async function speakElevenLabs(text, voice) {
	const elevenKey = process.env.ELEVENLABS_API_KEY;
	if (!elevenKey)
		throw new Error("ELEVENLABS_API_KEY is missing: add it to .env.");
	const res = await request(
		`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
		{
			method: "POST",
			headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
			body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL }),
		},
	);
	return Buffer.from(await res.arrayBuffer());
}

/** A take's raw recording, from Voxtral or ElevenLabs. */
const voiced = (text, take) =>
	take.engine === "elevenlabs"
		? speakElevenLabs(text, take.voice)
		: speak(text, take.voice);

async function speak(text, voice) {
	const data = await call("/audio/speech", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: TTS_MODEL,
			input: text,
			voice_id: voice,
			response_format: "mp3",
		}),
	});
	return Buffer.from(data.audio_data, "base64");
}

async function transcribe(mp3) {
	const form = new FormData();
	form.append("model", STT_MODEL);
	form.append("file", new Blob([mp3], { type: "audio/mpeg" }), "take.mp3");
	const data = await call("/audio/transcriptions", {
		method: "POST",
		body: form,
	});
	return (data.text ?? "").trim();
}

function ffmpeg(input, argv) {
	const run = spawnSync(
		"ffmpeg",
		["-hide_banner", "-loglevel", "error", "-i", "pipe:0", ...argv, "pipe:1"],
		{ input, maxBuffer: 64 * 1024 * 1024 },
	);
	if (run.status !== 0) throw new Error(`ffmpeg: ${run.stderr.toString()}`);
	return run.stdout;
}

/** Silences trimmed, a pitch for the passers-by, the same loudness for everyone. */
function master(mp3, pitch) {
	const trim = "silenceremove=start_periods=1:start_threshold=-50dB";
	const filters = [
		trim,
		"areverse",
		trim,
		"afade=t=in:d=0.03",
		"areverse",
		"afade=t=in:d=0.01",
		...(pitch ? [`rubberband=pitch=${(2 ** (pitch / 12)).toFixed(4)}`] : []),
		"loudnorm=I=-18:TP=-2:LRA=11",
	];
	return ffmpeg(mp3, [
		"-af",
		filters.join(","),
		"-ar",
		"24000",
		"-ac",
		"1",
		"-c:a",
		"libmp3lame",
		"-b:a",
		"48k",
		"-f",
		"mp3",
	]);
}

/** The clip's length, and its loudness every ENVELOPE_STEP seconds as digits 0 to 9. */
function envelope(mp3) {
	const rate = 8000;
	const pcm = ffmpeg(mp3, ["-f", "f32le", "-ac", "1", "-ar", String(rate)]);
	const samples = new Float32Array(
		pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length),
	);
	const step = Math.round(ENVELOPE_STEP * rate);
	let env = "";
	for (let i = 0; i < samples.length; i += step) {
		let sum = 0;
		const end = Math.min(samples.length, i + step);
		for (let j = i; j < end; j++) sum += samples[j] * samples[j];
		const rms = Math.sqrt(sum / Math.max(1, end - i));
		env += Math.min(9, Math.round(Math.min(1, rms / 0.2) ** 0.7 * 9));
	}
	return { seconds: Number((samples.length / rate).toFixed(2)), env };
}

async function record(lang, item) {
	const { line, said, takes } = item;
	let best = null;
	search: for (const take of takes) {
		for (let attempt = 0; attempt < TRIES; attempt++) {
			const mp3 = master(await voiced(said, take), take.pitch ?? 0);
			const heard = await transcribe(mp3);
			const score = heardAs(said, heard, lang);
			if (!best || score > best.score) best = { mp3, heard, score, take };
			if (passes(said, heard, lang)) break search;
		}
	}
	const file = `${line.speaker}-${hash(best.mp3).slice(0, 10)}.mp3`;
	writeFileSync(join(root, "public/voices", lang, file), best.mp3);
	return {
		file,
		...envelope(best.mp3),
		source: item.source,
		...(best.take.engine && { engine: best.take.engine }),
		voice: best.take.voice,
		pitch: best.take.pitch ?? 0,
		heard: best.heard,
		score: Number(best.score.toFixed(3)),
		passed: passes(said, best.heard, lang),
	};
}

async function pool(items, size, work) {
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			await work(items[index], index);
		}
	};
	await Promise.all(Array.from({ length: size }, worker));
}

const sorted = (object) =>
	Object.fromEntries(
		Object.entries(object).sort(([a], [b]) => a.localeCompare(b)),
	);

/**
 * The designed voices (see DESIGNED in cast.ts), created in the Mistral account when
 * missing: Voxtral clones a preset reading the reference text, pitched by ffmpeg, or a
 * recording whose path is in the environment. Returns their ids by name.
 */
async function designVoices() {
	lock.designed ??= {};
	const ids = {};
	for (const [name, recipe] of Object.entries(DESIGNED)) {
		const known = lock.designed[name];
		const alive = async () =>
			(
				await fetch(`${API}/audio/voices/${known.id}`, {
					headers: { Authorization: `Bearer ${key}` },
				})
			).ok;
		const path = recipe.env && process.env[recipe.env];
		const recording = path && existsSync(path) ? readFileSync(path) : null;
		if (recipe.env && !recording) {
			// The recording is only needed to create the voice.
			if (known?.env === recipe.env && (await alive())) {
				ids[name] = known.id;
				continue;
			}
			throw new Error(
				`${name}: set ${recipe.env} in .env to the path of the recording.`,
			);
		}
		const source = hash(recording ?? JSON.stringify(recipe)).slice(0, 12);
		if (known?.source === source && (await alive())) {
			ids[name] = known.id;
			continue;
		}
		const trim = "silenceremove=start_periods=1:start_threshold=-50dB";
		const reference = recording
			? ffmpeg(recording, [
					"-af",
					`${trim},areverse,${trim},areverse,loudnorm=I=-18:TP=-2:LRA=11`,
					"-ac",
					"1",
					"-ar",
					"24000",
					"-c:a",
					"libmp3lame",
					"-b:a",
					"128k",
					"-f",
					"mp3",
				])
			: ffmpeg(await speak(recipe.text, recipe.from), [
					"-af",
					`rubberband=pitch=${(2 ** (recipe.pitch / 12)).toFixed(4)}`,
					"-c:a",
					"libmp3lame",
					"-b:a",
					"96k",
					"-f",
					"mp3",
				]);
		const voice = await call("/audio/voices", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name,
				sample_audio: reference.toString("base64"),
				sample_filename: `${name}.mp3`,
				languages: ["fr", "en"],
				gender: "male",
			}),
		});
		lock.designed[name] = {
			id: voice.id,
			source,
			...(recipe.env && { env: recipe.env }),
		};
		ids[name] = voice.id;
		console.log(`designed voice ${name}: ${voice.id}`);
	}
	return ids;
}
const designed = dry
	? Object.fromEntries(Object.keys(DESIGNED).map((name) => [name, name]))
	: await designVoices();
/** A take's voice: a preset's id, or a designed voice's id in this account. */
const voiceOf = (take) => designed[take.voice] ?? take.voice;

let characters = 0;
/** ElevenLabs bills a credit per character, from the plan's monthly credits. */
let credits = 0;
for (const lang of langs) {
	const dir = join(root, "public/voices", lang);
	mkdirSync(dir, { recursive: true });
	const previous = lock[lang] ?? {};
	const entries = {};
	const todo = [];
	for (const line of script(lang)) {
		const k = lineKey(line.speaker, line.text);
		const takes = cast[lang][line.speaker][line.mood].map((take) => ({
			...take,
			voice: voiceOf(take),
			...(take.engine === "elevenlabs" && { model: ELEVENLABS_MODEL }),
		}));
		const said = line.say ?? line.text;
		const source = hash(
			JSON.stringify({ model: TTS_MODEL, said, takes }),
		).slice(0, 12);
		const old = previous[k];
		const keep =
			!force &&
			!(retry && old && !old.passed) &&
			old?.source === source &&
			existsSync(join(dir, old.file));
		if (keep) {
			entries[k] = old;
			continue;
		}
		todo.push({ key: k, line, said, takes, source });
	}
	const count = (engine) =>
		todo
			.filter((item) => item.takes[0].engine === engine)
			.reduce((n, item) => n + item.said.length, 0);
	const chars = count(undefined);
	const eleven = count("elevenlabs");
	characters += chars;
	credits += eleven;
	console.log(
		`${lang}: ${todo.length} to record, ${Object.keys(entries).length} kept (${chars} characters${eleven ? `, ${eleven} ElevenLabs credits` : ""})`,
	);
	if (dry) {
		for (const item of todo) console.log(`  ${item.key}`);
		continue;
	}
	let done = 0;
	await pool(todo, PARALLEL, async (item) => {
		entries[item.key] = await record(lang, item);
		done++;
		const entry = entries[item.key];
		console.log(
			`  ${done}/${todo.length} ${entry.passed ? "ok " : "!! "} ${item.key}${entry.passed ? "" : `  heard: « ${entry.heard} »`}`,
		);
	});
	// Clips no line uses any more.
	const used = new Set(Object.values(entries).map((entry) => entry.file));
	for (const file of readdirSync(dir))
		if (file.endsWith(".mp3") && !used.has(file)) unlinkSync(join(dir, file));
	lock[lang] = sorted(entries);
	const manifest = Object.fromEntries(
		Object.entries(lock[lang]).map(([k, entry]) => [
			k,
			{ file: entry.file, seconds: entry.seconds, env: entry.env },
		]),
	);
	writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest)}\n`);
	writeFileSync(LOCK, `${JSON.stringify(sorted(lock), null, "\t")}\n`);
	const failed = Object.entries(lock[lang]).filter(
		([, entry]) => !entry.passed,
	);
	if (failed.length)
		console.log(
			`${lang}: ${failed.length} line(s) kept although the check heard something else: listen to them.`,
		);
}
console.log(
	`${dry ? "Would cost" : "Cost"} about $${((characters / 1000) * PRICE).toFixed(3)} (${characters} characters, plus the checks)${credits ? `, and ${credits} ElevenLabs credits` : ""}.`,
);
