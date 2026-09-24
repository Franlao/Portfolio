/**
 * Every sound is synthesized with the Web Audio API: no audio file to download.
 * Off by default; browsers only allow audio after a user gesture anyway.
 */
export class Sound {
	private ctx: AudioContext | null = null;
	private master: GainNode | null = null;
	private hum: AudioBufferSourceNode | null = null;
	private clinks: number | null = null;
	enabled = false;

	enable() {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createGain();
			this.master.gain.value = 0.55;
			this.master.connect(this.ctx.destination);
		}
		void this.ctx.resume();
		this.enabled = true;
		this.startAmbience();
	}

	disable() {
		this.enabled = false;
		this.hum?.stop();
		this.hum = null;
		if (this.clinks !== null) window.clearInterval(this.clinks);
		this.clinks = null;
		void this.ctx?.suspend();
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

	/** A pan hitting the heat. */
	sizzle() {
		this.noise(1.1, 0.12, 4000, "highpass");
	}

	private startAmbience() {
		if (!this.ctx || !this.master || this.hum) return;
		const ctx = this.ctx;
		const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 700;
		filter.Q.value = 0.6;
		const gain = ctx.createGain();
		gain.gain.value = 0.025;
		source.connect(filter).connect(gain).connect(this.master);
		source.start();
		this.hum = source;
		// Now and then, cutlery against a plate.
		this.clinks = window.setInterval(() => {
			if (Math.random() < 0.5)
				this.tone(3200 + Math.random() * 1200, 0.12, 0.04, "sine");
		}, 1700);
	}

	private tone(
		frequency: number,
		duration: number,
		volume: number,
		type: OscillatorType,
		endFrequency?: number,
	) {
		if (!this.enabled || !this.ctx || !this.master) return;
		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(frequency, now);
		if (endFrequency)
			osc.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
		const gain = this.ctx.createGain();
		gain.gain.setValueAtTime(volume, now);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		osc.connect(gain).connect(this.master);
		osc.start(now);
		osc.stop(now + duration + 0.02);
	}

	private noise(
		duration: number,
		volume: number,
		frequency: number,
		type: BiquadFilterType = "lowpass",
	) {
		if (!this.enabled || !this.ctx || !this.master) return;
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
		source.connect(filter).connect(gain).connect(this.master);
		source.start(now);
	}
}
