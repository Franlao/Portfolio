import gsap from "gsap";
import { frTypo } from "../../../../lib/typo";
import type { GameContext, StationGame } from "../types";
import { copy } from "./copy";
import {
	type Crate,
	FILE_NUMBER,
	type Piece,
	type ShelfId,
	shelves,
} from "./data";
import {
	type Check,
	control,
	deal,
	type Filing,
	file,
	initialReserve,
	type NodeId,
	onShelf,
	type Reserve,
	SUMMARY_NODES,
	score,
	seeded,
	shelfById,
} from "./logic";
import "./game.css";

/**
 * « La réserve qui se range seule » : new pieces of a claims file arrive one by one,
 * the visitor puts each on a shelf, and only the summaries above it are rewritten.
 * At the end, three questions are answered from the tree: a misfiled piece cannot be found.
 */

type Phase = "choose" | "filing" | "filed" | "over";
type NodeState = "rewritten" | "untouched" | null;

interface NodeView {
	/** The element that carries the state (a shelf, or the sign on top). */
	frame: HTMLElement;
	badge: HTMLElement;
	summary: HTMLElement;
}

interface ShelfView extends NodeView {
	button: HTMLButtonElement;
	boxes: HTMLUListElement;
}

interface MeterRow {
	cells: HTMLElement;
	count: HTMLElement;
	label: (n: number) => string;
	value: number;
	group: HTMLElement | null;
}

let instances = 0;

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = frTypo(text);
	return node;
}

const pick = <T>(items: T[], index: number): T => items[index % items.length];

function mount(root: HTMLElement, context: GameContext): () => void {
	const { sound, say, close } = context;
	const motion = !context.reducedMotion;
	const prefix = `gd-${++instances}`;

	// Every tween and timeline goes through track(), so the cleanup can stop them all.
	const running = new Set<gsap.core.Animation>();
	const track = <T extends gsap.core.Animation>(animation: T): T => {
		running.add(animation);
		return animation;
	};
	const stopAll = () => {
		for (const animation of running) animation.kill();
		running.clear();
	};

	const game = el("div", "g-delivery");
	game.dataset.motion = motion ? "full" : "reduced";
	const layout = el("div", "gd-layout");

	// The house rules, on a yellow note.
	const note = el("div", "gd-note");
	const rules = el("ul");
	rules.append(...copy.rules.map((rule) => el("li", "", rule)));
	note.append(
		el("h3", "", copy.rulesTitle),
		rules,
		el("p", "gd-legend", copy.legend),
	);

	// The dock: the crate being delivered, then the verdict.
	const dock = el("section", "gd-dock");
	const progress = el("p", "gd-progress");
	progress.id = `${prefix}-progress`;
	dock.setAttribute("aria-labelledby", progress.id);
	const crateCard = el("article", "gd-crate");
	crateCard.tabIndex = -1;
	const crateLabel = el("h3", "gd-crate-label");
	crateLabel.id = `${prefix}-label`;
	const crateExcerpt = el("p", "gd-crate-excerpt");
	crateExcerpt.id = `${prefix}-excerpt`;
	crateCard.setAttribute("aria-labelledby", `${progress.id} ${crateLabel.id}`);
	crateCard.setAttribute("aria-describedby", crateExcerpt.id);
	crateCard.append(
		el("p", "gd-crate-tag", copy.crateTag),
		crateLabel,
		crateExcerpt,
	);

	const status = el("div", "gd-status");
	status.setAttribute("aria-live", "polite");
	const ask = el("p", "gd-ask");
	ask.append(el("span", "", copy.ask), " ", el("span", "gd-keys", copy.keys));
	const writing = el("p", "gd-writing", copy.writing);
	const verdict = el("div", "gd-verdict");
	const verdictHead = el("p", "gd-verdict-head");
	const verdictWhy = el("p", "gd-verdict-why");
	const verdictCost = el("p", "gd-verdict-cost");
	verdict.append(verdictHead, verdictWhy, verdictCost);
	status.append(ask, writing, verdict);
	const next = el("button", "gd-next");
	next.type = "button";
	dock.append(progress, crateCard, status, next);

	// The reserve: the file summary on top, then one shelf per theme.
	const reserveFrame = el("section", "gd-reserve");
	reserveFrame.setAttribute("aria-label", frTypo(copy.reserveLabel));
	const signFrame = el("div", "gd-sign");
	const signBadge = el("span", "gd-state");
	const signTag = el("p", "gd-node-tag");
	signTag.append(el("span", "", copy.fileTag(FILE_NUMBER)), signBadge);
	const signText = el("p", "gd-summary gd-sign-text");
	signFrame.append(signTag, signText);
	const sign: NodeView = {
		frame: signFrame,
		badge: signBadge,
		summary: signText,
	};

	const rack = el("ol", "gd-rack");
	const views = new Map<ShelfId, ShelfView>();
	shelves.forEach((shelf, i) => {
		const frame = el("li", "gd-shelf");
		const button = el("button", "gd-shelf-btn");
		button.type = "button";
		const key = el("kbd", "", String(i + 1));
		key.setAttribute("aria-hidden", "true");
		const name = el("span", "gd-shelf-name");
		name.append(el("span", "gd-sr", `${copy.shelfAction} `), shelf.name);
		button.append(key, name, el("span", "gd-shelf-hint", shelf.hint));
		button.addEventListener("click", () => choose(shelf.id));
		const badge = el("span", "gd-state");
		const tag = el("p", "gd-node-tag");
		tag.append(el("span", "", copy.summaryTag), badge);
		const summary = el("p", "gd-summary");
		const boxes = el("ul", "gd-boxes");
		frame.append(button, tag, summary, boxes);
		rack.append(frame);
		views.set(shelf.id, { frame, badge, summary, button, boxes });
	});
	// The blue line that climbs from the shelf to the top while the model rewrites.
	const lift = el("span", "gd-lift");
	lift.setAttribute("aria-hidden", "true");
	reserveFrame.append(signFrame, rack, lift);

	// The counter: what a full reindex would have cost, against the incremental update.
	const meter = el("section", "gd-meter");
	const meterTitle = el("h3", "gd-meter-title", copy.meterTitle);
	meterTitle.id = `${prefix}-meter`;
	meter.setAttribute("aria-labelledby", meterTitle.id);
	meter.append(meterTitle);
	const meterRow = (
		kind: "full" | "incremental",
		name: string,
		label: (n: number) => string,
	): MeterRow => {
		const row = el("div", "gd-meter-row");
		row.dataset.kind = kind;
		const count = el("p", "gd-meter-count");
		const cells = el("div", "gd-cells");
		cells.setAttribute("aria-hidden", "true");
		row.append(el("p", "gd-meter-name", name), count, cells);
		meter.append(row);
		return { cells, count, label, value: 0, group: null };
	};
	const fullRow = meterRow("full", copy.full, copy.fullCount);
	const incrementalRow = meterRow(
		"incremental",
		copy.incremental,
		copy.incrementalCount,
	);

	// The end: the control questions, then the score.
	const end = el("section", "gd-end");
	end.hidden = true;
	const endTitle = el("h3", "gd-end-title", copy.controlTitle);
	endTitle.tabIndex = -1;
	const checksList = el("ol", "gd-checks");
	const scoreMain = el("p", "gd-score-main");
	const scoreSavings = el("p", "gd-score-savings");
	const again = el("button", "gd-again", copy.again);
	again.type = "button";
	const back = el("button", "gd-back", copy.back);
	back.type = "button";
	const actions = el("div", "gd-end-actions");
	actions.append(again, back);
	const scoreBox = el("div", "gd-score");
	scoreBox.append(
		el("h3", "gd-score-title", copy.endTitle),
		scoreMain,
		scoreSavings,
		el("p", "gd-score-project", copy.project),
		actions,
	);
	end.append(
		endTitle,
		el("p", "gd-end-lead", copy.controlLead),
		checksList,
		scoreBox,
	);

	const live = el("p", "gd-sr");
	live.setAttribute("aria-live", "polite");

	layout.append(note, dock, end, reserveFrame, meter);
	game.append(layout, live);
	root.append(game);

	// Game state.
	let deck: Crate[] = [];
	let index = 0;
	let reserve: Reserve = initialReserve();
	let filings: Filing[] = [];
	let phase: Phase = "choose";
	let liftTarget: HTMLElement | null = null;
	// A rewritten summary can change the height of the sign or of a shelf:
	// the lift follows, so it always joins the shelf to the top.
	const relayout = new ResizeObserver(() => {
		if (liftTarget) placeLift(liftTarget);
	});
	relayout.observe(reserveFrame);
	relayout.observe(signFrame);

	function setPhase(value: Phase) {
		phase = value;
		game.dataset.phase = value;
		for (const view of views.values())
			view.button.disabled = value !== "choose";
	}

	function nodeView(node: NodeId): NodeView {
		return node === "file" ? sign : (views.get(node) as ShelfView);
	}

	function mark(view: NodeView, state: NodeState) {
		if (state) view.frame.dataset.state = state;
		else delete view.frame.dataset.state;
		view.badge.textContent = state
			? frTypo(state === "rewritten" ? copy.rewritten : copy.untouched)
			: "";
	}

	function clearMarks() {
		mark(sign, null);
		for (const view of views.values()) mark(view, null);
		liftTarget = null;
		lift.style.opacity = "0";
	}

	function setSummary(view: NodeView, text: string) {
		view.summary.classList.remove("is-typing");
		view.summary.textContent = frTypo(text);
	}

	/**
	 * Types a summary out, as a model would stream it. The rest of the final text is laid out
	 * but invisible, so the shelf takes its new height at once instead of growing line by line.
	 */
	function typeInto(view: NodeView, text: string): gsap.core.Tween {
		const final = frTypo(text);
		const typed = el("span", "gd-typed");
		const ghost = el("span", "gd-ghost");
		const state = { n: 0 };
		const render = () => {
			const k = Math.round(state.n);
			typed.textContent = final.slice(0, k);
			ghost.textContent = final.slice(k);
		};
		return track(
			gsap.to(state, {
				n: final.length,
				duration: Math.min(0.95, Math.max(0.4, final.length / 170)),
				ease: "none",
				onStart: () => {
					view.summary.classList.add("is-typing");
					view.summary.replaceChildren(typed, ghost);
					render();
				},
				onUpdate: render,
				onComplete: () => setSummary(view, text),
			}),
		);
	}

	/** Stretches the lift from a shelf summary up to the sign. */
	function placeLift(target: HTMLElement) {
		liftTarget = target;
		const frame = reserveFrame.getBoundingClientRect();
		const top = signFrame.getBoundingClientRect().bottom - frame.top;
		const bottom = target.getBoundingClientRect().top + 10 - frame.top;
		lift.style.left = `${rack.getBoundingClientRect().left - frame.left - 1}px`;
		lift.style.top = `${top}px`;
		lift.style.height = `${Math.max(0, bottom - top)}px`;
	}

	function addBox(view: ShelfView, piece: Piece, misfiled: boolean) {
		const box = el("li", "gd-box");
		if (misfiled) {
			box.classList.add("is-misfiled");
			const cross = el("span", "gd-box-mark", copy.no);
			cross.setAttribute("aria-hidden", "true");
			box.append(cross, el("span", "gd-sr", `${copy.misfiled} : `));
		}
		box.append(frTypo(piece.label));
		view.boxes.append(box);
		return box;
	}

	function openGroup(row: MeterRow) {
		row.group = el("span", "gd-cell-group");
		row.cells.append(row.group);
	}

	function addCells(row: MeterRow, n: number) {
		if (!row.group) openGroup(row);
		const cells = Array.from({ length: n }, () => el("span", "gd-cell"));
		row.group?.append(...cells);
		row.value += n;
		row.count.textContent = frTypo(row.label(row.value));
		if (motion) {
			track(
				gsap.from(cells, {
					scale: 0,
					duration: 0.25,
					stagger: 0.05,
					ease: "back.out(3)",
				}),
			);
		}
	}

	function resetMeter(row: MeterRow) {
		row.cells.replaceChildren();
		row.group = null;
		row.value = 0;
		row.count.textContent = frTypo(row.label(0));
	}

	function showCrate() {
		clearMarks();
		const crate = deck[index];
		progress.textContent = frTypo(copy.progress(index + 1, deck.length));
		crateLabel.textContent = frTypo(crate.label);
		crateExcerpt.textContent = frTypo(`« ${crate.excerpt} »`);
		ask.hidden = false;
		writing.hidden = true;
		verdict.hidden = true;
		next.hidden = true;
		setPhase("choose");
		if (motion) {
			track(
				gsap.fromTo(
					crateCard,
					{ x: -40, rotation: -5, opacity: 0 },
					{
						x: 0,
						rotation: 0,
						opacity: 1,
						duration: 0.45,
						ease: "back.out(1.6)",
					},
				),
			);
		}
		crateCard.focus({ preventScroll: true });
	}

	function choose(shelfId: ShelfId) {
		if (phase !== "choose") return;
		setPhase("filing");
		const step = file(reserve, deck[index], shelfId);
		reserve = step.reserve;
		filings.push(step.filing);
		const { rewritten } = step.filing;
		const view = views.get(shelfId) as ShelfView;
		const box = addBox(view, step.filing.crate, !step.filing.right);
		for (const [id, other] of views)
			if (id !== shelfId) mark(other, "untouched");
		openGroup(incrementalRow);
		openGroup(fullRow);
		ask.hidden = true;
		sound.pop();

		if (!motion) {
			for (const node of rewritten) {
				mark(nodeView(node), "rewritten");
				setSummary(nodeView(node), reserve.summaries[node]);
			}
			placeLift(view.summary);
			lift.style.transform = "none";
			lift.style.opacity = "1";
			addCells(incrementalRow, rewritten.length);
			addCells(fullRow, step.filing.fullCost);
			afterFiling(step.filing);
			return;
		}

		writing.hidden = false;
		// The moment of the game: the piece lands, then each summary on its path is rewritten
		// in turn, climbing to the top, while the other shelves stay as they were.
		const tl = track(
			gsap.timeline({ onComplete: () => afterFiling(step.filing) }),
		);
		tl.fromTo(
			box,
			{ y: -28, opacity: 0 },
			{ y: 0, opacity: 1, duration: 0.4, ease: "bounce.out" },
		);
		rewritten.forEach((node, i) => {
			const target = nodeView(node);
			if (i > 0) {
				tl.fromTo(
					lift,
					{ scaleY: 0, opacity: 1 },
					{
						scaleY: 1,
						duration: 0.4,
						ease: "power2.in",
						onStart: () => placeLift(view.summary),
					},
				);
			}
			tl.add(() => mark(target, "rewritten"), i === 0 ? 0.3 : ">");
			tl.add(typeInto(target, reserve.summaries[node]), "<");
			tl.add(() => addCells(incrementalRow, 1));
		});
		tl.add(() => addCells(fullRow, step.filing.fullCost));
		tl.to({}, { duration: 0.25 });
	}

	function afterFiling(filing: Filing) {
		setPhase("filed");
		const home = shelfById(filing.crate.shelf);
		const chosen = shelfById(filing.shelf);
		verdict.dataset.right = String(filing.right);
		verdictHead.replaceChildren(
			el("span", "gd-mark", filing.right ? copy.yes : copy.no),
			` ${frTypo(filing.right ? copy.right : copy.wrong)}`,
		);
		verdictWhy.textContent = frTypo(
			filing.right
				? filing.crate.why
				: `${filing.crate.why} ${copy.belongs(home.name, chosen.name)}`,
		);
		verdictCost.textContent = frTypo(
			copy.cost(
				filing.rewritten.length,
				SUMMARY_NODES - filing.rewritten.length,
			),
		);
		writing.hidden = true;
		verdict.hidden = false;
		next.textContent = frTypo(
			index + 1 >= deck.length ? copy.toControl : copy.next,
		);
		next.hidden = false;
		next.focus({ preventScroll: true });
		if (filing.right) {
			sound.good();
			say(pick(copy.chef.right, index));
		} else {
			sound.bad();
			say(pick(copy.chef.wrong, index));
		}
	}

	function renderCheck(check: Check, i: number, all: Check[]) {
		const item = el("li", "gd-check");
		item.dataset.found = String(check.found);
		const target = shelfById(check.target);
		const path = [
			copy.pathFile,
			target.name,
			check.found ? check.crate.label : copy.pathNothing,
		].join(" → ");
		const stamp = el("p", "gd-check-stamp");
		stamp.append(
			el("span", "gd-mark", check.found ? copy.yes : copy.no),
			` ${frTypo(check.found ? copy.found : copy.missing)}`,
		);
		item.append(
			el("p", "gd-check-kicker", copy.questionNumber(i + 1, all.length)),
			el("p", "gd-check-question", check.crate.question),
			el("p", "gd-check-path", path),
			el("p", "gd-check-reply", `« ${check.reply} »`),
			stamp,
		);
		if (!check.found) {
			item.append(
				el(
					"p",
					"gd-check-why",
					copy.whyMissing(
						check.crate.label,
						target.name,
						shelfById(check.placedIn).name,
					),
				),
			);
		}
		return item;
	}

	function finish() {
		clearMarks();
		setPhase("over");
		const checks = control(reserve, filings);
		const result = score(filings, checks);
		checksList.replaceChildren(...checks.map(renderCheck));
		const summary = `${copy.scoreFiled(result.filed, result.total)} ${copy.scoreFound(result.found, result.asked)}`;
		scoreMain.textContent = frTypo(summary);
		scoreSavings.textContent = frTypo(
			copy.scoreSavings(result.incremental, result.full),
		);
		end.hidden = false;
		live.textContent = frTypo(summary);
		endTitle.focus();
		say(result.found === result.asked ? copy.chef.perfect : copy.chef.holes);

		const rows = [...checksList.children] as HTMLElement[];
		if (!motion) {
			for (const row of rows) row.classList.add("is-stamped");
			sound.bell();
			return;
		}
		// Each answer gets its check stamp in turn, then the bell closes the service.
		const tl = track(gsap.timeline());
		rows.forEach((row, i) => {
			tl.from(row, { opacity: 0, y: 12, duration: 0.3 }, i * 0.45);
			tl.add(
				() => {
					row.classList.add("is-stamped");
					sound.stamp();
				},
				i * 0.45 + 0.3,
			);
		});
		tl.add(() => sound.bell(), "+=0.2");
	}

	function restart() {
		stopAll();
		deck = deal(seeded(Math.floor(Math.random() * 2 ** 32)));
		index = 0;
		filings = [];
		reserve = initialReserve();
		for (const shelf of shelves) {
			const view = views.get(shelf.id) as ShelfView;
			view.boxes.replaceChildren();
			for (const piece of onShelf(reserve.placements, shelf.id)) {
				addBox(view, piece, false);
			}
			setSummary(view, reserve.summaries[shelf.id]);
		}
		setSummary(sign, reserve.summaries.file);
		resetMeter(fullRow);
		resetMeter(incrementalRow);
		checksList.replaceChildren();
		live.textContent = "";
		end.hidden = true;
		showCrate();
	}

	function onKey(event: KeyboardEvent) {
		if (phase !== "choose" || event.altKey || event.ctrlKey || event.metaKey)
			return;
		const target = event.target as HTMLElement | null;
		if (target?.closest?.("input, textarea, select")) return;
		const shelf = shelves[Number(event.key) - 1];
		if (!shelf) return;
		event.preventDefault();
		choose(shelf.id);
	}

	next.addEventListener("click", () => {
		if (phase !== "filed") return;
		index++;
		if (index >= deck.length) finish();
		else showCrate();
	});
	again.addEventListener("click", () => {
		restart();
		say(copy.chef.start);
	});
	back.addEventListener("click", () => close());
	window.addEventListener("keydown", onKey);

	restart();
	say(copy.chef.start);

	return () => {
		stopAll();
		relayout.disconnect();
		window.removeEventListener("keydown", onKey);
	};
}

export const game: StationGame = {
	title: copy.title,
	intro: copy.intro,
	mount,
};
