import * as THREE from "three";
import type { Lang } from "../../../i18n/ui";
import type { Sound } from "../sound";
import {
	type Clip,
	ENVELOPE_STEP,
	lineKey,
	type Manifest,
	type Speaker,
} from "./speakers";

/**
 * Where a voice sits in the mix, as in a film:
 * - « room »: in the kitchen, from where the character stands, with the room's echo;
 * - « aside »: the chef leaning towards the visitor at his table: centred, close and dry;
 * - « street »: outside, softened by the distance and the buildings.
 */
export type Plan = "room" | "aside" | "street";

export interface SayOptions {
	/** The character: the voice follows them across the screen. */
	from?: THREE.Object3D;
	plan?: Plan;
	/** 1 by default; the street's murmurs are lower. */
	gain?: number;
	/** When the voice starts: the clip, for its length. */
	onStart?: (clip: Clip) => void;
}

interface Line {
	speaker: Speaker;
	text: string;
	from?: THREE.Object3D;
}

interface Voice {
	speaker: Speaker;
	clip: Clip;
	source: AudioBufferSourceNode;
	pan: StereoPannerNode;
	from?: THREE.Object3D;
	/** Audio-clock time at which the clip starts. */
	start: number;
	ducks: boolean;
	/** Cut short: someone else spoke, or the sound went off. */
	stopped?: boolean;
}

/** A first clip may take a moment to arrive; past this, the line goes unsaid. */
const PATIENCE_MS = 900;
const WET: Record<Plan, number> = { room: 0.16, aside: 0, street: 0.3 };

/** An impulse response made of decaying noise: a small room, or the street between buildings. */
function echo(ctx: AudioContext, seconds: number, brightness: number) {
	const length = Math.ceil(ctx.sampleRate * seconds);
	const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
	for (let channel = 0; channel < 2; channel++) {
		const data = buffer.getChannelData(channel);
		let last = 0;
		for (let i = 0; i < length; i++) {
			// Low-passed noise, fading out exponentially.
			last += brightness * (Math.random() * 2 - 1 - last);
			data[i] = last * (1 - i / length) ** 3;
		}
	}
	const convolver = ctx.createConvolver();
	convolver.buffer = buffer;
	return convolver;
}

/**
 * The voices of La Brigade: recorded clips (see scripts/voices.mjs), fetched only once
 * the visitor turns the sound on. A line with no clip stays silent: its bubble still
 * shows, so nothing is lost with the sound off.
 */
export class Voices {
	private manifest: Promise<Manifest | null> | null = null;
	private buffers = new Map<string, Promise<AudioBuffer | null>>();
	private voices = new Set<Voice>();
	private wanted: Line[] = [];
	private sends: Record<Exclude<Plan, "aside">, AudioNode> | null = null;
	private readonly point = new THREE.Vector3();

	constructor(
		private readonly sound: Sound,
		private readonly lang: Lang,
		/** Where a point of the scene lands on screen, from -1 (left) to 1 (right). */
		private readonly screenX: (point: THREE.Vector3) => number,
	) {
		sound.onChange((on) => {
			if (on) void this.warmUp();
			// Turned off mid-sentence: the voice stops under the master's fade, not dead.
			else this.stop(undefined, 0.1);
		});
	}

	/** Clips to fetch ahead of time, as soon as the sound is on. */
	preload(lines: Line[]) {
		this.wanted.push(...lines);
		if (this.sound.enabled) void this.warmUp();
	}

	/** Says a line. Resolves with true once said, false when it stays silent. */
	async say(
		speaker: Speaker,
		text: string,
		options: SayOptions = {},
	): Promise<boolean> {
		const ready = await this.ready([{ speaker, text, from: options.from }]);
		if (!ready) return false;
		const [{ clip, buffer }] = ready;
		// A character says one thing at a time.
		this.stop(speaker);
		const ctx = this.sound.context;
		if (!ctx) return false;
		const voice = this.play(
			{ speaker, text, from: options.from },
			clip,
			buffer,
			ctx.currentTime + 0.02,
			options,
		);
		options.onStart?.(clip);
		return this.ended(voice);
	}

	/**
	 * Lines said one after the other, on the audio clock: no gap but the one asked for,
	 * as a chef calls an order. `onEach` runs as each line starts.
	 */
	async sequence(
		lines: Line[],
		options: SayOptions & {
			gap?: number;
			onEach?: (index: number) => void;
		} = {},
	): Promise<boolean> {
		const ready = await this.ready(lines);
		const ctx = this.sound.context;
		if (!ready || !ctx) return false;
		for (const line of lines) this.stop(line.speaker);
		let at = ctx.currentTime + 0.05;
		const voices = ready.map(({ clip, buffer }, index) => {
			const voice = this.play(lines[index], clip, buffer, at, options);
			const delay = Math.max(0, (at - ctx.currentTime) * 1000);
			window.setTimeout(() => {
				if (this.voices.has(voice)) options.onEach?.(index);
			}, delay);
			at += buffer.duration + (options.gap ?? 0.15);
			return voice;
		});
		const said = await Promise.all(voices.map((voice) => this.ended(voice)));
		return said.every(Boolean);
	}

	/** Silences one character, or everyone, now or `after` a few seconds. */
	stop(speaker?: Speaker, after = 0) {
		const at = (this.sound.context?.currentTime ?? 0) + after;
		for (const voice of [...this.voices]) {
			if (speaker && voice.speaker !== speaker) continue;
			voice.stopped = true;
			try {
				voice.source.stop(at);
			} catch {
				// Not started yet: stopping it before its time is fine too.
			}
		}
	}

	/** How loud a character is speaking right now, from 0 to 1: heads and balloons follow it. */
	level(speaker: Speaker): number {
		const ctx = this.sound.context;
		if (!ctx) return 0;
		for (const voice of this.voices) {
			if (voice.speaker !== speaker) continue;
			const index = Math.floor((ctx.currentTime - voice.start) / ENVELOPE_STEP);
			const digit = voice.clip.env[index];
			if (digit !== undefined) return Number(digit) / 9;
		}
		return 0;
	}

	/** Whether anyone is speaking. */
	get speaking(): boolean {
		return this.voices.size > 0;
	}

	/** Voices follow their characters across the screen. Call on every frame. */
	update() {
		const ctx = this.sound.context;
		if (!ctx) return;
		for (const voice of this.voices) {
			if (!voice.from) continue;
			voice.from.getWorldPosition(this.point);
			const x = THREE.MathUtils.clamp(this.screenX(this.point), -1, 1);
			voice.pan.pan.setTargetAtTime(x * 0.75, ctx.currentTime, 0.08);
		}
	}

	private play(
		line: Line,
		clip: Clip,
		buffer: AudioBuffer,
		at: number,
		options: SayOptions,
	): Voice {
		const ctx = this.sound.context as AudioContext;
		const out = this.sound.bus("voice") as GainNode;
		const plan = options.plan ?? "room";
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const pan = ctx.createStereoPanner();
		if (line.from) {
			line.from.getWorldPosition(this.point);
			pan.pan.value =
				plan === "aside"
					? 0
					: THREE.MathUtils.clamp(this.screenX(this.point), -1, 1) * 0.75;
		}
		const gain = ctx.createGain();
		gain.gain.value = options.gain ?? 1;
		let chain: AudioNode = source;
		if (plan === "street") {
			const far = ctx.createBiquadFilter();
			far.type = "lowpass";
			far.frequency.value = 3200;
			chain = chain.connect(far);
		}
		chain.connect(gain);
		// An aside stays in the middle; the others follow their character.
		if (plan === "aside") gain.connect(out);
		else gain.connect(pan).connect(out);
		const sends = this.echoes(ctx, out);
		if (plan !== "aside" && sends) {
			const wet = ctx.createGain();
			wet.gain.value = WET[plan];
			gain.connect(wet).connect(sends[plan]);
		}
		const voice: Voice = {
			speaker: line.speaker,
			clip,
			source,
			pan,
			from: plan === "aside" ? undefined : line.from,
			start: at,
			// The murmurs of the street never push the room down.
			ducks: plan !== "street",
		};
		this.voices.add(voice);
		if (voice.ducks) this.sound.duck(true);
		source.start(at);
		return voice;
	}

	private ended(voice: Voice): Promise<boolean> {
		return new Promise((resolve) => {
			voice.source.addEventListener("ended", () => {
				if (this.voices.delete(voice) && voice.ducks) this.sound.duck(false);
				resolve(!voice.stopped);
			});
		});
	}

	private echoes(ctx: AudioContext, out: AudioNode) {
		if (!this.sends) {
			const room = echo(ctx, 0.7, 0.35);
			const street = echo(ctx, 1.4, 0.12);
			room.connect(out);
			street.connect(out);
			this.sends = { room, street };
		}
		return this.sends;
	}

	/** Every clip of these lines, decoded; null if one is missing or too slow to come. */
	private async ready(
		lines: Line[],
	): Promise<{ clip: Clip; buffer: AudioBuffer }[] | null> {
		if (!this.sound.enabled) return null;
		const manifest = await this.loadManifest();
		const clips = lines.map(
			(line) => manifest?.[lineKey(line.speaker, line.text)],
		);
		if (clips.some((clip) => !clip)) return null;
		const late = new Promise<null>((resolve) =>
			window.setTimeout(() => resolve(null), PATIENCE_MS),
		);
		const buffers = await Promise.race([
			Promise.all(clips.map((clip) => this.buffer(clip as Clip))),
			late,
		]);
		if (!buffers || buffers.some((buffer) => !buffer) || !this.sound.enabled)
			return null;
		return clips.map((clip, i) => ({
			clip: clip as Clip,
			buffer: buffers[i] as AudioBuffer,
		}));
	}

	private loadManifest(): Promise<Manifest | null> {
		this.manifest ??= fetch(`/voices/${this.lang}/manifest.json`)
			.then((res) => (res.ok ? (res.json() as Promise<Manifest>) : null))
			.catch(() => null);
		return this.manifest;
	}

	private buffer(clip: Clip): Promise<AudioBuffer | null> {
		let buffer = this.buffers.get(clip.file);
		if (!buffer) {
			const ctx = this.sound.context;
			buffer = !ctx
				? Promise.resolve(null)
				: fetch(`/voices/${this.lang}/${clip.file}`)
						.then((res) => res.arrayBuffer())
						.then((data) => ctx.decodeAudioData(data))
						.catch(() => null);
			this.buffers.set(clip.file, buffer);
		}
		return buffer;
	}

	private async warmUp() {
		const manifest = await this.loadManifest();
		if (!manifest) return;
		for (const line of this.wanted) {
			const clip = manifest[lineKey(line.speaker, line.text)];
			if (clip) void this.buffer(clip);
		}
	}
}
