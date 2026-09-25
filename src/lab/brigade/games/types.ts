/**
 * Contract between the kitchen and a station mini-game.
 * A game lives in its own folder (games/<station>/) and never touches the rest of the scene:
 * it only receives a DOM root to render into, and a small context.
 */
import type { Lang } from "../../../i18n/ui";

export type { Lang };

export interface GameSound {
	pop(): void;
	good(): void;
	bad(): void;
	stamp(): void;
	bell(): void;
}

export interface GameContext {
	/** Language of the page: the game renders every string in it. */
	lang: Lang;
	/** Synthesized sounds; they do nothing while the visitor has the sound off. */
	sound: GameSound;
	/** Shows a speech bubble above the chef in the 3D kitchen. Keep it under 30 characters. */
	say(text: string): void;
	/** Closes the game and flies the camera back to the whole kitchen. */
	close(): void;
	/** True when the visitor asked for reduced motion: skip animations and timers. */
	reducedMotion: boolean;
}

export interface StationGame {
	/** Shown in the panel header, e.g. « La réserve qui se range seule ». Final text, typography applied. */
	title: Record<Lang, string>;
	/** One sentence under the title: what the visitor has to do. Final text, typography applied. */
	intro: Record<Lang, string>;
	/**
	 * Renders the game into root (an empty element inside the panel) and starts it.
	 * Returns a cleanup function, called when the panel closes: kill timers and tweens there.
	 */
	mount(root: HTMLElement, context: GameContext): () => void;
}
