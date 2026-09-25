import gsap from "gsap";
import * as THREE from "three";
import {
	copy as claims,
	formatEuro,
} from "../../../components/demos/claims-agent/copy";
import {
	type ClaimFile,
	circumstanceIds,
	defaultFile,
	type Outcome,
	type PieceId,
	pieceIds,
} from "../../../components/demos/claims-agent/engine";
import type { Lang } from "../../../i18n/ui";
import {
	sketchCheck,
	sketchCross,
	sketchEllipse,
	sketchRect,
} from "../../../lib/sketch";
import { frTypo } from "../../../lib/typo";
import type { Cook } from "../cook";
import { copy as brigadeCopy } from "../copy";
import { type RushCaseId, rushCases } from "../rush";
import type { Sound } from "../sound";
import { outline, toon } from "../toon";
import type { VoiceCopy } from "../voice/copy";
import type { Voices } from "../voice/voices";
import { notebookCopy } from "./copy";
import { type RecipeStep, ROUTES, recipe } from "./recipe";
import "./notebook.css";

/** What the notebook needs from the kitchen. main.ts provides it. */
export interface NotebookHand {
	stage: HTMLElement;
	lang: Lang;
	reducedMotion: boolean;
	sound: Sound;
	voices: Voices;
	spoken: VoiceCopy["notebook"];
	chef: Cook;
	/** Where the chef stands on screen, in CSS pixels: the notebook flies from his hands. */
	chefOnScreen(): { x: number; y: number };
	/** The project's full page, one more page of the same notebook. */
	projectHref: string;
	/** Called once the notebook is shut. */
	onClose(): void;
}

/** A claim the visitor judged at the pass, and what they decided. */
export interface NotebookRound {
	id: RushCaseId;
	choice: Outcome | null;
}

const SVG = "http://www.w3.org/2000/svg";
/** Under this width the notebook is a single page, and opens without its cover. */
const NARROW = "(max-width: 760px)";

const wait = (seconds: number) =>
	new Promise<void>((resolve) => gsap.delayedCall(seconds, resolve));

function strokes(paths: string[], className: string): SVGPathElement[] {
	return paths.map((d) => {
		const path = document.createElementNS(SVG, "path");
		path.setAttribute("d", d);
		// A length of 1 lets the stylesheet draw any stroke with the same dash animation.
		path.setAttribute("pathLength", "1");
		path.setAttribute("class", className);
		return path;
	});
}

/** A small drawn mark: a red tick or cross, as a pencil makes them. */
function mark(passed: boolean, seed: number): SVGSVGElement {
	const svg = document.createElementNS(SVG, "svg");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("class", "notebook-mark");
	svg.append(
		...strokes(
			passed ? sketchCheck(seed) : sketchCross(seed),
			"notebook-stroke",
		),
	);
	return svg;
}

function html<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function hidden(text: string) {
	return html("span", "visually-hidden", text);
}

/**
 * The chef's notebook, opened over the kitchen. On the left, the claims the visitor has
 * just judged at the pass (or the house claim) and their ingredients, which can be
 * changed. On the right, the agent's recipe for the selected claim: every step of the
 * real engine, drawn in the site's three strokes as the chef reads it out.
 */
export function createNotebook(hand: NotebookHand) {
	const { lang, stage, voices, sound } = hand;
	const t = notebookCopy[lang];
	const claim = claims[lang];
	const rush = brigadeCopy[lang].rush;
	const type = (text: string) => (lang === "fr" ? frTypo(text) : text);
	const narrow = window.matchMedia(NARROW);

	// The notebook as the chef holds it, before it flies to the visitor.
	const prop = outline(
		new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), toon(0xa9784a)),
		0.02,
	);

	const dialog = html("dialog", "notebook");
	dialog.setAttribute("aria-labelledby", "notebook-title");
	const book = html("div", "notebook-book");
	const cover = html("div", "notebook-cover");
	cover.setAttribute("aria-hidden", "true");
	cover.append(html("span", "notebook-cover-label", t.cover));
	const spread = html("div", "notebook-spread");

	// The left page: tonight's claims, then the ingredients of the selected one.
	const left = html("section", "notebook-page notebook-left");
	const kicker = html("p", "notebook-kicker", `${t.label} · ${t.station}`);
	const title = html("h2", "notebook-title");
	title.id = "notebook-title";
	const note = html("p", "notebook-note");
	const files = html("ol", "notebook-files");
	const ingredients = html("section", "notebook-ingredients");
	ingredients.setAttribute("aria-labelledby", "notebook-ingredients");
	const ingredientsTitle = html("h3", undefined, t.ingredients);
	ingredientsTitle.id = "notebook-ingredients";
	const story = html("p", "notebook-story");
	const hint = html("p", "notebook-hint", t.editHint);

	const pieces = html("fieldset", "notebook-pieces");
	pieces.append(html("legend", undefined, t.pieces));
	const pieceBoxes = new Map<PieceId, HTMLInputElement>();
	for (const id of pieceIds) {
		const label = html("label");
		const box = html("input");
		box.type = "checkbox";
		box.value = id;
		label.append(box, ` ${claim.pieces[id]}`);
		pieces.append(label);
		pieceBoxes.set(id, box);
	}

	const range = (labelText: string, min: number, max: number, step: number) => {
		const wrap = html("label", "notebook-range");
		const head = html("span", "notebook-range-head");
		const value = html("output", "notebook-range-value");
		head.append(html("span", undefined, labelText), value);
		const input = html("input");
		input.type = "range";
		input.min = String(min);
		input.max = String(max);
		input.step = String(step);
		wrap.append(head, input);
		return { wrap, input, value };
	};
	const delay = range(t.delay, 0, 15, 1);
	const amount = range(t.quote, 500, 25000, 100);

	const circumstances = html("fieldset", "notebook-circumstances");
	circumstances.append(html("legend", undefined, t.circumstance));
	const circumstanceRadios = new Map<string, HTMLInputElement>();
	for (const id of circumstanceIds) {
		const label = html("label");
		const radio = html("input");
		radio.type = "radio";
		radio.name = "notebook-circumstance";
		radio.value = id;
		label.append(radio, ` ${claim.circumstances[id]}`);
		circumstances.append(label);
		circumstanceRadios.set(id, radio);
	}
	const edited = html("p", "notebook-edited");
	edited.setAttribute("role", "status");
	ingredients.append(
		ingredientsTitle,
		story,
		hint,
		pieces,
		delay.wrap,
		amount.wrap,
		circumstances,
		edited,
	);
	left.append(kicker, title, note, files, ingredients);

	// The right page: the agent's recipe.
	const right = html("section", "notebook-page notebook-right");
	right.setAttribute("aria-labelledby", "notebook-recipe");
	const recipeHead = html("header", "notebook-recipe-head");
	const recipeTitle = html("h3", undefined, t.recipe);
	recipeTitle.id = "notebook-recipe";
	const stamp = html("p", "notebook-stamp");
	stamp.setAttribute("aria-live", "polite");
	recipeHead.append(recipeTitle, stamp);
	const steps = html("ol", "notebook-steps");
	const foot = html("footer", "notebook-foot");
	const legend = html("ul", "notebook-legend");
	for (const [kind, text] of [
		["code", t.legend.code],
		["model", t.legend.model],
		["check", t.legend.check],
	] as const) {
		const item = html("li", `is-${kind}`);
		const sample = document.createElementNS(SVG, "svg");
		sample.setAttribute("viewBox", "0 0 28 12");
		sample.setAttribute("aria-hidden", "true");
		const d =
			kind === "code"
				? ["M1 6H27"]
				: kind === "model"
					? sketchRect(28, 12, 7, 2).slice(0, 1)
					: sketchCheck(3);
		sample.append(...strokes(d, "notebook-sample"));
		item.append(sample, text);
		legend.append(item);
	}
	const actions = html("div", "notebook-actions");
	const replay = html("button", "notebook-replay", t.replay);
	replay.type = "button";
	const full = html("a", "notebook-full", t.full);
	full.href = hand.projectHref;
	actions.append(replay, full);
	foot.append(legend, actions);
	right.append(recipeHead, steps, foot);

	const close = html("button", "notebook-close", t.close);
	close.type = "button";
	spread.append(left, right);
	book.append(spread, cover, close);
	dialog.append(book);
	stage.append(dialog);

	// State: the claims of the evening, the one on the page, and its (maybe changed) file.
	let rounds: NotebookRound[] = [];
	let selected = -1;
	let file: ClaimFile = structuredClone(defaultFile);
	let changed = false;
	/** Every drawing checks it: a newer drawing or closing the notebook stops an older one. */
	let generation = 0;
	let narrating = false;
	let narratedOnce = false;
	let opened = false;
	let returnFocus: HTMLElement | null = null;

	const caseOf = (id: RushCaseId) => rushCases.find((c) => c.id === id);

	const renderFiles = () => {
		files.replaceChildren();
		title.textContent = rounds.length ? t.tonight : t.house;
		note.textContent = rounds.length ? "" : t.houseNote;
		note.hidden = rounds.length > 0;
		rounds.forEach((round, index) => {
			const rushCase = caseOf(round.id);
			if (!rushCase) return;
			const agent = recipe(rushCase.file, lang).outcome;
			const same = round.choice === agent;
			const button = html("button", "notebook-file");
			button.type = "button";
			button.setAttribute("aria-pressed", String(index === selected));
			const verdict = html("span", "notebook-file-verdict");
			verdict.append(
				html(
					"span",
					undefined,
					t.verdict(t.you, round.choice ? rush.stamps[round.choice] : t.none),
				),
				html("span", undefined, t.verdict(t.agent, rush.stamps[agent])),
			);
			button.append(
				html("span", "notebook-file-story", type(rushCase.story[lang])),
				verdict,
				mark(same, index + 11),
				hidden(same ? t.same : round.choice ? t.different : t.none),
			);
			button.classList.toggle("is-different", !same);
			button.addEventListener("click", () => {
				select(index);
				void draw(false);
			});
			const item = html("li");
			item.append(button);
			files.append(item);
		});
	};

	const renderIngredients = () => {
		for (const [id, box] of pieceBoxes) box.checked = file.pieces.includes(id);
		delay.input.value = String(file.delayDays);
		delay.value.textContent = type(t.days(file.delayDays));
		amount.input.value = String(file.quoteAmount);
		amount.value.textContent = formatEuro(lang, file.quoteAmount);
		for (const [id, radio] of circumstanceRadios)
			radio.checked = id === file.circumstance;
		edited.textContent = changed ? t.edited : "";
	};

	const select = (index: number) => {
		selected = index;
		const rushCase = index >= 0 ? caseOf(rounds[index].id) : undefined;
		file = structuredClone(rushCase?.file ?? defaultFile);
		changed = false;
		story.textContent = type(rushCase ? rushCase.story[lang] : t.houseStory);
		for (const [i, item] of [...files.children].entries())
			item
				.querySelector("button")
				?.setAttribute("aria-pressed", String(i === index));
		renderIngredients();
	};

	const edit = () => {
		file = {
			pieces: pieceIds.filter((id) => pieceBoxes.get(id)?.checked),
			delayDays: Number(delay.input.value),
			quoteAmount: Number(amount.input.value),
			circumstance:
				circumstanceIds.find((id) => circumstanceRadios.get(id)?.checked) ??
				file.circumstance,
		};
		changed = true;
		renderIngredients();
		void draw(false);
	};
	for (const box of pieceBoxes.values()) box.addEventListener("change", edit);
	for (const radio of circumstanceRadios.values())
		radio.addEventListener("change", edit);
	delay.input.addEventListener("input", edit);
	amount.input.addEventListener("input", edit);

	/** One step of the recipe, as the notebook writes it. */
	const stepItem = (step: RecipeStep, index: number, failed: string[]) => {
		const item = html("li", `notebook-step is-${step.kind}`);
		const frame = document.createElementNS(SVG, "svg");
		frame.setAttribute("class", "notebook-frame");
		frame.setAttribute("aria-hidden", "true");
		frame.setAttribute("preserveAspectRatio", "none");
		const head = html("p", "notebook-step-head");
		head.append(
			html("span", "notebook-step-number", t.step(index + 1)),
			html("span", "notebook-kind", t.kinds[step.kind]),
		);
		item.append(frame, head, html("h4", undefined, step.title));
		if (step.rule) {
			const rule = html("p", "notebook-rule");
			rule.append(html("span", undefined, t.rule), ` ${step.rule}`);
			item.append(rule);
		}
		if (step.result) item.append(html("p", "notebook-result", step.result));
		if (step.written.length) {
			const written = html("ul", "notebook-written");
			for (const line of step.written)
				written.append(html("li", undefined, type(line)));
			item.append(written);
		}
		if (step.quote) {
			const quote = html("blockquote", "notebook-quote");
			quote.append(
				html("p", undefined, type(`« ${step.quote.text} »`)),
				html("cite", undefined, step.quote.source),
			);
			item.append(quote);
		}
		if (step.checks.length) {
			const checks = html("ul", "notebook-checks");
			step.checks.forEach((check, i) => {
				const line = html("li", check.passed ? "is-passed" : "is-failed");
				line.style.setProperty("--d", `${0.15 + i * 0.12}s`);
				line.append(
					mark(check.passed, 40 + i),
					html("span", undefined, check.label),
					hidden(check.passed ? t.passed : t.failed),
				);
				checks.append(line);
			});
			item.append(checks);
		}
		if (step.list.length) {
			const list = html("ul", "notebook-list");
			for (const line of step.list) {
				const entry = html("li", undefined, line);
				if (step.node === "escalation") entry.classList.add("is-failed");
				list.append(entry);
			}
			item.append(list);
		}
		if (step.kind === "model") {
			const schema = html("p", "notebook-schema");
			schema.append(mark(step.valid, 70 + index), t.schema(step.schema));
			item.append(schema);
		}
		if (step.node === "consistency") {
			const routes = html("div", "notebook-routes");
			routes.append(html("p", undefined, t.routes));
			const choices = html("ul");
			for (const route of ROUTES) {
				const choice = html("li", undefined, t.outcome[route]);
				choice.dataset.route = route;
				choices.append(choice);
			}
			routes.append(choices);
			item.append(routes);
		}
		item.dataset.failed = String(failed.length);
		return item;
	};

	/** Draws a step's frame to its size: ruled for code, freehand for a model. */
	const frameStep = (item: HTMLElement, seed: number) => {
		const frame = item.querySelector<SVGSVGElement>(".notebook-frame");
		if (!frame) return;
		const w = Math.max(20, item.offsetWidth);
		const h = Math.max(20, item.offsetHeight);
		frame.setAttribute("viewBox", `0 0 ${w} ${h}`);
		const paths = item.classList.contains("is-model")
			? sketchRect(w, h, seed, 3)
			: [`M1.5 1.5H${w - 1.5}V${h - 1.5}H1.5Z`];
		frame.replaceChildren(...strokes(paths, "notebook-stroke"));
	};

	/** The consistency check circles the route it picked, in red pencil. */
	const circleRoute = (item: HTMLElement, route: Outcome) => {
		const choice = item.querySelector<HTMLElement>(
			`.notebook-routes li[data-route="${route}"]`,
		);
		if (!choice) return;
		choice.classList.add("is-taken");
		const svg = document.createElementNS(SVG, "svg");
		svg.setAttribute("class", "notebook-circle");
		svg.setAttribute("aria-hidden", "true");
		const w = choice.offsetWidth + 18;
		const h = choice.offsetHeight + 12;
		svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
		svg.append(...strokes(sketchEllipse(w, h, 5), "notebook-stroke"));
		choice.append(svg);
	};

	const show = (item: HTMLElement) => {
		item.classList.add("is-drawn");
		item.scrollIntoView({
			block: "nearest",
			behavior: hand.reducedMotion ? "auto" : "smooth",
		});
	};

	/**
	 * Draws the recipe of the current file. Narrated: the chef reads each step aloud, and
	 * the notebook waits for him. Otherwise the steps are written one after the other.
	 */
	const draw = async (narrate: boolean) => {
		const current = ++generation;
		voices.stop("chef");
		const alive = () => current === generation && dialog.open;
		const result = recipe(file, lang);
		const round = selected >= 0 && !changed ? rounds[selected] : null;
		stamp.classList.remove("is-stamped");
		stamp.textContent = "";
		steps.replaceChildren();
		const items = result.steps.map((step, i) =>
			stepItem(step, i, result.failed),
		);
		steps.append(...items);
		// Frames are sized once the items are laid out.
		items.forEach((item, i) => {
			frameStep(item, i + 3);
		});
		const speaking = narrate && sound.enabled;
		narrating = speaking;
		replay.textContent = speaking ? t.skip : t.replay;
		if (speaking && alive())
			await voices.say("chef", hand.spoken.open, { plan: "aside" });
		for (const [i, item] of items.entries()) {
			if (!alive()) return;
			show(item);
			const step = result.steps[i];
			if (step.node === "consistency")
				gsap.delayedCall(0.6 + step.checks.length * 0.12, () =>
					circleRoute(item, result.outcome),
				);
			if (speaking)
				await Promise.all([
					voices.say("chef", hand.spoken.nodes[step.node], { plan: "aside" }),
					wait(0.8),
				]);
			else await wait(narrate ? 0.7 : hand.reducedMotion ? 0 : 0.12);
		}
		if (!alive()) return;
		stamp.textContent = t.outcome[result.outcome];
		stamp.classList.add("is-stamped");
		sound.stamp();
		if (speaking && round && alive())
			await voices.say(
				"chef",
				round.choice === result.outcome
					? hand.spoken.same
					: hand.spoken.different,
				{ plan: "aside" },
			);
		if (current === generation) {
			narrating = false;
			replay.textContent = t.replay;
		}
	};

	replay.addEventListener("click", () => {
		if (narrating) {
			// Skip: everything at once, in silence.
			narrating = false;
			void draw(false);
		} else void draw(true);
	});

	let flight: gsap.core.Timeline | null = null;
	const origin = () => {
		const rect = book.getBoundingClientRect();
		const from = hand.chefOnScreen();
		return {
			x: from.x - (rect.left + rect.width / 2),
			y: from.y - (rect.top + rect.height / 2),
		};
	};

	const open = async (evening: NotebookRound[]) => {
		if (opened) return;
		opened = true;
		const active = document.activeElement;
		returnFocus = active instanceof HTMLElement ? active : null;
		rounds = evening.filter((round) => caseOf(round.id));
		renderFiles();
		// The claim worth explaining first: one the visitor got wrong, if any.
		const wrong = rounds.findIndex(
			(round) =>
				round.choice !==
				recipe(caseOf(round.id)?.file ?? defaultFile, lang).outcome,
		);
		select(rounds.length ? Math.max(0, wrong) : -1);
		steps.replaceChildren();
		stamp.textContent = "";
		hand.chef.carry(prop);
		dialog.showModal();
		sound.page();

		const bare = hand.reducedMotion;
		const single = narrow.matches;
		flight?.kill();
		if (bare) {
			gsap.fromTo(book, { opacity: 0 }, { opacity: 1, duration: 0.2 });
		} else {
			const from = origin();
			const tl = gsap.timeline();
			flight = tl;
			tl.fromTo(
				book,
				{ x: from.x, y: from.y, scale: 0.08, rotation: -12, opacity: 0 },
				{
					x: 0,
					y: 0,
					scale: 1,
					rotation: 0,
					opacity: 1,
					duration: 0.6,
					ease: "power3.out",
				},
			);
			if (!single) {
				// The book arrives closed: its cover swings open on the spine.
				tl.set(left, { opacity: 0 }, 0);
				tl.set(cover, { display: "grid", rotationY: 0 }, 0);
				tl.to(
					cover,
					{
						rotationY: -180,
						transformPerspective: 4200,
						duration: 0.7,
						ease: "power2.inOut",
					},
					0.5,
				);
				tl.add(() => sound.page(), 0.7);
				tl.to(left, { opacity: 1, duration: 0.25 }, 0.85);
				tl.set(cover, { display: "none" });
			}
			await tl.then(() => undefined);
		}
		if (!dialog.open) return;
		const first = files.querySelector<HTMLButtonElement>(
			'[aria-pressed="true"]',
		);
		(first ?? close).focus({ preventScroll: true });
		// The first time, the chef reads it out; later, the notebook just writes.
		void draw(!narratedOnce);
		narratedOnce = true;
	};

	const shut = async () => {
		if (!opened) return;
		opened = false;
		generation++;
		narrating = false;
		voices.stop("chef");
		flight?.kill();
		if (!hand.reducedMotion) {
			const from = origin();
			await gsap
				.to(book, {
					x: from.x,
					y: from.y,
					scale: 0.08,
					rotation: -12,
					opacity: 0,
					duration: 0.4,
					ease: "power2.in",
				})
				.then(() => undefined);
		}
		dialog.close();
		gsap.set(book, { clearProps: "transform,opacity" });
		hand.chef.carry(null);
		sound.page();
		returnFocus?.focus({ preventScroll: true });
		hand.onClose();
	};

	close.addEventListener("click", () => void shut());
	// Escape, or a click beside the book, shuts it with its animation.
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
		void shut();
	});
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) void shut();
	});
	full.addEventListener("click", () => voices.stop("chef"));

	return {
		open,
		close: shut,
		get isOpen() {
			return opened;
		},
	};
}

export type Notebook = ReturnType<typeof createNotebook>;
