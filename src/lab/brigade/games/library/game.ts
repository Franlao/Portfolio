import gsap from "gsap";
import type { GameContext, StationGame } from "../types";
import { copy, typo } from "./copy";
import { loopPad, pencilLoop, renderFigure } from "./figures";
import {
	type Claim,
	deal,
	type Finding,
	inspect,
	isRight,
	note,
	type Page,
	type Result,
	type Round,
	score,
	trap,
} from "./logic";
import "./game.css";

/**
 * « Chasse à l'hallucination » : the writer answers with citations, the visitor points at the
 * invented claim, then the verifier opens every cited page and circles the evidence in red.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const STEP = 0.8;

function make<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	content?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (content !== undefined) node.textContent = typo(content);
	return node;
}

function button(className: string, content = ""): HTMLButtonElement {
	const node = make("button", className, content);
	node.type = "button";
	return node;
}

const freshSeed = () => Math.floor(Math.random() * 0x100000000);

interface ClaimRow {
	item: HTMLLIElement;
	button: HTMLButtonElement;
	hint: HTMLElement;
	check: HTMLElement;
	stamp: HTMLElement;
}

function mount(root: HTMLElement, context: GameContext): () => void {
	const still = context.reducedMotion;
	const motion = gsap.context(() => {});

	// The shell: built once, its content changes with each question.
	const shell = make("div", "g-library");

	const bar = make("div", "g-library-bar");
	const progress = make("p", "g-library-progress");
	progress.setAttribute("aria-live", "polite");
	const tally = make("ol", "g-library-tally");
	tally.setAttribute("aria-label", typo(copy.tally));
	bar.append(progress, tally);

	const rule = make("p", "g-library-rule", copy.rule);
	rule.append(make("span", "g-library-keys", copy.keys));

	const play = make("div", "g-library-play");

	const questionBox = make("section", "g-library-question");
	const question = make("p", "g-library-question-text");
	question.tabIndex = -1;
	questionBox.append(make("p", "g-library-label", copy.question), question);

	const sources = make("section", "g-library-sources");
	const sourcesHead = make("div", "g-library-sources-head");
	const sourcesLabel = make("p", "g-library-label");
	const ghost = make("p", "g-library-ghost");
	ghost.hidden = true;
	sourcesHead.append(sourcesLabel, ghost);
	// On a phone the pages scroll sideways: the list must be reachable with the keyboard.
	const pageList = make("ul", "g-library-pages");
	pageList.tabIndex = 0;
	pageList.setAttribute("aria-label", typo(copy.pages));
	sources.append(sourcesHead, pageList);

	const answerBox = make("section", "g-library-answer");
	const claimList = make("ol", "g-library-claims");
	const ask = make("p", "g-library-ask", copy.ask);
	answerBox.append(
		make("p", "g-library-label g-library-model", copy.answer),
		make("p", "g-library-opener", copy.opener),
		claimList,
		ask,
	);

	const verdict = make("div", "g-library-verdict");
	verdict.setAttribute("aria-live", "polite");
	const verdictHead = make("p", "g-library-verdict-head");
	const verdictTrap = make("p", "g-library-verdict-trap");
	verdict.append(verdictHead, verdictTrap);
	const next = button("g-library-next");
	next.hidden = true;

	play.append(questionBox, sources, answerBox, verdict, next);

	const end = make("section", "g-library-end");
	end.hidden = true;
	const endTitle = make("h3", "g-library-end-title", copy.endTitle);
	endTitle.tabIndex = -1;
	const endScore = make("p", "g-library-score");
	const recap = make("ol", "g-library-recap");
	const verifierLine = make("p", "g-library-verifier");
	const real = make("div", "g-library-real");
	real.append(
		make("p", "g-library-label", copy.realLabel),
		make("p", "", copy.real),
		make("p", "g-library-tags", copy.tags),
	);
	const again = button("g-library-again", copy.again);
	const back = button("g-library-back", copy.back);
	const actions = make("div", "g-library-actions");
	actions.append(again, back);
	end.append(endTitle, endScore, recap, verifierLine, real, actions);

	shell.append(bar, rule, play, end);
	root.append(shell);

	// Game state.
	let rounds: Round[] = deal(freshSeed());
	let index = 0;
	let results: Result[] = [];
	let answered = false;
	let rows: ClaimRow[] = [];
	let cards = new Map<number, HTMLElement>();
	let timeline: gsap.core.Timeline | null = null;

	const animate = (build: () => void) => {
		if (!still) motion.add(build);
	};

	function renderTally() {
		tally.replaceChildren(
			...rounds.map((_, i) => {
				const result = results[i];
				const state = result ? (isRight(result) ? "right" : "wrong") : "todo";
				const item = make("li");
				item.dataset.state = state;
				const mark = make(
					"span",
					"",
					state === "right" ? "✓" : state === "wrong" ? "✗" : String(i + 1),
				);
				mark.setAttribute("aria-hidden", "true");
				item.append(
					mark,
					make("span", "g-library-sr", copy.tallyItem(i + 1, state)),
				);
				return item;
			}),
		);
	}

	function renderPage(page: Page): HTMLLIElement {
		const item = make("li");
		const card = make("article", "g-library-page");
		const head = make("header", "g-library-page-head");
		head.append(
			make("p", "g-library-page-number", `p. ${page.number}`),
			make("p", "g-library-page-title", `${page.doc}, ${page.title}`),
		);
		const figure = make("div", "g-library-page-figure");
		// Our own static drawing, built from the fictional documentation: no visitor input here.
		figure.innerHTML = renderFigure(page);
		const text = make("p", "g-library-page-text");
		for (const segment of page.text) {
			if (typeof segment === "string") {
				text.append(typo(segment));
			} else {
				const value = make("span", "g-library-fact", segment.value);
				value.dataset.fact = segment.key;
				text.append(value);
			}
		}
		card.append(head, figure, text);
		item.append(card);
		cards.set(page.number, card);
		return item;
	}

	function renderClaim(claim: Claim, i: number): ClaimRow {
		const item = make("li", "g-library-claim-row");
		const pick = button("g-library-claim");
		const hint = make("span", "g-library-claim-hint", copy.suspect);
		pick.append(
			make("kbd", "", String(i + 1)),
			make("span", "g-library-claim-text", claim.text),
			make("span", "g-library-cite", `[p. ${claim.page}]`),
			hint,
		);
		pick.addEventListener("click", () => answer(i));
		const check = make("p", "g-library-check");
		check.hidden = true;
		const stamp = make("span", "g-library-stamp", copy.stamp);
		stamp.setAttribute("aria-hidden", "true");
		stamp.hidden = true;
		item.append(pick, check, stamp);
		return { item, button: pick, hint, check, stamp };
	}

	function showRound() {
		const round = rounds[index];
		answered = false;
		timeline?.kill();
		timeline = null;
		progress.textContent = typo(copy.progress(index + 1, rounds.length));
		question.textContent = typo(`« ${round.item.question} »`);
		sourcesLabel.textContent = typo(copy.sources(round.item.pages.length));
		ghost.hidden = true;
		ghost.textContent = "";
		cards = new Map();
		pageList.replaceChildren(...round.item.pages.map(renderPage));
		pageList.scrollLeft = 0;
		rows = round.claims.map(renderClaim);
		claimList.replaceChildren(...rows.map((row) => row.item));
		ask.hidden = false;
		// The rule matters for the first question; after that it only pushes the pages down.
		rule.hidden = index > 0;
		verdict.removeAttribute("data-right");
		verdictHead.textContent = "";
		verdictTrap.textContent = "";
		next.hidden = true;
		renderTally();
		animate(() => {
			gsap.from(play, {
				opacity: 0,
				y: 10,
				duration: 0.3,
				ease: "power2.out",
				clearProps: "opacity,transform",
			});
		});
		context.sound.pop();
	}

	/** On a phone the pages form a sideways strip: bring the one being checked into view. */
	function bringIntoView(card: HTMLElement | undefined) {
		const item = card?.parentElement;
		if (!item || pageList.scrollWidth <= pageList.clientWidth) return;
		pageList.scrollTo({
			left: item.offsetLeft,
			behavior: still ? "auto" : "smooth",
		});
	}

	function drawLoop(svg: SVGSVGElement, d: string) {
		const loop = document.createElementNS(SVG_NS, "path");
		loop.setAttribute("class", "g-library-mark");
		loop.setAttribute("d", d);
		// A normalised length makes the pencil stroke easy to draw, whatever the loop's size.
		loop.setAttribute("pathLength", "1");
		svg.append(loop);
		animate(() => {
			gsap.fromTo(
				loop,
				{ attr: { "stroke-dasharray": 1, "stroke-dashoffset": 1 } },
				{
					attr: { "stroke-dashoffset": 0 },
					duration: 0.5,
					ease: "power1.inOut",
					// Once drawn, a plain stroke: nothing left that depends on the dash pattern.
					onComplete: () => {
						loop.removeAttribute("stroke-dasharray");
						loop.removeAttribute("stroke-dashoffset");
					},
				},
			);
		});
	}

	/** The red pencil: a loop around the exact spot of the page, with ✓ or ✗ beside it. */
	function circle(card: HTMLElement, key: string, ok: boolean, seed: number) {
		const target = card.querySelector(`[data-fact="${key}"]`);
		const sign = ok ? "✓" : "✗";
		if (target instanceof SVGGraphicsElement && target.ownerSVGElement) {
			const svg = target.ownerSVGElement;
			const { d, tip } = pencilLoop(target.getBBox(), seed);
			drawLoop(svg, d);
			const label = document.createElementNS(SVG_NS, "text");
			label.setAttribute("class", "g-library-mark-sign");
			label.setAttribute("x", String(tip.x));
			label.setAttribute("y", String(tip.y));
			label.setAttribute("text-anchor", "middle");
			label.textContent = sign;
			svg.append(label);
			animate(() => {
				gsap.from(label, { opacity: 0, delay: 0.4, duration: 0.15 });
			});
		} else if (target instanceof HTMLElement) {
			// An overlay measured in pixels around the words, so the pencil keeps an even width.
			const { width, height } = target.getBoundingClientRect();
			const pad = loopPad({ x: 0, y: 0, width, height });
			const mx = pad.x + 4;
			const my = pad.y + 4;
			const overlay = document.createElementNS(SVG_NS, "svg");
			overlay.setAttribute("class", "g-library-loop");
			overlay.setAttribute(
				"viewBox",
				`0 0 ${width + mx * 2} ${height + my * 2}`,
			);
			overlay.setAttribute("aria-hidden", "true");
			overlay.style.left = `${-mx}px`;
			overlay.style.top = `${-my}px`;
			overlay.style.width = `${width + mx * 2}px`;
			overlay.style.height = `${height + my * 2}px`;
			target.append(overlay);
			target.dataset.sign = sign;
			drawLoop(overlay, pencilLoop({ x: mx, y: my, width, height }, seed).d);
		}
	}

	function stampPage(card: HTMLElement) {
		const stamp = make("p", "g-library-void", copy.void);
		card.append(stamp);
		animate(() => {
			gsap.from(stamp, {
				scale: 2.2,
				opacity: 0,
				duration: 0.26,
				ease: "back.out(1.6)",
			});
		});
	}

	/** The verifier's check of one claim: the note under it, the mark on the page. */
	function reveal(i: number, finding: Finding, claim: Claim) {
		const row = rows[i];
		row.check.textContent = typo(note(finding, claim));
		row.check.hidden = false;
		row.item.dataset.check = finding.ok ? "ok" : "ko";
		if ("page" in finding) {
			const card = cards.get(finding.page.number);
			if (card && (finding.ok || finding.reason === "mismatch")) {
				circle(card, finding.fact.key, finding.ok, index * 10 + i);
			} else if (card) {
				stampPage(card);
			}
			bringIntoView(card);
		} else {
			ghost.textContent = typo(copy.ghost(finding.cited));
			ghost.hidden = false;
		}
		if (finding.ok) context.sound.pop();
		else context.sound.stamp();
		animate(() => {
			gsap.from(row.check, { opacity: 0, x: -6, duration: 0.25 });
		});
	}

	function conclude(round: Round, findings: Finding[], picked: number) {
		const right = picked === round.fake;
		const fake = rows[round.fake];
		fake.stamp.hidden = false;
		animate(() => {
			gsap.from(fake.stamp, {
				scale: 2.2,
				opacity: 0,
				duration: 0.26,
				ease: "back.out(1.6)",
			});
		});
		const fakeFinding = findings[round.fake];
		if ("page" in fakeFinding)
			bringIntoView(cards.get(fakeFinding.page.number));
		verdict.dataset.right = String(right);
		verdictHead.textContent = typo(
			right
				? copy.right(round.fake + 1)
				: copy.wrong(picked + 1, round.fake + 1),
		);
		verdictTrap.textContent = typo(copy.trap(trap(fakeFinding)));
		next.textContent = typo(index + 1 >= rounds.length ? copy.last : copy.next);
		next.hidden = false;
		renderTally();
		next.focus();
		if (right) {
			context.sound.good();
			context.say(copy.say.right);
		} else {
			context.sound.bad();
			context.say(copy.say.wrong);
		}
	}

	function answer(picked: number) {
		if (answered || play.hidden) return;
		answered = true;
		const round = rounds[index];
		const findings = inspect(round);
		results.push({ round, picked });
		// aria-disabled rather than disabled: the focus stays on the chosen claim.
		for (const row of rows) row.button.setAttribute("aria-disabled", "true");
		rows[picked].item.dataset.picked = "true";
		rows[picked].hint.textContent = typo(copy.picked);
		ask.hidden = true;
		verdictHead.textContent = typo(copy.checking);
		const steps = findings.map(
			(finding, i) => () => reveal(i, finding, round.claims[i]),
		);
		const finish = () => conclude(round, findings, picked);
		if (still) {
			for (const step of steps) step();
			finish();
			return;
		}
		motion.add(() => {
			const tl = gsap.timeline();
			steps.forEach((step, i) => {
				tl.call(step, [], 0.3 + i * STEP);
			});
			tl.call(finish, [], 0.3 + steps.length * STEP);
			timeline = tl;
		});
	}

	function finishGame() {
		const result = score(results);
		play.hidden = true;
		rule.hidden = true;
		end.hidden = false;
		progress.textContent = "";
		endScore.textContent = typo(copy.score(result.right, result.total));
		recap.replaceChildren(
			...results.map((entry, i) => {
				const right = isRight(entry);
				const item = make("li");
				const mark = make("span", "g-library-recap-mark", right ? "✓" : "✗");
				const kind = trap(inspect(entry.round)[entry.round.fake]);
				item.append(mark, typo(copy.recap(i + 1, right, kind)));
				return item;
			}),
		);
		verifierLine.textContent = typo(copy.verifier(result.total));
		renderTally();
		bar.scrollIntoView({ block: "nearest" });
		endTitle.focus({ preventScroll: true });
		context.sound.bell();
		context.say(copy.say.end);
	}

	function restart() {
		const previous = rounds.map((round) => round.item.id);
		rounds = deal(freshSeed(), previous);
		index = 0;
		results = [];
		end.hidden = true;
		play.hidden = false;
		showRound();
		bar.scrollIntoView({ block: "nearest" });
		question.focus({ preventScroll: true });
	}

	next.addEventListener("click", () => {
		index++;
		if (index >= rounds.length) {
			finishGame();
			return;
		}
		showRound();
		bar.scrollIntoView({ block: "nearest" });
		question.focus({ preventScroll: true });
	});
	again.addEventListener("click", restart);
	back.addEventListener("click", () => context.close());

	// Keys 1 to 3 point at a claim, as in the pass game.
	const onKey = (event: KeyboardEvent) => {
		if (answered || play.hidden || !shell.isConnected) return;
		if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
		const target = event.target;
		if (
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
		) {
			return;
		}
		const position = ["1", "2", "3"].indexOf(event.key);
		if (position < 0 || position >= rows.length) return;
		event.preventDefault();
		rows[position].button.focus({ preventScroll: true });
		answer(position);
	};
	window.addEventListener("keydown", onKey);

	showRound();
	context.say(copy.say.start);

	return () => {
		window.removeEventListener("keydown", onKey);
		timeline?.kill();
		motion.revert();
	};
}

export const game: StationGame = {
	title: copy.title,
	intro: copy.intro,
	mount,
};
