import gsap from "gsap";
import type { PrologueCopy } from "./copy";

/**
 * Says a sentence aloud; calls `onStart` once the voice starts, and resolves when it
 * ends, with false if it stayed silent (sound off, clip missing).
 */
export type Speak = (text: string, onStart: () => void) => Promise<boolean>;

/**
 * Subtitles for the first order: each station is named while it works, in kitchen
 * words, then in the word an AI engineer would use. The visitor learns the vocabulary
 * from what they have just seen, not from a glossary.
 *
 * With the sound on, the chef explains each step to the visitor, at more length than
 * the panel reads; subtitles show what he says.
 */
export function createNarration(
	stage: HTMLElement,
	copy: PrologueCopy["narration"],
	reducedMotion: boolean,
	speak?: Speak,
	/** What the chef says at each step, when it is more than the panel reads. */
	spoken?: { model: readonly string[]; steps: readonly string[] },
) {
	// A labelled region, not an aside: it sits inside <main>.
	const box = document.createElement("section");
	box.className = "narration";
	box.setAttribute("aria-label", copy.label);
	box.hidden = true;
	const kitchen = document.createElement("p");
	kitchen.className = "narration-kitchen";
	kitchen.setAttribute("aria-live", "polite");
	const heard = document.createElement("p");
	heard.className = "narration-heard";
	heard.setAttribute("aria-live", "polite");
	const ai = document.createElement("p");
	ai.className = "narration-ai";
	const label = document.createElement("span");
	label.textContent = copy.inAi;
	const term = document.createElement("strong");
	ai.append(label, term);
	const dots = document.createElement("ol");
	dots.className = "narration-dots";
	dots.setAttribute("aria-hidden", "true");
	dots.append(...copy.steps.map(() => document.createElement("li")));
	box.append(dots, kitchen, heard, ai);
	stage.appendChild(box);

	let hideCall: gsap.core.Tween | null = null;
	return {
		/**
		 * « model »: Mistral read the offer and the code checked it; « lexicon »: the code
		 * alone. Resolves when the chef has finished saying it, at once with the sound off.
		 */
		async show(
			index: number,
			source: "model" | "lexicon" = "lexicon",
		): Promise<void> {
			const step = (source === "model" ? copy.model : copy.steps)[index];
			if (!step) return;
			hideCall?.kill();
			kitchen.textContent = step.kitchen;
			const speech =
				(source === "model" ? spoken?.model : spoken?.steps)?.[index] ??
				step.kitchen;
			heard.textContent = speech;
			term.textContent = step.ai;
			box.classList.remove("is-heard");
			for (const [i, dot] of [...dots.children].entries())
				dot.classList.toggle("is-done", i <= index);
			box.hidden = false;
			if (!reducedMotion)
				gsap.fromTo(
					box,
					{ y: -8, opacity: 0.3 },
					{ y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
				);
			await speak?.(speech, () => box.classList.add("is-heard"));
		},
		hide(afterSeconds = 0) {
			hideCall?.kill();
			hideCall = gsap.delayedCall(afterSeconds, () => {
				box.hidden = true;
				box.classList.remove("is-heard");
			});
		},
	};
}
