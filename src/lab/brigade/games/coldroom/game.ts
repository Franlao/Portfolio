import gsap from "gsap";
import type { GameContext, Lang, StationGame } from "../types";
import { COPY, en, fr, typo } from "./copy";
import {
	type Answer,
	endTexts,
	FIELDS,
	feedback,
	modelAnswer,
	modelLine,
	pickReport,
	type Report,
	type Role,
	reportBytes,
	requestExit,
	seeded,
	temptAfter,
	tokenize,
	valueFor,
} from "./logic";
import { REPORTS } from "./reports";
import "./game.css";

/**
 * « Rien ne sort » : the visitor fills a patient sheet by pointing at passages of a fictional
 * report, while a local model fills its own sheet in the same room. Mid-game, an online
 * shortcut tempts the visitor; the door refuses it, and the outgoing byte counter stays at zero.
 */

// Inline drawings, so the game ships no asset. Ligne claire: ink strokes on paper.
const DOOR_SVG = `<svg viewBox="0 0 48 64" focusable="false">
<rect class="cr-frame" x="1.5" y="1.5" width="45" height="61" rx="1"/>
<g class="cr-leaf">
<rect class="cr-leaf-face" x="7" y="5.5" width="35" height="55"/>
<path class="cr-frost" d="M24.5 12v10M20.2 14.5l8.6 5M28.8 14.5l-8.6 5"/>
<rect class="cr-plate" x="32" y="29" width="6" height="13" rx="1"/>
<path class="cr-lever" d="M35 32.5h-9"/>
<circle class="cr-bolt" cx="35" cy="38.5" r="1.3"/>
</g>
<rect class="cr-hinge" x="3.5" y="12" width="5" height="7"/>
<rect class="cr-hinge" x="3.5" y="45" width="5" height="7"/>
</svg>`;

const CLOUD_SVG = `<svg viewBox="0 0 24 16" focusable="false"><path d="M6.5 14.5h11a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.6 5.2 4.6 4.6 0 0 0 6.5 14.5Z"/></svg>`;

const LOCK_SVG = `<svg viewBox="0 0 16 18" focusable="false"><rect x="2" y="8" width="12" height="9" rx="1"/><path d="M5 8V5.5a3 3 0 0 1 6 0V8"/></svg>`;

const ENVELOPE_SVG = `<svg viewBox="0 0 20 14" focusable="false"><rect x="1" y="1" width="18" height="12" rx="1"/><path d="M1.5 1.5 10 8l8.5-6.5" fill="none"/></svg>`;

function drawing(svg: string, className: string): HTMLSpanElement {
	const wrap = document.createElement("span");
	wrap.className = className;
	wrap.setAttribute("aria-hidden", "true");
	// Static markup written above, never visitor input.
	wrap.innerHTML = svg;
	return wrap;
}

/** DOM helpers bound to one language: every string they write gets its typography. */
function toolkit(lang: Lang) {
	const copy = COPY[lang];
	const t = typo[lang];

	const make = <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		className = "",
		text?: string,
	): HTMLElementTagNameMap[K] => {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = t(text);
		return node;
	};

	const makeButton = (className: string, text = ""): HTMLButtonElement => {
		const node = make("button", className, text);
		node.type = "button";
		return node;
	};

	/** ✓ or ✗, with a word for screen readers: the result never rests on the symbol alone. */
	const mark = (right: boolean): HTMLSpanElement => {
		const wrap = make("span", "cr-mark");
		const symbol = make("span", "", right ? "✓" : "✗");
		symbol.setAttribute("aria-hidden", "true");
		wrap.append(
			symbol,
			make("span", "cr-sr", ` ${right ? copy.sheet.right : copy.sheet.wrong}`),
		);
		return wrap;
	};

	return { copy, t, make, makeButton, mark };
}

export const game: StationGame = {
	title: { fr: fr(COPY.fr.title), en: en(COPY.en.title) },
	intro: { fr: fr(COPY.fr.intro), en: en(COPY.en.intro) },
	mount(root, context) {
		// French is the site's default language, should a page ever omit it.
		const lang: Lang = context.lang === "en" ? "en" : "fr";
		// Seeded per visit, so each « Rejouer » deals another report and another moment of temptation.
		const random = seeded(Date.now() % 2 ** 32);
		let previous: string | null = null;
		let stop: () => void = () => {};
		const start = (replay: boolean) => {
			stop();
			const report = pickReport(previous, random, REPORTS[lang]);
			previous = report.id;
			stop = play(root, context, report, temptAfter(random), replay, () =>
				start(true),
			);
		};
		start(false);
		return () => stop();
	},
};

/** One game on one report, in the report's language. Returns its cleanup: every timer and tween it started. */
function play(
	root: HTMLElement,
	context: GameContext,
	report: Report,
	temptAt: number,
	replay: boolean,
	restart: () => void,
): () => void {
	const { sound } = context;
	const { copy, t, make, makeButton, mark } = toolkit(report.lang);
	const still = context.reducedMotion;
	const animations: gsap.core.Animation[] = [];
	const track = <T extends gsap.core.Animation>(animation: T): T => {
		animations.push(animation);
		return animation;
	};
	const say = (text: string) => context.say(t(text));

	const total = FIELDS.length;
	const totalBytes = reportBytes(report);
	const answers: Answer[] = [];
	// Under reduced motion the model has already read everything: no clock to watch.
	const modelReady = FIELDS.map(() => still);
	const revealed = FIELDS.map(() => false);
	/** Passages already in the sheet, with the field they filled. */
	const filed = new Map<Role, number>();
	const startedAt = performance.now();
	let current = 0;
	let seconds = 0;
	let bytesOut = 0;
	let tempted = false;
	let struck: HTMLButtonElement | null = null;

	const shell = make("div", "g-coldroom");
	shell.classList.toggle("is-still", still);
	const live = make("p", "cr-sr");
	live.setAttribute("aria-live", "polite");
	const announce = (text: string) => {
		live.textContent = t(text);
	};

	// The room: the door, what the model read on site, and what left (never anything).
	const room = make("div", "cr-room");
	const door = make("div", "cr-door");
	const doorArt = drawing(DOOR_SVG, "cr-door-art");
	const leaf = doorArt.querySelector<SVGGElement>(".cr-leaf");
	const doorStamp = make("p", "cr-door-stamp", copy.room.stamp);
	doorStamp.setAttribute("aria-hidden", "true");
	door.append(doorArt, doorStamp, make("p", "cr-door-caption", copy.room.door));

	const meters = make("dl", "cr-meters");
	const readWrap = make("div", "cr-meter");
	const readValue = make("dd", "", "0");
	readWrap.append(make("dt", "", copy.room.bytesRead), readValue);
	const outWrap = make("div", "cr-meter cr-meter-out");
	const outValue = make("span", "", "0");
	const outOk = make("span", "cr-out-ok", "✓");
	outOk.setAttribute("aria-hidden", "true");
	const outDd = make("dd");
	outDd.append(outValue, outOk);
	outWrap.append(make("dt", "", copy.room.bytesOut), outDd);
	meters.append(readWrap, outWrap);
	room.append(door, meters);

	// The instructions note, kept in view while the report scrolls under it.
	const grid = make("div", "cr-grid");
	const doc = make("div", "cr-doc");
	const task = make("div", "cr-task");
	const step = make("p", "cr-step");
	const ask = make("p", "cr-ask");
	const hint = make("p", "cr-hint");
	const said = make("div", "cr-said");
	const saidPlayer = make("p", "cr-said-player", copy.task.instruction);
	const saidModel = make("p", "cr-said-model");
	said.append(saidPlayer, saidModel);
	const offer = make("div", "cr-offer");
	offer.hidden = true;
	const reviewButton = makeButton("cr-review-go", copy.task.results);
	reviewButton.hidden = true;
	task.append(step, ask, hint, said, offer, reviewButton);

	// The report: plain text, with every candidate passage as a button.
	const article = make("article", "cr-report");
	article.setAttribute("aria-label", t(copy.reportLabel));
	const head = make("header", "cr-report-head");
	head.append(
		make("p", "cr-report-title", copy.reportTitle),
		make("p", "", `${report.service} · ${report.patient}`),
	);
	article.append(head);
	const passages = new Map<Role, HTMLButtonElement>();
	for (const paragraph of report.paragraphs) {
		const p = make("p");
		for (const token of tokenize(paragraph)) {
			const role = token.role;
			if (!role) {
				p.append(t(token.text));
				continue;
			}
			const passage = makeButton("cr-passage", token.text);
			passage.addEventListener("click", () => choose(role));
			passages.set(role, passage);
			p.append(passage);
		}
		article.append(p);
	}
	doc.append(task, article);

	// The sheet: one row per field, the visitor and the model side by side.
	const sheet = make("section", "cr-sheet");
	const table = make("table", "cr-table");
	const headRow = make("tr");
	for (const [text, className] of [
		[copy.sheet.field, "cr-col-field"],
		[copy.sheet.you, "cr-col-you"],
		[copy.sheet.model, "cr-col-model"],
	]) {
		const th = make("th", className, text);
		th.scope = "col";
		headRow.append(th);
	}
	const thead = make("thead");
	thead.append(headRow);
	const tbody = make("tbody");
	const rows = FIELDS.map((field, i) => {
		const tr = make("tr");
		const th = make("th");
		th.scope = "row";
		const n = make("span", "cr-row-n", String(i + 1));
		n.setAttribute("aria-hidden", "true");
		th.append(n, t(copy.fields[field].label));
		const you = make("td", "cr-you");
		const empty = make("span", "cr-empty", "—");
		empty.setAttribute("aria-hidden", "true");
		you.append(empty, make("span", "cr-sr", copy.sheet.empty));
		const model = make("td", "cr-model");
		tr.append(th, you, model);
		tbody.append(tr);
		return { tr, you, model };
	});
	table.append(thead, tbody);
	sheet.append(
		make("h3", "", copy.sheet.heading),
		make("p", "cr-sheet-note", copy.sheet.note),
		table,
	);

	const end = make("div", "cr-end");
	end.hidden = true;
	grid.append(doc, end, sheet);

	// The report as a file, only seen while it bounces off the door.
	const envelope = make("div", "cr-envelope");
	envelope.setAttribute("aria-hidden", "true");
	envelope.hidden = true;
	envelope.append(
		drawing(ENVELOPE_SVG, "cr-envelope-art"),
		make("span", "", copy.room.envelope(totalBytes)),
	);

	shell.append(room, grid, envelope, live);
	root.replaceChildren(shell);

	const renderModel = (i: number) => {
		if (revealed[i]) return;
		const cell = rows[i].model;
		if (!modelReady[i]) {
			cell.replaceChildren(make("span", "cr-reading", copy.sheet.reading));
			return;
		}
		if (i >= answers.length) {
			// Written, but face down until the visitor answers: the model must not prompt them.
			const masked = make("span", "cr-masked");
			masked.setAttribute("aria-hidden", "true");
			cell.replaceChildren(
				masked,
				make("span", "cr-ready", copy.sheet.ready),
				make("span", "cr-sr", `, ${copy.sheet.hidden}`),
			);
			return;
		}
		revealed[i] = true;
		const guess = modelAnswer(report, FIELDS[i]);
		const value = make("span", "cr-model-val");
		const meta = make("span", "cr-model-meta");
		const confidence = make("span", "cr-conf", copy.percent(guess.confidence));
		confidence.prepend(make("span", "cr-sr", `${copy.sheet.confidence} `));
		meta.append(confidence, mark(guess.right));
		if (guess.review) meta.append(make("span", "cr-review", copy.sheet.review));
		cell.replaceChildren(value, meta);
		const text = t(guess.value);
		if (still) {
			value.textContent = text;
			return;
		}
		// The model writes its answer out, in its blue hand, right after the visitor's.
		gsap.set(meta, { opacity: 0 });
		const typing = { n: 0 };
		track(
			gsap.to(typing, {
				n: text.length,
				duration: Math.min(0.8, 0.12 + text.length * 0.03),
				ease: "none",
				onUpdate: () => {
					value.textContent = text.slice(0, Math.round(typing.n));
				},
				onComplete: () => {
					value.textContent = text;
					track(gsap.to(meta, { opacity: 1, duration: 0.2 }));
				},
			}),
		);
	};

	const modelDone = (i: number) => {
		if (modelReady[i]) return;
		modelReady[i] = true;
		renderModel(i);
		// The visitor was faster on this field: complete the line that said the model was still reading.
		if (i === answers.length - 1) {
			const line = modelLine(report, FIELDS[i], answers[i].role, true);
			saidModel.textContent = t(line);
			announce(line);
		}
	};

	const showField = () => {
		const field = copy.fields[FIELDS[current]];
		step.textContent = t(copy.task.step(current + 1, total));
		ask.textContent = t(field.label);
		hint.textContent = t(field.hint);
		rows.forEach((row, i) => {
			row.tr.dataset.state =
				i < current ? "done" : i === current ? "active" : "todo";
			if (i === current) row.tr.setAttribute("aria-current", "step");
			else row.tr.removeAttribute("aria-current");
		});
	};

	// The model reads the whole report on site, and fills its sheet on its own clock.
	let reading: gsap.core.Tween | null = null;
	if (still) {
		readValue.textContent = t(copy.number(totalBytes));
	} else {
		const counter = { n: 0 };
		const last = report.modelSeconds[report.modelSeconds.length - 1];
		reading = track(
			gsap.to(counter, {
				n: totalBytes,
				duration: last,
				ease: "none",
				onUpdate: () => {
					readValue.textContent = t(copy.number(Math.round(counter.n)));
				},
			}),
		);
		report.modelSeconds.forEach((at, i) => {
			track(gsap.delayedCall(at, () => modelDone(i)));
		});
	}
	for (let i = 0; i < total; i++) renderModel(i);
	showField();

	const fileUnder = (passage: HTMLButtonElement, index: number) => {
		passage.classList.add("is-filed");
		const badge = make("span", "cr-badge", String(index + 1));
		badge.setAttribute("aria-hidden", "true");
		passage.append(badge, make("span", "cr-sr", `, ${copy.sheet.filed}`));
	};

	const choose = (role: Role) => {
		if (current >= total) return;
		const index = current;
		const field = FIELDS[index];
		struck?.classList.remove("is-wrong");
		struck = null;

		const already = filed.get(role);
		if (already !== undefined) {
			const text = copy.task.already(copy.fields[FIELDS[already]].label);
			saidPlayer.textContent = t(text);
			saidModel.textContent = "";
			said.dataset.right = "";
			announce(text);
			sound.pop();
			return;
		}

		const result = feedback(report, field, role, modelReady[index]);
		answers.push({ field, role, right: result.right });
		current++;

		const you = rows[index].you;
		you.replaceChildren(
			make("span", "cr-you-val", valueFor(report, role)),
			mark(result.right),
		);
		if (!result.right) {
			you.append(
				make(
					"span",
					"cr-expected",
					copy.sheet.expected(valueFor(report, field)),
				),
			);
		}

		// In the report, the right passage is filed under its field number; a wrong pick is struck.
		const expected = passages.get(field);
		if (expected) fileUnder(expected, index);
		filed.set(field, index);
		if (!result.right) {
			struck = passages.get(role) ?? null;
			struck?.classList.add("is-wrong");
		}

		saidPlayer.textContent = t(result.player);
		saidModel.textContent = t(result.model);
		said.dataset.right = String(result.right);
		renderModel(index);

		if (result.right) {
			sound.good();
			say(copy.chef.right[index % copy.chef.right.length]);
		} else {
			sound.bad();
			say(copy.chef.wrong[index % copy.chef.wrong.length]);
		}

		let news = "";
		if (current === temptAt && !tempted) {
			showOffer();
			news = ` ${copy.announce.offer}`;
		}
		if (current < total) {
			showField();
			announce(
				`${result.player} ${result.model} ${copy.announce.next(copy.fields[FIELDS[current]].label)}${news}`,
			);
		} else {
			complete();
			announce(`${result.player} ${result.model} ${copy.announce.filled}`);
		}
	};

	// The temptation, and the door that refuses it.
	const tempt = makeButton("cr-tempt");
	tempt.append(
		drawing(CLOUD_SVG, "cr-tempt-art"),
		make("span", "", copy.task.tempt),
	);

	const showOffer = () => {
		offer.replaceChildren(tempt);
		offer.hidden = false;
		if (!still) {
			track(
				gsap.from(offer, {
					y: -6,
					opacity: 0,
					duration: 0.35,
					ease: "back.out(2)",
				}),
			);
		}
	};

	const lock = () => {
		const hadFocus =
			document.activeElement === tempt ||
			document.activeElement === document.body;
		const note = make("p", "cr-locked");
		note.tabIndex = -1;
		note.append(
			drawing(LOCK_SVG, "cr-lock-art"),
			make("span", "", copy.task.locked),
		);
		offer.replaceChildren(note);
		if (hadFocus && !reviewButton.hidden) {
			reviewButton.focus({ preventScroll: true });
		} else if (hadFocus) {
			note.focus({ preventScroll: true });
		}
	};

	/** The one big moment: the report flies to the door, bounces off, and the stamp falls. */
	const slam = () => {
		door.scrollIntoView({ block: "nearest" });
		envelope.hidden = false;
		const base = shell.getBoundingClientRect();
		const from = tempt.getBoundingClientRect();
		const to = doorArt.getBoundingClientRect();
		const w = envelope.offsetWidth;
		const h = envelope.offsetHeight;
		const sx = from.left - base.left + from.width / 2 - w / 2;
		const sy = from.top - base.top + from.height / 2 - h / 2;
		const tx = to.left - base.left + to.width / 2 - w / 2;
		const ty = to.top - base.top + to.height / 2 - h / 2;
		const distance = Math.hypot(sx - tx, sy - ty) || 1;
		const bx = tx + ((sx - tx) / distance) * 70;
		const by = ty + ((sy - ty) / distance) * 70 + 26;

		const timeline = track(
			gsap.timeline({
				onComplete: () => {
					envelope.hidden = true;
					lock();
				},
			}),
		);
		timeline
			.set(envelope, { x: sx, y: sy, opacity: 0, scale: 0.6, rotation: 0 })
			.to(envelope, {
				opacity: 1,
				scale: 1,
				duration: 0.18,
				ease: "back.out(2)",
			})
			.to(envelope, {
				x: tx,
				y: ty,
				rotation: 8,
				duration: 0.5,
				ease: "power2.in",
			})
			.addLabel("hit")
			.call(
				() => {
					sound.stamp();
					doorStamp.classList.add("is-visible");
				},
				undefined,
				"hit",
			)
			.to(
				envelope,
				{ x: bx, y: by, rotation: -24, duration: 0.55, ease: "power2.out" },
				"hit",
			)
			.to(envelope, { opacity: 0, duration: 0.25 }, "hit+=0.35")
			.to(
				outWrap,
				{ scale: 1.1, duration: 0.14, yoyo: true, repeat: 1 },
				"hit+=0.1",
			);
		if (leaf) {
			timeline.to(
				leaf,
				{ x: 1.6, duration: 0.05, repeat: 5, yoyo: true, ease: "none" },
				"hit",
			);
		}
	};

	tempt.addEventListener("click", () => {
		if (tempted) return;
		tempted = true;
		tempt.disabled = true;
		// The request goes through the same door policy as everything else, and gets zero.
		bytesOut += requestExit(totalBytes).bytesOut;
		outValue.textContent = t(copy.number(bytesOut));
		saidPlayer.textContent = t(copy.task.refused);
		saidModel.textContent = t(copy.task.carriesOn);
		said.dataset.right = "";
		announce(copy.announce.refused(bytesOut));
		say(copy.chef.refused);
		if (still) {
			sound.stamp();
			doorStamp.classList.add("is-visible");
			lock();
			return;
		}
		slam();
	});

	const complete = () => {
		seconds = (performance.now() - startedAt) / 1000;
		// A very fast visitor may beat the model's clock: let it finish its sheet now.
		for (let i = 0; i < total; i++) modelDone(i);
		reading?.progress(1);
		for (const row of rows) {
			row.tr.dataset.state = "done";
			row.tr.removeAttribute("aria-current");
		}
		step.textContent = t(copy.task.doneStep);
		ask.textContent = t(copy.task.doneAsk);
		hint.textContent = t(copy.task.doneHint);
		if (!tempted) offer.hidden = true;
		reviewButton.hidden = false;
		reviewButton.focus({ preventScroll: true });
	};

	const showEnd = () => {
		const texts = endTexts(report, answers, seconds, tempted, bytesOut);
		const again = makeButton("cr-again", copy.end.again);
		again.addEventListener("click", restart);
		const back = makeButton("cr-back", copy.end.back);
		back.addEventListener("click", () => context.close());
		const actions = make("div", "cr-actions");
		actions.append(again, back);
		end.replaceChildren(
			make("h3", "", texts.heading),
			make("p", "cr-score", texts.score),
			make("p", "cr-model-line", texts.model),
			make("p", "cr-door-line", texts.door),
			make("p", "cr-lesson", texts.lesson),
			make("p", "cr-real", texts.real),
			make("p", "cr-fiction", texts.fiction),
			actions,
		);
		doc.hidden = true;
		end.hidden = false;
		announce(`${texts.score} ${texts.model} ${texts.door}`);
		say(texts.chef);
		sound.bell();
		end.scrollIntoView({ block: "nearest" });
		again.focus({ preventScroll: true });
	};
	reviewButton.addEventListener("click", showEnd);

	if (replay) {
		room.scrollIntoView({ block: "nearest" });
		passages.values().next().value?.focus({ preventScroll: true });
		say(copy.chef.replay);
	} else {
		say(copy.chef.start);
	}

	return () => {
		for (const animation of animations) animation.kill();
		animations.length = 0;
	};
}
