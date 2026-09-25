import gsap from "gsap";
import type { PrologueCopy } from "./copy";

/**
 * Subtitles for the first order: each station is named while it works, in kitchen
 * words, then in the word an AI engineer would use. The visitor learns the vocabulary
 * from what they have just seen, not from a glossary.
 */
export function createNarration(
	stage: HTMLElement,
	copy: PrologueCopy["narration"],
	reducedMotion: boolean,
) {
	const box = document.createElement("aside");
	box.className = "narration";
	box.setAttribute("aria-label", copy.label);
	box.hidden = true;
	const kitchen = document.createElement("p");
	kitchen.className = "narration-kitchen";
	kitchen.setAttribute("aria-live", "polite");
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
	box.append(dots, kitchen, ai);
	stage.appendChild(box);

	let hideCall: gsap.core.Tween | null = null;
	return {
		/** « model »: Mistral read the offer and the code checked it; « lexicon »: the code alone. */
		show(index: number, source: "model" | "lexicon" = "lexicon") {
			const step = (source === "model" ? copy.model : copy.steps)[index];
			if (!step) return;
			hideCall?.kill();
			kitchen.textContent = step.kitchen;
			term.textContent = step.ai;
			for (const [i, dot] of [...dots.children].entries())
				dot.classList.toggle("is-done", i <= index);
			box.hidden = false;
			if (!reducedMotion)
				gsap.fromTo(
					box,
					{ y: -8, opacity: 0.3 },
					{ y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
				);
		},
		hide(afterSeconds = 0) {
			hideCall?.kill();
			hideCall = gsap.delayedCall(afterSeconds, () => {
				box.hidden = true;
			});
		},
	};
}
