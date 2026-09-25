/**
 * The scene's continuous sounds, synthesized: the street at night before the house opens,
 * the kitchen after, and the foley of the arrival (the taxi, its doors, the restaurant's
 * door). Noise is generated once and looped; everything else is native nodes and scheduled
 * automation, so no JavaScript runs per sample. Every gain moves along a ramp: nothing
 * clicks, not even a bed cut short.
 */
export type SoundScene = "street" | "kitchen";
export type NoiseColor = "white" | "pink" | "brown";

/**
 * Levels at the ambience bus (gain 1), linear. The beds sit around -40 dBFS RMS and no
 * event peaks much above -24 dBFS: the room is a bed for the voices, not a soloist.
 * Noise buffers have unit RMS; the comments give the level once filtered, measured
 * by running the same noise through the same biquads offline.
 */
const LEVEL = {
	/** City rumble: -40 dBFS RMS (peaks -29), swelling by +3 / -5 dB. */
	rumble: 0.0125,
	/** The river: each side -45 dBFS RMS, breathing by ±3 dB. */
	river: 0.012,
	/** A wave against the quay: up to -44 dBFS RMS. */
	lap: 0.018,
	/** A far car at its closest: -37 dBFS RMS (peaks -26) for the loudest ones. */
	car: 0.045,
	/** Glass and cutlery on the café terrace: peaks -40 dBFS at most. */
	terrace: 0.01,
	/** Fourvière's bell: -42 dBFS RMS at the stroke, -30 if every partial peaked at once. */
	bell: 0.03,
	/** The kitchen hum, as before: -48 dBFS RMS. */
	hum: 0.0144,
	/** Cutlery against a plate, as before: peaks -28 dBFS. */
	plate: 0.04,
	/** Air through the extractor hood: -52 dBFS RMS. */
	fanAir: 0.0034,
	/** The hood's motor, each of two beating sines: -56 dBFS. */
	fanHum: 0.0016,
	/** Knife on a board: peaks -35 dBFS. */
	chop: 0.022,
	/** A lid or a pan set down: peaks -34 dBFS. */
	clank: 0.02,
	/** A spatula against a pan: -48 dBFS RMS. */
	scrape: 0.016,
	/** The taxi at full throttle: -33 dBFS RMS (peaks -24); at idle, -42. */
	engine: 0.03,
	/** A car door's latch: peaks -28 dBFS, a short click. */
	latch: 0.016,
	/** A car door's hinge: peaks -38 dBFS. */
	carCreak: 0.012,
	/** A car door shutting: thump, body and slam together peak around -26 dBFS. */
	thump: 0.03,
	slam: 0.01,
	/** The restaurant's wooden door: its handle (peaks -34), its hinges (-32), the draught (-50 RMS). */
	handle: 0.008,
	doorCreak: 0.025,
	draught: 0.004,
};

/** Where things are, from -1 (left) to 1 (right), as the camera sees the street. */
const PAN = { cafe: -0.5, fourviere: -0.15, river: 0.55 };

/**
 * The taxi's engine mix, inside its own loudness: a lumpy note, some clatter (-14 dB
 * under the note), the tyres (-10 dB at full speed).
 */
const ENGINE_MIX = { lump: 0.5, clatter: 0.6, road: 0.25 };

/** The taxi's engine when the car stands still. */
export const TAXI_IDLE = 0.15;

/** The shortest crossfade: a switch, but not a click. */
const MIN_FADE = 0.05;

/**
 * A large bell heard from across the river: ratio to the prime, loudness and ring time
 * of each partial (hum, prime, minor third, fifth, nominal, then the upper partials that
 * make it a bell rather than a chord). The prime and the nominal have slightly detuned
 * twins: the slow beating of a real bell.
 */
const BELL_PRIME = 196;
const BELL: readonly (readonly [ratio: number, amp: number, decay: number])[] =
	[
		[0.5, 0.55, 9],
		[1, 0.6, 7],
		[1.0027, 0.3, 7],
		[1.183, 0.5, 5],
		[1.506, 0.22, 3.5],
		[2, 0.45, 4],
		[2.004, 0.2, 4],
		[2.514, 0.18, 2.6],
		[2.662, 0.14, 2.2],
		[3.011, 0.1, 1.8],
	];
const BELL_WEIGHT = BELL.reduce((sum, [, amp]) => sum + amp, 0);
/** The bell rings this long after the street starts, three strokes this far apart. */
const BELL_AFTER = 4;
const BELL_GAP = 2.8;

/** A partial: frequency, loudness relative to the others, ring time to -60 dB. */
type Partial = readonly [frequency: number, amp: number, decay: number];

/** A resonance a creak is heard through: frequency, Q, loudness. */
type Body = readonly [frequency: number, q: number, gain: number];

interface Burst {
	color: NoiseColor;
	filter: BiquadFilterType;
	frequency: number;
	/** Linear for band-pass filters, in dB for low- and high-pass ones (Web Audio's rule). */
	q?: number;
	attack: number;
	decay: number;
	level: number;
}

/** A continuous soundscape: its looping sources, its timers, and the fade it is on. */
interface Bed {
	place: SoundScene;
	gain: GainNode;
	/** Loops and LFOs, all started at once and stopped together; the first one is the main loop. */
	sources: AudioScheduledSourceNode[];
	timers: Set<number>;
	alive: boolean;
	fade: { curve: number[]; start: number; duration: number };
}

/** The taxi's engine, while it runs. */
interface Engine {
	sources: AudioScheduledSourceNode[];
	crank: OscillatorNode;
	lump: OscillatorNode;
	tone: BiquadFilterNode;
	road: GainNode;
	out: GainNode;
	panner: StereoPannerNode;
	level: number;
	pan: number;
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * An equal-power fade from `from` to `to`, sampled at `points` points: rising along a
 * quarter sine, falling along a quarter cosine, so two beds crossing keep their loudness.
 */
export function fadeCurve(from: number, to: number, points = 16): number[] {
	const curve: number[] = [];
	for (let i = 0; i < points; i++) {
		const angle = (i / (points - 1)) * (Math.PI / 2);
		curve.push(
			to >= from
				? from + (to - from) * Math.sin(angle)
				: to + (from - to) * Math.cos(angle),
		);
	}
	return curve;
}

/** Where a curve played by `follow` stands at `time`: straight lines between its points. */
export function curveAt(
	curve: readonly number[],
	start: number,
	duration: number,
	time: number,
): number {
	const last = curve.length - 1;
	if (time <= start || duration <= 0) return curve[time <= start ? 0 : last];
	if (time >= start + duration) return curve[last];
	const x = ((time - start) / duration) * last;
	const i = Math.floor(x);
	return curve[i] + (curve[i + 1] - curve[i]) * (x - i);
}

/**
 * A car going by at a distance, at `progress` from 0 to 1: loudness (zero at both ends,
 * 1 at its closest, falling off as 1/distance), pan from -1 to 1, and the Doppler factor.
 */
export function passBy(progress: number, spread = 4) {
	const x = spread * (2 * progress - 1);
	const near = 1 / Math.hypot(1, x);
	const far = 1 / Math.hypot(1, spread);
	return {
		level: Math.max(0, (near - far) / (1 - far)),
		pan: Math.atan(x) / Math.atan(spread),
		pitch: 1 - 0.06 * x * near,
	};
}

/** The taxi's engine at a given level: firing rate, brightness, loudness and tyre noise. */
export function engineAt(level: number) {
	const l = clamp(level, 0, 1);
	return {
		frequency: 26 + 64 * l,
		cutoff: 180 + 820 * l,
		gain: l > 0 ? LEVEL.engine * (0.3 + 0.7 * l) : 0,
		road: ENGINE_MIX.road * Math.max(0, (l - TAXI_IDLE) / (1 - TAXI_IDLE)),
	};
}

/** Beyond the edge of the picture (|pan| > 1), a sound fades with the distance. */
export function offscreen(pan: number): number {
	const beyond = Math.abs(pan) - 1;
	return beyond > 0 ? 1 / (1 + 1.5 * beyond) : 1;
}

/**
 * A loopable noise buffer at unit RMS. The samples past the end are crossfaded into the
 * first ones, so the loop point is as smooth as the rest: no tick every few seconds.
 */
export function noiseLoop(
	color: NoiseColor,
	length: number,
	random: () => number = Math.random,
): Float32Array {
	const fade = Math.min(4096, Math.floor(length / 4));
	const next = generator(color, random);
	const raw = new Float32Array(length + fade);
	for (let i = 0; i < raw.length; i++) raw[i] = next();
	for (let i = 0; i < fade; i++) {
		const angle = (i / fade) * (Math.PI / 2);
		raw[i] = raw[i] * Math.sin(angle) + raw[length + i] * Math.cos(angle);
	}
	const data = raw.slice(0, length);
	// Brown noise wanders: centre it, then bring it to unit RMS.
	let mean = 0;
	for (const sample of data) mean += sample;
	mean /= length;
	let power = 0;
	for (let i = 0; i < length; i++) {
		data[i] -= mean;
		power += data[i] * data[i];
	}
	const scale = 1 / Math.sqrt(power / length || 1);
	for (let i = 0; i < length; i++) data[i] *= scale;
	return data;
}

function generator(color: NoiseColor, random: () => number): () => number {
	const white = () => random() * 2 - 1;
	if (color === "white") return white;
	if (color === "brown") {
		// A leaky integrator: -6 dB per octave above about 75 Hz.
		let last = 0;
		return () => {
			last = last * 0.99 + white() * 0.1;
			return last;
		};
	}
	// Pink, -3 dB per octave: Paul Kellet's economy filter.
	let b0 = 0;
	let b1 = 0;
	let b2 = 0;
	return () => {
		const w = white();
		b0 = 0.99765 * b0 + w * 0.099046;
		b1 = 0.963 * b1 + w * 0.2965164;
		b2 = 0.57 * b2 + w * 1.0526913;
		return b0 + b1 + b2 + w * 0.1848;
	};
}

/** Noise loops of different lengths, so no two layers repeat together. Made once per context. */
const NOISE_SECONDS: Record<NoiseColor, number> = {
	white: 3,
	pink: 4.7,
	brown: 5.3,
};
const noiseCache = new WeakMap<
	BaseAudioContext,
	Record<NoiseColor, AudioBuffer>
>();

function noiseBuffers(ctx: BaseAudioContext): Record<NoiseColor, AudioBuffer> {
	const cached = noiseCache.get(ctx);
	if (cached) return cached;
	const make = (color: NoiseColor) => {
		const length = Math.round(NOISE_SECONDS[color] * ctx.sampleRate);
		const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
		buffer.getChannelData(0).set(noiseLoop(color, length));
		return buffer;
	};
	const buffers = {
		white: make("white"),
		pink: make("pink"),
		brown: make("brown"),
	};
	noiseCache.set(ctx, buffers);
	return buffers;
}

/** Plays `values` on a parameter, evenly spread over `duration`, joined by straight ramps. */
function follow(
	param: AudioParam,
	values: readonly number[],
	start: number,
	duration: number,
) {
	param.cancelScheduledValues(start);
	param.setValueAtTime(values[0], start);
	const last = values.length - 1;
	for (let i = 1; i <= last; i++)
		param.linearRampToValueAtTime(values[i], start + (duration * i) / last);
}

export class Ambience {
	private readonly ctx: AudioContext;
	private readonly master: GainNode;
	private readonly noise: Record<NoiseColor, AudioBuffer>;
	private bed: Bed | null = null;
	/** Beds fading out, until their sources end. */
	private readonly leaving = new Set<Bed>();
	private engine: Engine | null = null;
	private rang = false;
	private stopped = false;

	constructor(ctx: AudioContext, out: AudioNode) {
		this.ctx = ctx;
		this.noise = noiseBuffers(ctx);
		this.master = ctx.createGain();
		this.master.connect(out);
	}

	/** Crossfades to the street or the kitchen over `seconds` (equal power); the old bed then stops. */
	scene(place: SoundScene, seconds = 0) {
		if (this.stopped || this.bed?.place === place) return;
		const now = this.ctx.currentTime;
		const duration = Math.max(seconds, MIN_FADE);
		// The taxi belongs to the street.
		if (place !== "street") this.taxi(0, 0);
		const old = this.bed;
		const bed = this.build(place, now);
		this.bed = bed;
		this.fade(bed, 0, 1, now, duration);
		if (old) this.retire(old, now, duration);
	}

	/**
	 * The taxi's engine: `level` from 0 to 1 drives loudness and pitch (idle is TAXI_IDLE,
	 * 0 fades it out and stops it); `pan` from -1 to 1, beyond that it is off-screen and
	 * fades with the distance. Cheap enough to call on every frame.
	 */
	taxi(level: number, pan: number) {
		if (this.stopped) return;
		const l = clamp(level, 0, 1);
		if (l === 0) {
			this.stopEngine();
			return;
		}
		const engine = this.engine ?? this.startEngine();
		// Every call adds an automation event: skip the ones nobody would hear.
		if (Math.abs(l - engine.level) < 0.004 && Math.abs(pan - engine.pan) < 0.01)
			return;
		engine.level = l;
		engine.pan = pan;
		const at = engineAt(l);
		const now = this.ctx.currentTime;
		// An engine has inertia: the note follows the throttle a little late.
		engine.crank.frequency.setTargetAtTime(at.frequency, now, 0.12);
		engine.lump.frequency.setTargetAtTime(at.frequency / 2, now, 0.12);
		engine.tone.frequency.setTargetAtTime(at.cutoff, now, 0.12);
		engine.road.gain.setTargetAtTime(at.road, now, 0.1);
		engine.out.gain.setTargetAtTime(at.gain * offscreen(pan), now, 0.08);
		engine.panner.pan.setTargetAtTime(clamp(pan, -1, 1), now, 0.05);
	}

	/** A car door: the latch and a small creak when it opens, a solid thunk when it shuts. */
	carDoor(open: boolean) {
		if (this.stopped) return;
		const when = this.ctx.currentTime + 0.01;
		if (open) {
			this.latch(when, LEVEL.latch, 1);
			this.creak(
				when + 0.06,
				0.32,
				[70, 115],
				[
					[950, 6, 1],
					[2100, 8, 0.5],
				],
				LEVEL.carCreak,
			);
			return;
		}
		// The weight of the door, the air it pushes out, then the latch catching.
		this.thump(this.master, when, 90, 48, 0.24, LEVEL.thump);
		this.thump(this.master, when, 170, 110, 0.12, LEVEL.thump * 0.4);
		this.burst(this.master, when, {
			color: "pink",
			filter: "lowpass",
			frequency: 1300,
			q: 0,
			attack: 0.002,
			decay: 0.08,
			level: LEVEL.slam,
		});
		this.latch(when + 0.015, LEVEL.latch * 0.7, 0.8);
	}

	/** The restaurant's wooden door swinging open: the handle, then the hinges groan softly. */
	frontDoor() {
		if (this.stopped) return;
		const when = this.ctx.currentTime + 0.01;
		this.latch(when, LEVEL.handle, 0.7);
		this.creak(
			when + 0.08,
			0.6,
			[32, 68],
			[
				[520, 5, 1],
				[1350, 7, 0.45],
			],
			LEVEL.doorCreak,
		);
		// The evening air comes in with it.
		this.burst(this.master, when + 0.1, {
			color: "pink",
			filter: "lowpass",
			frequency: 500,
			q: -3,
			attack: 0.25,
			decay: 0.35,
			level: LEVEL.draught,
		});
	}

	/** Fades everything out quickly and lets every node and timer go. */
	stop() {
		if (this.stopped) return;
		this.stopped = true;
		const now = this.ctx.currentTime;
		this.master.gain.setTargetAtTime(0, now, 0.04);
		const end = now + 0.3;
		if (this.bed) {
			this.silence(this.bed);
			for (const source of this.bed.sources) source.stop(end);
		}
		// Leaving beds already have their stop time; only their timers could still run.
		for (const bed of this.leaving) this.silence(bed);
		if (this.engine) for (const source of this.engine.sources) source.stop(end);
		this.bed = null;
		this.engine = null;
		this.leaving.clear();
		window.setTimeout(() => this.master.disconnect(), 400);
	}

	private build(place: SoundScene, now: number): Bed {
		const gain = this.ctx.createGain();
		gain.gain.value = 0;
		gain.connect(this.master);
		const bed: Bed = {
			place,
			gain,
			sources: [],
			timers: new Set(),
			alive: true,
			fade: { curve: [0], start: now, duration: 0 },
		};
		if (place === "street") this.street(bed, now);
		else this.kitchen(bed, now);
		return bed;
	}

	/** Presqu'île, 8 pm: the city beyond, the Saône in front, a café, a far car, a bell. */
	private street(bed: Bed, now: number) {
		// The city beyond the quays: a low, brownish rumble that swells and settles. Below
		// 40 Hz it would only eat headroom.
		const rumble = this.gain(LEVEL.rumble);
		const distance = this.filter("lowpass", 220, 0);
		this.loop(bed.sources, "brown")
			.connect(this.filter("highpass", 40, -3))
			.connect(distance)
			.connect(rumble)
			.connect(bed.gain);
		this.every(bed, 1, [3, 7], (when) => {
			const swell = rand(0.55, 1.4);
			rumble.gain.setTargetAtTime(LEVEL.rumble * swell, when, 1.8);
			distance.frequency.setTargetAtTime(170 + 110 * swell, when, 1.8);
		});
		// The Saône in the foreground: a soft, wide wash that breathes slowly. The two sides
		// read the loop at different speeds, so they never line up.
		for (const [side, rate] of [
			[-PAN.river, 1],
			[PAN.river, 0.917],
		] as const) {
			const water = this.filter("lowpass", 1300, -3);
			const level = this.gain(LEVEL.river);
			this.loop(bed.sources, "pink", rate)
				.connect(this.filter("highpass", 180, -3))
				.connect(water)
				.connect(level)
				.connect(this.panner(side))
				.connect(bed.gain);
			this.wobble(bed, level.gain, side < 0 ? 0.11 : 0.083, LEVEL.river * 0.35);
			this.wobble(bed, water.frequency, side < 0 ? 0.067 : 0.052, 350);
		}
		this.every(bed, 0.8, [1.6, 4.2], (when) => this.lap(bed, when));
		this.every(bed, rand(2, 5), [6, 14], (when) => this.farCar(bed, when));
		this.every(bed, 1.5, [1.2, 4.5], (when) => this.terrace(bed, when));
		// Once, a few seconds in: Fourvière rings, far above the old town.
		if (!this.rang) {
			this.rang = true;
			const bell = this.farAway(bed, PAN.fourviere);
			for (let i = 0; i < 3; i++)
				this.stroke(bell, now + BELL_AFTER + i * BELL_GAP);
		}
	}

	/** The kitchen at work, calmly: a hum, the hood, cutlery, now and then a pan or a knife. */
	private kitchen(bed: Bed, now: number) {
		const hum = this.gain(LEVEL.hum);
		this.loop(bed.sources, "white")
			.connect(this.filter("bandpass", 700, 0.6))
			.connect(hum)
			.connect(bed.gain);
		// The extractor hood: air through the ducts, and its motor, beating slowly.
		this.loop(bed.sources, "pink")
			.connect(this.filter("lowpass", 450, -3))
			.connect(this.gain(LEVEL.fanAir))
			.connect(bed.gain);
		for (const frequency of [100, 100.6]) {
			const motor = this.ctx.createOscillator();
			motor.frequency.value = frequency;
			motor.connect(this.gain(LEVEL.fanHum)).connect(bed.gain);
			motor.start(now);
			bed.sources.push(motor);
		}
		// Now and then, cutlery against a plate.
		this.every(bed, 1.7, [1.3, 2.1], (when) => {
			if (Math.random() < 0.5)
				this.partials(
					this.panner(rand(-0.4, 0.4), bed.gain),
					when,
					[[rand(3200, 4400), 1, 0.12]],
					LEVEL.plate,
				);
		});
		this.every(bed, rand(3, 6), [4, 10], (when) => this.utensil(bed, when));
	}

	/** Fades a bed from `from` to `to`, and remembers the curve in case it is reversed midway. */
	private fade(
		bed: Bed,
		from: number,
		to: number,
		start: number,
		duration: number,
	) {
		const curve = fadeCurve(from, to);
		follow(bed.gain.gain, curve, start, duration);
		bed.fade = { curve, start, duration };
	}

	/** Fades a bed out from wherever it stands, then stops and disconnects it. */
	private retire(bed: Bed, now: number, duration: number) {
		this.silence(bed);
		const { curve, start, duration: length } = bed.fade;
		this.fade(bed, curveAt(curve, start, length, now), 0, now, duration);
		for (const source of bed.sources) source.stop(now + duration + 0.05);
		this.leaving.add(bed);
		const release = () => {
			bed.gain.disconnect();
			this.leaving.delete(bed);
		};
		const [main] = bed.sources;
		if (main) main.onended = release;
		else release();
	}

	/** No more events from this bed. */
	private silence(bed: Bed) {
		bed.alive = false;
		for (const id of bed.timers) window.clearTimeout(id);
		bed.timers.clear();
	}

	/** Calls `play` now and then, `min` to `max` seconds apart (the first time after `first`), while the bed lives. */
	private every(
		bed: Bed,
		first: number,
		[min, max]: readonly [number, number],
		play: (when: number) => void,
	) {
		const tick = (delay: number) => {
			const id = window.setTimeout(() => {
				bed.timers.delete(id);
				if (!bed.alive) return;
				play(this.ctx.currentTime + 0.02);
				tick(rand(min, max));
			}, delay * 1000);
			bed.timers.add(id);
		};
		tick(first);
	}

	private startEngine(): Engine {
		const { ctx } = this;
		const now = ctx.currentTime;
		const at = engineAt(TAXI_IDLE);
		const out = this.gain(0);
		const panner = ctx.createStereoPanner();
		out.connect(panner).connect(this.master);
		// The note: a sawtooth at the firing rate and a triangle an octave below (cylinders
		// never fire quite evenly: that is what makes an idle lumpy), through a resonant low-pass.
		const tone = this.filter("lowpass", at.cutoff, 4);
		tone.connect(out);
		const crank = ctx.createOscillator();
		crank.type = "sawtooth";
		crank.frequency.value = at.frequency;
		const lump = ctx.createOscillator();
		lump.type = "triangle";
		lump.frequency.value = at.frequency / 2;
		crank.connect(tone);
		lump.connect(this.gain(ENGINE_MIX.lump)).connect(tone);
		// A little mechanical clatter, chugging at the firing rate: noise whose gain the
		// sawtooth swings between 0 and 1.
		const sources: AudioScheduledSourceNode[] = [];
		const noise = this.loop(sources, "pink");
		const chug = this.gain(0.5);
		crank.connect(this.gain(0.5)).connect(chug.gain);
		noise
			.connect(this.filter("bandpass", 420, 0.9))
			.connect(chug)
			.connect(this.gain(ENGINE_MIX.clatter))
			.connect(out);
		// The tyres on the road, once the car rolls.
		const road = this.gain(0);
		noise
			.connect(this.filter("lowpass", 900, -3))
			.connect(road)
			.connect(out);
		crank.start(now);
		lump.start(now);
		sources.push(crank, lump);
		this.engine = {
			sources,
			crank,
			lump,
			tone,
			road,
			out,
			panner,
			level: -1,
			pan: 0,
		};
		return this.engine;
	}

	private stopEngine() {
		const engine = this.engine;
		if (!engine) return;
		this.engine = null;
		const now = this.ctx.currentTime;
		engine.out.gain.setTargetAtTime(0, now, 0.18);
		// Eight time constants later the engine is 70 dB down: stopping it is silent.
		for (const source of engine.sources) source.stop(now + 1.5);
		const [main] = engine.sources;
		if (main) main.onended = () => engine.panner.disconnect();
	}

	/** A small wave against the quay wall. */
	private lap(bed: Bed, when: number) {
		this.burst(this.panner(rand(-0.6, 0.6), bed.gain), when, {
			color: "pink",
			filter: "bandpass",
			frequency: rand(450, 850),
			q: 1.1,
			attack: rand(0.25, 0.45),
			decay: rand(0.7, 1.3),
			level: LEVEL.lap * rand(0.4, 1),
		});
	}

	/** A car on a far street, from one side to the other: tyres hissing, a low engine under them. */
	private farCar(bed: Bed, when: number) {
		const { ctx } = this;
		const duration = rand(3.5, 6);
		const direction = Math.random() < 0.5 ? -1 : 1;
		const peak = LEVEL.car * rand(0.6, 1);
		const level: number[] = [];
		const pan: number[] = [];
		const bright: number[] = [];
		for (let i = 0; i < 24; i++) {
			const at = passBy(i / 23);
			level.push(at.level * peak);
			pan.push(at.pan * 0.85 * direction);
			// Brighter up close, and a touch of Doppler: higher coming, lower going.
			bright.push((260 + 640 * at.level) * at.pitch);
		}
		const envelope = ctx.createGain();
		const panner = ctx.createStereoPanner();
		envelope.connect(panner).connect(bed.gain);
		follow(envelope.gain, level, when, duration);
		follow(panner.pan, pan, when, duration);
		const tyres = ctx.createBiquadFilter();
		tyres.type = "bandpass";
		tyres.Q.value = 0.8;
		follow(tyres.frequency, bright, when, duration);
		const hiss = this.oneShot("white", when, duration);
		hiss.connect(tyres).connect(envelope);
		const motor = this.oneShot("brown", when, duration);
		// Brown noise carries far more energy: 0.22 leaves it 4 dB under the tyres.
		motor
			.connect(this.filter("highpass", 40, -3))
			.connect(this.filter("lowpass", 160, 0))
			.connect(this.gain(0.22))
			.connect(envelope);
	}

	/** Glass or cutlery on the café terrace, across the street; now and then, two at once. */
	private terrace(bed: Bed, when: number) {
		if (Math.random() > 0.55) return;
		const out = this.panner(PAN.cafe + rand(-0.2, 0.2), bed.gain);
		const clinks = Math.random() < 0.25 ? 2 : 1;
		for (let i = 0; i < clinks; i++) {
			const at = when + i * rand(0.08, 0.22);
			const level = LEVEL.terrace * rand(0.4, 1);
			if (Math.random() < 0.5) {
				const f = rand(2300, 3300);
				this.partials(
					out,
					at,
					[
						[f, 1, 0.35],
						[f * 2.71, 0.4, 0.16],
					],
					level / 1.4,
				);
			} else {
				const f = rand(3400, 5000);
				this.partials(
					out,
					at,
					[
						[f, 1, 0.08],
						[f * 1.47, 0.5, 0.05],
					],
					level / 1.5,
				);
			}
		}
	}

	/** Where far things are heard: panned, and answered by the hills a moment later. */
	private farAway(bed: Bed, pan: number): AudioNode {
		const input = this.gain(1);
		const out = this.panner(pan, bed.gain);
		input.connect(out);
		const hills = this.filter("lowpass", 900, -3);
		input.connect(hills);
		for (const [delay, level] of [
			[0.37, 0.3],
			[0.61, 0.18],
		] as const) {
			const echo = this.ctx.createDelay(1);
			echo.delayTime.value = delay;
			hills.connect(echo).connect(this.gain(level)).connect(out);
		}
		return input;
	}

	/** One stroke of Fourvière's bell. */
	private stroke(out: AudioNode, when: number) {
		this.partials(
			out,
			when,
			BELL.map(([ratio, amp, decay]) => [BELL_PRIME * ratio, amp, decay]),
			LEVEL.bell / BELL_WEIGHT,
			0.012,
		);
	}

	/** Something set down or cut in the kitchen: a knife on a board, a lid, a spatula. */
	private utensil(bed: Bed, when: number) {
		const out = this.panner(rand(-0.5, 0.5), bed.gain);
		const pick = Math.random();
		if (pick < 0.4) {
			// Chopping: a few quick taps, each a click of the blade and the board's thud.
			const taps = 3 + Math.floor(Math.random() * 4);
			const gap = rand(0.13, 0.18);
			for (let i = 0; i < taps; i++) {
				const at = when + i * gap * rand(0.9, 1.1);
				const accent = LEVEL.chop * rand(0.6, 1);
				this.burst(out, at, {
					color: "white",
					filter: "bandpass",
					frequency: 1600,
					q: 1.3,
					attack: 0.001,
					decay: 0.035,
					level: accent,
				});
				this.thump(out, at, 200, 150, 0.05, accent * 0.6);
			}
		} else if (pick < 0.75) {
			// A lid or a pan set down on the stove: a few inharmonic partials, and the knock.
			const f = rand(420, 640);
			this.partials(
				out,
				when,
				[
					[f, 1, 0.45],
					[f * 1.73, 0.6, 0.3],
					[f * 2.61, 0.45, 0.22],
					[f * 3.93, 0.3, 0.15],
					[f * 5.21, 0.2, 0.1],
				],
				LEVEL.clank / 2.55,
			);
			this.thump(out, when, 150, 110, 0.07, LEVEL.clank * 0.5);
		} else {
			// A spatula scraping a pan.
			this.burst(out, when, {
				color: "pink",
				filter: "bandpass",
				frequency: rand(2200, 3000),
				q: 2.5,
				attack: 0.04,
				decay: rand(0.15, 0.25),
				level: LEVEL.scrape,
			});
		}
	}

	/** A latch: a click of noise and a small metallic tick. `bright` scales both. */
	private latch(when: number, level: number, bright: number) {
		this.burst(this.master, when, {
			color: "white",
			filter: "highpass",
			frequency: 2600 * bright,
			q: 0,
			attack: 0.001,
			decay: 0.018,
			level,
		});
		this.partials(
			this.master,
			when,
			[
				[1850 * bright, 1, 0.04],
				[2950 * bright, 0.6, 0.025],
			],
			level * 0.4,
		);
	}

	/**
	 * A hinge: a buzz at the stick-slip rate, wandering in pitch, heard through the
	 * resonances of the wood or the door panel.
	 */
	private creak(
		when: number,
		duration: number,
		[low, high]: readonly [number, number],
		body: readonly Body[],
		level: number,
	) {
		const { ctx } = this;
		const buzz = ctx.createOscillator();
		buzz.type = "sawtooth";
		// A random walk, leaning upwards: hinges tend to rise as the door gathers speed.
		const pitch: number[] = [];
		let v = 0.2;
		for (let i = 0; i < 10; i++) {
			pitch.push(low + (high - low) * v);
			v = clamp(v + rand(-0.35, 0.45), 0, 1);
		}
		follow(buzz.frequency, pitch, when, duration);
		const envelope = ctx.createGain();
		envelope.gain.value = 0;
		const shape = [0, 0.7, 1, 0.8, 0.95, 0.6, 0.85, 0.5, 0.25, 0];
		follow(
			envelope.gain,
			shape.map((x) => x * level * rand(0.8, 1.1)),
			when,
			duration,
		);
		envelope.connect(this.master);
		// Each tooth of the sawtooth rings the resonances to about 0.35: bring that to 1,
		// so `level` is the creak's peak.
		for (const [frequency, q, gain] of body)
			buzz
				.connect(this.filter("bandpass", frequency, q))
				.connect(this.gain(gain / 0.35))
				.connect(envelope);
		buzz.start(when);
		buzz.stop(when + duration + 0.05);
	}

	/** A low, falling sine: the weight of something landing. */
	private thump(
		out: AudioNode,
		when: number,
		from: number,
		to: number,
		duration: number,
		level: number,
	) {
		const osc = this.ctx.createOscillator();
		osc.frequency.setValueAtTime(from, when);
		osc.frequency.exponentialRampToValueAtTime(to, when + duration);
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0, when);
		gain.gain.linearRampToValueAtTime(level, when + 0.004);
		gain.gain.exponentialRampToValueAtTime(level * 0.001, when + duration);
		osc.connect(gain).connect(out);
		osc.start(when);
		osc.stop(when + duration + 0.02);
	}

	/** Sines ringing out together, each at its own pace: glass, metal, a bell. */
	private partials(
		out: AudioNode,
		when: number,
		list: readonly Partial[],
		level: number,
		attack = 0.002,
	) {
		for (const [frequency, amp, decay] of list) {
			const osc = this.ctx.createOscillator();
			osc.frequency.value = frequency;
			const gain = this.ctx.createGain();
			const peak = amp * level;
			gain.gain.setValueAtTime(0, when);
			gain.gain.linearRampToValueAtTime(peak, when + attack);
			gain.gain.exponentialRampToValueAtTime(
				peak * 0.001,
				when + attack + decay,
			);
			osc.connect(gain).connect(out);
			osc.start(when);
			osc.stop(when + attack + decay + 0.02);
		}
	}

	/** A short burst of filtered noise, with a quick rise and an exponential fall. */
	private burst(out: AudioNode, when: number, burst: Burst) {
		const length = burst.attack + burst.decay;
		const source = this.oneShot(burst.color, when, length + 0.02);
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(0, when);
		gain.gain.linearRampToValueAtTime(burst.level, when + burst.attack);
		gain.gain.exponentialRampToValueAtTime(burst.level * 0.001, when + length);
		source
			.connect(this.filter(burst.filter, burst.frequency, burst.q))
			.connect(gain)
			.connect(out);
	}

	/** A stretch of a noise loop, from a random point, playing once. */
	private oneShot(color: NoiseColor, when: number, duration: number) {
		const buffer = this.noise[color];
		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		source.start(when, Math.random() * buffer.duration, duration);
		return source;
	}

	/** A noise loop, started now at a random point of it, kept in `into` to be stopped later. */
	private loop(
		into: AudioScheduledSourceNode[],
		color: NoiseColor,
		rate = 1,
	): AudioBufferSourceNode {
		const buffer = this.noise[color];
		const source = this.ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		source.playbackRate.value = rate;
		source.start(this.ctx.currentTime, Math.random() * buffer.duration);
		into.push(source);
		return source;
	}

	/** Wobbles a parameter around its value: a slow sine, `depth` either way. */
	private wobble(bed: Bed, param: AudioParam, rate: number, depth: number) {
		const lfo = this.ctx.createOscillator();
		lfo.frequency.value = rate;
		lfo.connect(this.gain(depth)).connect(param);
		lfo.start(this.ctx.currentTime);
		bed.sources.push(lfo);
	}

	private gain(value: number): GainNode {
		const gain = this.ctx.createGain();
		gain.gain.value = value;
		return gain;
	}

	private filter(
		type: BiquadFilterType,
		frequency: number,
		q?: number,
	): BiquadFilterNode {
		const filter = this.ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.value = frequency;
		if (q !== undefined) filter.Q.value = q;
		return filter;
	}

	private panner(pan: number, out?: AudioNode): StereoPannerNode {
		const panner = this.ctx.createStereoPanner();
		panner.pan.value = clamp(pan, -1, 1);
		if (out) panner.connect(out);
		return panner;
	}
}
