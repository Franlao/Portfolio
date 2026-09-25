import type { Lang } from "../../../i18n/ui";
import type { Mood } from "./script";
import type { Speaker } from "./speakers";

/**
 * The casting: which Voxtral voice plays whom. Only the generator reads it.
 *
 * Voxtral's presets offer one French voice (Marie) and English ones (Oliver, Paul, Jane),
 * each in several moods; a preset keeps its accent in another language. So every role
 * lists takes in order of preference, and the generator keeps the first one whose
 * recording a speech-to-text model hears back as the script says. A pitch shift (in
 * semitones, applied by ffmpeg) turns one voice into several people.
 */
export interface Take {
	/** A preset's id, the name of a designed voice, or an ElevenLabs voice's id. */
	voice: string;
	pitch?: number;
	/**
	 * Voxtral unless said otherwise. Mistral has no Frenchman, and a woman's voice pitched
	 * down sounds numb: a role may take a native voice from ElevenLabs' library instead.
	 */
	engine?: "elevenlabs";
}

/**
 * Voices made for the site, since no preset is a Frenchman: Voxtral clones them from a
 * sample. The generator creates them in the Mistral account when they are missing, and
 * remembers their ids.
 */
export type Design =
	/** A preset reads a reference text, and ffmpeg pitches it. */
	| { from: string; pitch: number; text: string }
	/**
	 * A person's own recording, 5 to 25 seconds of one speaker. The repository is public,
	 * so the recording stays out of it: the environment variable `env` holds its path.
	 * It is only needed to create the voice.
	 */
	| { env: string };

const PRESETS = {
	marieHappy: "49d024dd-981b-4462-bb17-74d381eb8fd7",
	marieNeutral: "5a271406-039d-46fe-835b-fbbb00eaf08d",
	marieExcited: "2f62b1af-aea3-4079-9d10-7ca665ee7243",
	marieCurious: "e0580ce5-e63c-4cbe-88c8-a983b80c5f1f",
	marieAngry: "a7c07cdc-1c35-4d87-a938-c610a654f600",
	oliverCheerful: "5ad5d44e-6b4e-4a57-a8a8-4cae088034ed",
	oliverConfident: "8169ab87-bc99-4669-a5ec-6855860ace24",
	oliverExcited: "e8e5b1de-493c-4061-8414-e2170f9f4b6f",
	oliverCurious: "390c8a2b-60a6-4882-8437-c49a8bd33b63",
	paulCheerful: "01d985cd-5e0c-4457-bfd8-80ba31a5bc03",
	paulConfident: "98559b22-62b5-4a64-a7cd-fc78ca41faa8",
	paulExcited: "5940190b-f58a-4c3e-8264-a40d63fd6883",
	janeConfident: "cbe96cf0-85ec-4a10-accb-0b35c93b6dfd",
} as const;

export const DESIGNED: Record<string, Design> = {
	/**
	 * The chef, until Solim lends his own voice. Pitched down once more when mastered:
	 * a speaking pitch around 140 Hz, where the checks still hear every word.
	 *
	 * A first recording of Solim ({ env: "CHEF_VOICE" }), spoken freely, made the clone
	 * speak freely too: it added words of its own, even to the short calls. The next one
	 * will be read, in the chef's tone, short calls included.
	 */
	"brigade-chef": {
		from: PRESETS.marieNeutral,
		pitch: -5,
		text: "Bonsoir, et bienvenue. Ce soir, en cuisine, on prépare des projets d'intelligence artificielle, avec des recettes vraies et des produits fictifs. Installez-vous : le service commence, et rien ne sort sans contrôle.",
	},
};

const take = (voice: keyof typeof PRESETS, pitch = 0): Take => ({
	voice: PRESETS[voice],
	pitch,
});

type Role = Record<Mood, Take[]>;

/** One casting for every mood. */
const same = (takes: Take[]): Role => ({
	warm: takes,
	calm: takes,
	call: takes,
	cross: takes,
});

/**
 * One voice per language: a character does not change voice from one line to the next,
 * so a line that fails every check keeps its best take, flagged in voices.lock.json.
 * The French chef is the designed voice. In English, the same voice kept its French
 * accent and the checks misheard its short calls, so the English chef is Oliver, in the
 * moods of a single speaker.
 */
const chef: Record<Lang, Role> = {
	fr: same([{ voice: "brigade-chef", pitch: -3 }]),
	en: {
		warm: [take("oliverCheerful")],
		calm: [take("oliverConfident")],
		call: [take("oliverExcited")],
		cross: [take("oliverConfident")],
	},
};

/**
 * The maître d' is a « mère lyonnaise », like the women who made Lyon's bouchons famous.
 * In English, she keeps her French accent.
 */
const host = same([take("marieHappy"), take("marieNeutral")]);

/** Lyon's terrace: a few voices, pitched into four neighbours. */
const street: Record<"a" | "b" | "c" | "d", Role> = {
	a: same([take("marieHappy", -1), take("marieNeutral", -1)]),
	b: same([take("oliverCheerful", -2), take("marieCurious", -4)]),
	c: same([take("marieCurious", 1), take("marieHappy", 1)]),
	d: same([take("oliverCurious", 2), take("marieNeutral", -4)]),
};

export const cast: Record<Lang, Record<Speaker, Role>> = {
	fr: {
		chef: chef.fr,
		host,
		runner: same([take("marieExcited", 1), take("marieHappy", 1)]),
		cook: same([
			take("oliverExcited", -3),
			take("oliverConfident", -3),
			take("marieAngry", -4),
		]),
		"street-a": street.a,
		"street-b": street.b,
		"street-c": street.c,
		"street-d": street.d,
		tourist: same([take("paulCheerful")]),
	},
	en: {
		chef: chef.en,
		host,
		runner: same([take("paulExcited"), take("paulCheerful")]),
		cook: same([take("janeConfident"), take("paulConfident", -3)]),
		"street-a": street.a,
		"street-b": street.b,
		"street-c": street.c,
		"street-d": street.d,
		tourist: same([take("paulCheerful"), take("paulExcited")]),
	},
};

export const TTS_MODEL = "voxtral-mini-tts-2603";
export const STT_MODEL = "voxtral-mini-latest";
/** ElevenLabs' multilingual model, for the ElevenLabs takes. */
export const ELEVENLABS_MODEL = "eleven_multilingual_v2";
