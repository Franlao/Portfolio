import gsap from "gsap";
import type { Lang, StationGame } from "../types";
import { copy, fr, textFor } from "./copy";
import {
	type Assistant,
	type Audit,
	audit,
	benchStatus,
	type Card,
	type CardVerdict,
	CRITERIA,
	type Criterion,
	deal,
	defaultWeights,
	FAMILIES,
	LETTERS,
	lineUp,
	rank,
	TRAY_SIZE,
	togglePick,
	WEIGHT_MAX,
	type Weights,
} from "./logic";
import "./game.css";

/**
 * « La mise en service » (“Ready for service” in English): compose the tray of an AI service
 * going to production, ring « Service ! » and watch the chef check every card; then weight the criteria
 * of a bench of three fictional code assistants and see the ranking follow.
 */

type Phase = "pick" | "audit" | "verdict" | "bench" | "end";

/** Creates an element. Its text is already final: textFor() typesets the French. */
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function button(className: string, text: string): HTMLButtonElement {
	const node = el("button", className, text);
	node.type = "button";
	return node;
}

/** A service bell, drawn inline: knob, dome and base. */
function bell(): SVGSVGElement {
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("focusable", "false");
	svg.classList.add("g-tools-bell");
	const path = document.createElementNS(ns, "path");
	path.setAttribute("fill", "currentColor");
	path.setAttribute(
		"d",
		"M10.4 6.6a1.6 1.6 0 1 1 3.2 0a1.6 1.6 0 1 1-3.2 0ZM4 16a8 8 0 0 1 16 0ZM2 17.5h20V20H2Z",
	);
	svg.append(path);
	return svg;
}

/** A yellow rules note; its heading takes the focus when its phase starts. */
function note(heading: string, lines: readonly string[]) {
	const box = el("div", "g-tools-note");
	const title = el("h3", undefined, heading);
	title.tabIndex = -1;
	box.append(title, ...lines.map((line) => el("p", undefined, line)));
	return { box, title };
}

const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-GB" };

interface CardView {
	card: Card;
	item: HTMLLIElement;
	pick: HTMLButtonElement;
	chip: HTMLSpanElement;
	verdict: HTMLParagraphElement;
	stamp: HTMLSpanElement;
	reason: HTMLSpanElement;
}

interface SlotView {
	slot: HTMLSpanElement;
	name: HTMLSpanElement;
	mark: HTMLSpanElement;
}

interface WeightView {
	input: HTMLInputElement;
	level: HTMLSpanElement;
	notes: HTMLParagraphElement;
}

interface RowView {
	row: HTMLLIElement;
	rank: HTMLSpanElement;
	score: HTMLSpanElement;
	fills: Map<Criterion, HTMLSpanElement>;
	goal: HTMLSpanElement;
	goalHint: HTMLSpanElement;
}

export const game: StationGame = {
	title: { fr: fr(copy.fr.title), en: copy.en.title },
	intro: { fr: fr(copy.fr.intro), en: copy.en.intro },
	mount(root, context) {
		const { sound, reducedMotion } = context;
		// The same ids and rules in both languages: only the words change.
		const { copy: t, cards } = textFor(context.lang);
		const oneDecimal = new Intl.NumberFormat(LOCALES[context.lang], {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1,
		});
		const say = (text: string) => context.say(text);
		const setText = (node: HTMLElement, text: string) => {
			node.textContent = text;
		};

		// Every tween and timeline goes through track(), so cleanup can kill them all.
		const anims = new Set<gsap.core.Animation>();
		const track = <T extends gsap.core.Animation>(anim: T): T => {
			anims.add(anim);
			return anim;
		};
		const killAnims = () => {
			for (const anim of anims) anim.kill();
			anims.clear();
		};

		let seed = Math.floor(Math.random() * 2 ** 31);
		let phase: Phase = "pick";
		let hand: Card[] = [];
		let picked: string[] = [];
		let result: Audit | null = null;
		let assistants: Assistant[] = [];
		let weights: Weights = defaultWeights();
		const found = new Set<string>();

		const shell = el("div", "g-tools");
		if (reducedMotion) shell.dataset.reduced = "";
		root.append(shell);

		// The CSS reads the phase too: the bar changes layout once the chef has checked.
		const setPhase = (next: Phase) => {
			phase = next;
			shell.dataset.phase = next;
		};

		// Where the visitor is: three steps, the current one marked.
		const steps = el("ol", "g-tools-steps");
		steps.setAttribute("aria-label", t.stepsLabel);
		const stepItems = t.steps.map((label, i) => {
			const item = el("li");
			item.append(el("span", "g-tools-step-n", String(i + 1)), ` ${label}`);
			steps.append(item);
			return item;
		});

		// Part one: the tray.
		const pickPhase = el("section", "g-tools-phase");
		const pickNote = note(t.pick.heading, t.pick.rules);

		const bar = el("div", "g-tools-bar");
		const plate = el("div", "g-tools-plate");
		plate.setAttribute("aria-hidden", "true");
		const slots: SlotView[] = Array.from({ length: TRAY_SIZE }, () => {
			const slot = el("span", "g-tools-slot");
			const name = el("span", "g-tools-slot-name");
			const mark = el("span", "g-tools-slot-mark");
			slot.append(name, mark);
			plate.append(slot);
			return { slot, name, mark };
		});
		const count = el("p", "g-tools-count");
		const service = button("g-tools-service", "");
		service.append(bell(), el("span", undefined, t.pick.service));
		const next = button("g-tools-primary", t.pick.next);
		const action = el("div", "g-tools-action");
		action.append(count, service, next);
		const status = el("p", "g-tools-status");
		status.setAttribute("aria-live", "polite");
		bar.append(plate, action, status);

		const tally = el("ul", "g-tools-tally");
		tally.setAttribute("aria-label", t.pick.tallyLabel);
		const cardList = el("ul", "g-tools-cards");
		cardList.setAttribute("aria-label", t.pick.cardsLabel);
		pickPhase.append(pickNote.box, bar, tally, cardList);

		// Part two: the bench. Sliders on one side, the live ranking on the other.
		const benchPhase = el("section", "g-tools-phase");
		const benchNote = note(t.bench.heading, t.bench.rules);
		const benchGrid = el("div", "g-tools-bench");

		const weightsBox = el("fieldset", "g-tools-weights");
		weightsBox.append(el("legend", undefined, t.bench.weightsLegend));
		const weightViews = new Map<Criterion, WeightView>();
		for (const criterion of CRITERIA) {
			const id = `g-tools-weight-${criterion}`;
			const row = el("div", "g-tools-weight");
			const swatch = el("span", "g-tools-fill g-tools-swatch");
			swatch.dataset.criterion = criterion;
			swatch.setAttribute("aria-hidden", "true");
			const label = el(
				"label",
				"g-tools-weight-name",
				t.bench.criteria[criterion],
			);
			label.htmlFor = id;
			const level = el("span", "g-tools-level");
			level.setAttribute("aria-hidden", "true");
			const input = el("input");
			input.type = "range";
			input.id = id;
			input.min = "0";
			input.max = String(WEIGHT_MAX);
			input.step = "1";
			const notes = el("p", "g-tools-notes");
			notes.id = `${id}-notes`;
			input.setAttribute("aria-describedby", notes.id);
			input.addEventListener("input", () =>
				onWeight(criterion, Number(input.value)),
			);
			row.append(swatch, label, level, input, notes);
			weightsBox.append(row);
			weightViews.set(criterion, { input, level, notes });
		}

		const board = el("div", "g-tools-board");
		const leaderLine = el("p", "g-tools-leader");
		leaderLine.setAttribute("aria-live", "polite");
		const ranking = el("ol", "g-tools-ranking");
		ranking.setAttribute("aria-label", t.bench.rankingLabel);
		const rows = new Map<string, RowView>();
		for (const letter of LETTERS) {
			const row = el("li", "g-tools-row");
			row.dataset.letter = letter;
			const rankNode = el("span", "g-tools-rank");
			const name = el("span", "g-tools-name", t.bench.assistant(letter));
			const meter = el("span", "g-tools-meter");
			meter.setAttribute("aria-hidden", "true");
			const fills = new Map<Criterion, HTMLSpanElement>();
			for (const criterion of CRITERIA) {
				const fill = el("span", "g-tools-fill");
				fill.dataset.criterion = criterion;
				meter.append(fill);
				fills.set(criterion, fill);
			}
			const score = el("span", "g-tools-score");
			// The challenge mark: ✓ once this assistant has led, ○ before.
			const goalCell = el("span", "g-tools-goal");
			const goal = el("span", "g-tools-sym");
			goal.setAttribute("aria-hidden", "true");
			const goalHint = el("span", "g-tools-sr");
			goalCell.append(goal, goalHint);
			row.append(rankNode, name, meter, score, goalCell);
			ranking.append(row);
			rows.set(letter, {
				row,
				rank: rankNode,
				score,
				fills,
				goal,
				goalHint,
			});
		}
		board.append(leaderLine, ranking);
		const benchLine = el("p", "g-tools-bench-status");
		benchLine.setAttribute("aria-live", "polite");
		benchGrid.append(weightsBox, board, benchLine);

		const benchActions = el("div", "g-tools-actions");
		const finish = button("g-tools-primary", t.bench.finish);
		benchActions.append(finish);
		benchPhase.append(benchNote.box, benchGrid, benchActions);

		// The end.
		const endPhase = el("section", "g-tools-phase g-tools-end");
		const endTitle = el("h3", undefined, t.end.heading);
		endTitle.tabIndex = -1;
		const scores = el("ul", "g-tools-scores");
		const trayScore = el("li");
		const benchScore = el("li");
		scores.append(trayScore, benchScore);
		const real = el("div", "g-tools-real");
		real.append(
			el("p", "g-tools-real-tag", t.end.realTag),
			...t.end.real.map((line) => el("p", undefined, line)),
			el("p", "g-tools-real-more", t.end.libraries),
		);
		const endActions = el("div", "g-tools-actions");
		const again = button("g-tools-primary", t.end.again);
		const back = button("g-tools-secondary", t.end.back);
		endActions.append(again, back);
		endPhase.append(
			endTitle,
			scores,
			real,
			el("p", "g-tools-fine", t.end.fiction),
			endActions,
		);

		shell.append(steps, pickPhase, benchPhase, endPhase);

		const showStep = (index: 0 | 1 | 2) => {
			pickPhase.hidden = index !== 0;
			benchPhase.hidden = index !== 1;
			endPhase.hidden = index !== 2;
			stepItems.forEach((item, i) => {
				if (i === index) item.setAttribute("aria-current", "step");
				else item.removeAttribute("aria-current");
			});
		};

		// Part one: picking cards.
		let views = new Map<string, CardView>();

		const renderHand = () => {
			views = new Map();
			cardList.replaceChildren(
				...hand.map((card) => {
					const item = el("li", "g-tools-card");
					const pick = button("g-tools-pick", "");
					pick.setAttribute("aria-pressed", "false");
					const chip = el("span", "g-tools-chip");
					chip.setAttribute("aria-hidden", "true");
					pick.append(
						el("span", "g-tools-family", t.families[card.family]),
						el("span", "g-tools-label", cards[card.id].label),
						chip,
					);
					pick.addEventListener("click", () => onPick(card));
					// The stamp sits on the card's corner, but is read with its reason.
					const verdict = el("p", "g-tools-verdict");
					const stamp = el("span", "g-tools-stamp");
					const reason = el("span", "g-tools-reason");
					verdict.append(stamp, " ", reason);
					verdict.hidden = true;
					item.append(pick, verdict);
					views.set(card.id, {
						card,
						item,
						pick,
						chip,
						verdict,
						stamp,
						reason,
					});
					return item;
				}),
			);
		};

		const renderPicks = (addedId: string | null) => {
			for (const view of views.values()) {
				const on = picked.includes(view.card.id);
				view.pick.setAttribute("aria-pressed", String(on));
				view.item.dataset.picked = String(on);
				setText(view.chip, on ? t.pick.onTray : t.pick.add);
			}
			slots.forEach((slot, i) => {
				const card = i < picked.length ? views.get(picked[i])?.card : undefined;
				slot.slot.dataset.filled = String(card !== undefined);
				slot.slot.removeAttribute("data-right");
				setText(slot.name, card ? cards[card.id].short : "");
				slot.mark.textContent = "";
			});
			setText(count, t.pick.count(picked.length, TRAY_SIZE));
			service.disabled = picked.length < TRAY_SIZE;
			const slot = addedId ? slots[picked.indexOf(addedId)] : undefined;
			if (slot && !reducedMotion) {
				track(
					gsap.fromTo(
						slot.slot,
						{ scale: 0.6 },
						{ scale: 1, duration: 0.3, ease: "back.out(2.5)" },
					),
				);
			}
		};

		const onPick = (card: Card) => {
			if (phase !== "pick") return;
			const outcome = togglePick(picked, card.id);
			if (outcome.change === "full") {
				setText(status, t.pick.full);
				sound.bad();
				if (!reducedMotion) {
					track(
						gsap.fromTo(
							plate,
							{ x: -6 },
							{
								x: 0,
								duration: 0.45,
								ease: "elastic.out(1, 0.3)",
								overwrite: true,
							},
						),
					);
				}
				return;
			}
			picked = outcome.picked;
			sound.pop();
			renderPicks(outcome.change === "added" ? card.id : null);
			const left = TRAY_SIZE - picked.length;
			const head =
				outcome.change === "added"
					? t.pick.added(cards[card.id].short)
					: t.pick.removed(cards[card.id].short);
			setText(
				status,
				`${head} ${left ? t.pick.remaining(left) : t.pick.ready}`,
			);
		};

		// The chef checks one card: stamp, reason, and the mark on its tray slot.
		const reveal = (verdict: CardVerdict, animate: boolean) => {
			const view = views.get(verdict.card.id);
			if (!view) return;
			setText(view.stamp, t.pick.verdicts[verdict.kind]);
			setText(view.reason, cards[verdict.card.id].reason);
			view.verdict.hidden = false;
			view.item.dataset.kind = verdict.kind;
			view.item.dataset.right = String(verdict.right);
			const slot = slots[picked.indexOf(verdict.card.id)];
			if (slot) {
				slot.mark.textContent = verdict.right ? "✓" : "✗";
				slot.slot.dataset.right = String(verdict.right);
			}
			if (!animate) return;
			track(
				gsap.fromTo(
					view.stamp,
					{ scale: 2.2, opacity: 0, rotation: -7 },
					{
						scale: 1,
						opacity: 1,
						rotation: -7,
						duration: 0.24,
						ease: "back.out(2)",
					},
				),
			);
			track(
				gsap.fromTo(view.reason, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
			);
			if (slot) {
				track(
					gsap.fromTo(
						slot.mark,
						{ scale: 2, opacity: 0 },
						{ scale: 1, opacity: 1, duration: 0.22 },
					),
				);
			}
		};

		const renderTally = (checked: Audit) => {
			tally.replaceChildren(
				...FAMILIES.map((family) => {
					const { right, total } = checked.byFamily[family];
					const item = el("li");
					item.dataset.right = String(right === total);
					item.append(
						el("span", "g-tools-sym", right === total ? "✓" : "✗"),
						` ${t.families[family]} ${right} / ${total}`,
					);
					return item;
				}),
			);
			tally.hidden = false;
		};

		const finishAudit = (checked: Audit) => {
			setPhase("verdict");
			setText(count, t.pick.score(checked.right, checked.total));
			count.dataset.final = "";
			setText(
				status,
				checked.served ? t.pick.served : t.pick.refused(checked.traps.length),
			);
			renderTally(checked);
			service.hidden = true;
			next.hidden = false;
			next.focus({ preventScroll: true });
			if (checked.served) {
				sound.good();
				say(t.say.served);
			} else {
				sound.bad();
				const trap = checked.traps.at(0);
				say((trap && cards[trap.id].shout) ?? t.say.refused);
			}
		};

		const onService = () => {
			if (phase !== "pick" || picked.length < TRAY_SIZE) return;
			setPhase("audit");
			const checked = audit(hand, picked);
			result = checked;
			for (const view of views.values()) {
				view.pick.disabled = true;
				view.item.dataset.locked = "";
			}
			service.disabled = true;
			sound.bell();
			setText(status, t.pick.checking);
			if (reducedMotion) {
				for (const verdict of checked.verdicts) reveal(verdict, false);
				sound.stamp();
				finishAudit(checked);
				return;
			}
			// The one big moment: the tray first, slot by slot, then the cards left aside.
			const timeline = track(gsap.timeline({ delay: 0.45 }));
			checked.verdicts.forEach((verdict, i) => {
				timeline.call(
					() => {
						reveal(verdict, true);
						sound.stamp();
					},
					undefined,
					i * 0.26,
				);
			});
			timeline.call(() => finishAudit(checked), undefined, "+=0.45");
		};

		// Part two: the bench.
		const renderWeight = (criterion: Criterion) => {
			const view = weightViews.get(criterion);
			if (!view) return;
			const level = t.bench.levels[weights[criterion]] ?? "";
			view.input.value = String(weights[criterion]);
			view.input.setAttribute("aria-valuetext", level);
			view.level.textContent = level;
		};

		const renderGoals = () => {
			for (const [letter, view] of rows) {
				const done = found.has(letter);
				view.row.dataset.found = String(done);
				view.goal.textContent = done ? "✓" : "○";
				setText(view.goalHint, done ? t.bench.goalFound : t.bench.goalMissing);
			}
		};

		const renderBoard = (byVisitor: boolean) => {
			const standings = rank(assistants, weights);
			const state = benchStatus(weights, standings);

			// Reorder with a FLIP: measure, move in the DOM, then slide from the old place.
			const before = new Map(
				[...rows].map(([letter, view]) => [
					letter,
					view.row.getBoundingClientRect().top,
				]),
			);
			const order = [...ranking.children]
				.map((child) => (child as HTMLElement).dataset.letter)
				.join();
			const moved = order !== standings.map((s) => s.letter).join();
			if (moved) {
				for (const standing of standings) {
					const view = rows.get(standing.letter);
					if (view) ranking.append(view.row);
				}
			}

			standings.forEach((standing, i) => {
				const view = rows.get(standing.letter);
				if (!view) return;
				view.rank.textContent = String(i + 1);
				view.score.replaceChildren(
					oneDecimal.format(standing.score),
					el("span", "g-tools-sr", t.bench.outOf),
				);
				for (const criterion of CRITERIA) {
					const fill = view.fills.get(criterion);
					if (fill) fill.style.width = `${standing.parts[criterion] * 100}%`;
				}
				view.row.dataset.lead = String(
					state.kind === "lead" && state.letter === standing.letter,
				);
				if (moved && byVisitor && !reducedMotion) {
					gsap.set(view.row, { y: 0 });
					const dy =
						(before.get(standing.letter) ?? 0) -
						view.row.getBoundingClientRect().top;
					if (Math.abs(dy) > 1) {
						track(
							gsap.fromTo(
								view.row,
								{ y: dy },
								{ y: 0, duration: 0.35, ease: "power2.out", overwrite: true },
							),
						);
					}
				}
			});

			const line =
				state.kind === "lead"
					? t.bench.lead(state.letter)
					: t.bench[state.kind];
			// Only a change is announced, not every slider step.
			if (leaderLine.textContent !== line) leaderLine.textContent = line;

			if (byVisitor && state.kind === "lead" && !found.has(state.letter)) {
				found.add(state.letter);
				renderGoals();
				sound.good();
				if (found.size === LETTERS.length) {
					setText(benchLine, t.bench.allFound);
					say(t.say.allFound);
				} else {
					setText(
						benchLine,
						t.bench.firstLead(state.letter, found.size, LETTERS.length),
					);
					say(t.say.lead(state.letter));
				}
			}
		};

		const onWeight = (criterion: Criterion, value: number) => {
			if (phase !== "bench") return;
			weights = { ...weights, [criterion]: value };
			renderWeight(criterion);
			renderBoard(true);
		};

		const resetBench = () => {
			weights = defaultWeights();
			found.clear();
			for (const criterion of CRITERIA) {
				renderWeight(criterion);
				const notes = assistants
					.map((a) => `${a.letter} ${a.scores[criterion]}`)
					.join(" · ");
				const view = weightViews.get(criterion);
				if (view) setText(view.notes, t.bench.notes(notes));
			}
			leaderLine.textContent = "";
			setText(benchLine, t.bench.challenge(0, LETTERS.length));
			renderGoals();
			renderBoard(false);
		};

		// Phases.
		const goBench = () => {
			if (phase !== "verdict") return;
			setPhase("bench");
			showStep(1);
			resetBench();
			benchNote.title.focus();
			sound.pop();
			say(t.say.bench);
		};

		const goEnd = () => {
			if (phase !== "bench") return;
			setPhase("end");
			showStep(2);
			const right = result?.right ?? 0;
			const total = result?.total ?? TRAY_SIZE;
			setText(trayScore, t.end.tray(right, total));
			setText(benchScore, t.end.bench(found.size, LETTERS.length));
			endTitle.focus();
			sound.bell();
			say(
				right === total && found.size === LETTERS.length
					? t.say.perfect
					: t.say.end,
			);
		};

		const startRound = (first: boolean) => {
			killAnims();
			hand = deal(seed);
			assistants = lineUp(seed);
			picked = [];
			result = null;
			setPhase("pick");
			renderHand();
			renderPicks(null);
			delete count.dataset.final;
			setText(status, t.pick.start);
			tally.replaceChildren();
			tally.hidden = true;
			service.hidden = false;
			next.hidden = true;
			showStep(0);
			if (!first) {
				pickNote.title.focus();
				sound.pop();
			}
			say(t.say.start);
		};

		service.addEventListener("click", onService);
		next.addEventListener("click", goBench);
		finish.addEventListener("click", goEnd);
		again.addEventListener("click", () => {
			if (phase !== "end") return;
			seed += 1;
			startRound(false);
		});
		back.addEventListener("click", () => context.close());

		startRound(true);

		return () => {
			killAnims();
			// Late clicks on a detached panel must not restart anything.
			phase = "end";
			again.disabled = true;
		};
	},
};
