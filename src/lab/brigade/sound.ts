/**
 * Effects and ambience are synthesized with the Web Audio API: no audio file to download.
 * Voices are recorded clips (see voice/), mixed on their own bus.
 * Off by default; browsers only allow audio after a user gesture anyway.
 */
import { Ambience, type SoundScene } from "./ambience";

export type { SoundScene } from "./ambience";
export type Bus = "sfx" | "ambience" | "voice";

const BUS_LEVELS: Record<Bus, number> = { sfx: 1, ambience: 1, voice: 1 };
/** While someone speaks, the room steps back: ambience and effects drop to these levels. */
const DUCKED = { ambience: 0.35, sfx: 0.7 };
const MASTER = 0.55;
/** Turning the sound on, the room comes in over this long rather than all at once. */
const AMBIENCE_IN = 1.2;

export class Sound {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private buses: Record<Bus, GainNode> | null = null;
	private ambience: Ambience | null = null;
	/** Where the visitor is, kept while the sound is off so turning it on plays the right bed. */
	private place: SoundScene = "kitchen";
	/** The taxi's engine as last asked for, for the same reason. */
	private cab = { level: 0, pan: 0 };
	private speaking = 0;
	private listeners = new Set<(enabled: boolean) => void>();
	enabled = false;

	enable() {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			// A gentle limiter: voices, bells and the stove may sound at once.
			const limiter = this.ctx.createDynamicsCompressor();
			limiter.threshold.value = -10;
			limiter.ratio.value = 6;
			limiter.connect(this.ctx.destination);
			this.master = this.ctx.createGain();
			this.master.gain.value = MASTER;
			this.master.connect(limiter);
			const ctx = this.ctx;
			const master = this.master;
			const bus = (name: Bus) => {
				const gain = ctx.createGain();
				gain.gain.value = BUS_LEVELS[name];
				gain.connect(master);
				return gain;
			};
			this.buses = {
				sfx: bus("sfx"),
				ambience: bus("ambience"),
				voice: bus("voice"),
			};
		} else if (this.master) {
			// Back from the fade to silence of disable().
			const now = this.ctx.currentTime;
			this.master.gain.cancelScheduledValues(now);
			this.master.gain.setTargetAtTime(MASTER, now, 0.005);
		}
		void this.ctx.resume();
		this.enabled = true;
		this.startAmbience();
		for (const listener of this.listeners) listener(true);
	}

	disable() {
		this.enabled = false;
		this.ambience?.stop();
		this.ambience = null;
		for (const listener of this.listeners) listener(false);
		if (!this.ctx || !this.master) return;
		// Fade out, and stop the clock only once the fades are done: no click on the way out.
		this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
		window.setTimeout(() => {
			if (!this.enabled) void this.ctx?.suspend();
		}, 250);
	}

	/** Called whenever the sound is turned on or off. Returns a function that unsubscribes. */
	onChange(listener: (enabled: boolean) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** The audio context, once the sound has been turned on at least once. */
	get context(): AudioContext | null {
		return this.ctx;
	}

	/** Where a source plugs in: voices, ambience or effects. */
	bus(name: Bus): GainNode | null {
		return this.buses?.[name] ?? null;
	}

	/** Someone starts or stops speaking: the room ducks under the voices, then comes back. */
	duck(speaking: boolean) {
		this.speaking = Math.max(0, this.speaking + (speaking ? 1 : -1));
		if (!this.ctx || !this.buses) return;
		const now = this.ctx.currentTime;
		const down = this.speaking > 0;
		for (const name of ["ambience", "sfx"] as const) {
			const gain = this.buses[name].gain;
			gain.cancelScheduledValues(now);
			gain.setTargetAtTime(
				down ? DUCKED[name] : BUS_LEVELS[name],
				now,
				down ? 0.05 : 0.35,
			);
		}
	}

	/**
	 * Where the visitor is: the street before the house opens, the kitchen after.
	 * Crossfades over `seconds`; while the sound is off, it is only remembered.
	 */
	setScene(place: SoundScene, seconds = 0) {
		this.place = place;
		// The taxi belongs to the street.
		if (place !== "street") this.cab.level = 0;
		this.ambience?.scene(place, seconds);
	}

	/**
	 * The taxi's engine: `level` 0..1 drives loudness and pitch (idle is TAXI_IDLE, 0 stops
	 * it); `pan` -1..1 from its place on screen, further out it fades with the distance.
	 * Cheap enough for every frame.
	 */
	taxi(level: number, pan: number) {
		this.cab.level = level;
		this.cab.pan = pan;
		this.ambience?.taxi(level, pan);
	}

	/** A car door: the latch and a small creak when it opens, a solid thunk when it shuts. */
	carDoor(open: boolean) {
		this.ambience?.carDoor(open);
	}

	/** The restaurant's wooden door swinging open. */
	frontDoor() {
		this.ambience?.frontDoor();
	}

	/** The service bell: a bright partial and an inharmonic one, ringing out. */
	bell() {
		this.tone(2093, 1.4, 0.35, "sine");
		this.tone(2093 * 2.76, 0.9, 0.12, "sine");
	}

	/** A rubber stamp: a low thump and a short burst of noise. */
	stamp() {
		this.tone(95, 0.18, 0.7, "sine", 60);
		this.noise(0.08, 0.4, 900);
	}

	/** Interface click. */
	pop() {
		this.tone(620, 0.08, 0.2, "sine", 920);
	}

	good() {
		this.tone(1046.5, 0.18, 0.25, "triangle");
		window.setTimeout(() => this.tone(1318.5, 0.3, 0.25, "triangle"), 110);
	}

	bad() {
		this.tone(150, 0.28, 0.25, "square", 110);
	}

	/** A page of the notebook turning: a short, papery rustle. */
	page() {
		this.noise(0.22, 0.09, 2600, "bandpass");
	}

	/** A pan hitting the heat. */
	sizzle() {
		this.noise(1.1, 0.12, 4000, "highpass");
	}

	/** The street or the kitchen, on the ambience bus, wherever the visitor is. */
	private startAmbience() {
		if (!this.ctx || !this.buses || this.ambience) return;
		this.ambience = new Ambience(this.ctx, this.buses.ambience);
		this.ambience.scene(this.place, AMBIENCE_IN);
		if (this.cab.level > 0) this.ambience.taxi(this.cab.level, this.cab.pan);
	}

	private tone(
		frequency: number,
		duration: number,
		volume: number,
		type: OscillatorType,
		endFrequency?: number,
	) {
		if (!this.enabled || !this.ctx || !this.buses) return;
		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(frequency, now);
		if (endFrequency)
			osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(volume, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		osc.connect(gain).connect(this.buses.sfx);
		osc.start(now);
		osc.stop(now + duration + 0.02);
	}

	private noise(
		duration: number,
		volume: number,
		frequency: number,
		type: BiquadFilterType = "lowpass",
	) {
		if (!this.enabled || !this.ctx || !this.buses) return;
		const ctx = this.ctx;
		const buffer = ctx.createBuffer(
			1,
			Math.ceil(ctx.sampleRate * duration),
			ctx.sampleRate,
		);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		const filter = ctx.createBiquadFilter();
		filter.type = type;
		filter.frequency.value = frequency;
		const gain = ctx.createGain();
		const now = ctx.currentTime;
		gain.gain.setValueAtTime(volume, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		source.connect(filter).connect(gain).connect(this.buses.sfx);
		source.start(now);
	}
}
