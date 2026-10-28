import treesUrl from './assets/trees.png';
import { BED_NAMES, explain } from './explain';
import { checkBoard, daily, EMPTY, EPOCH_DATE, generate, Grid, hintFor, impliedMarks, MARK, PRACTICE, TREE, TUTORIAL, type Daily, type Puzzle } from './puzzle';
import { Sounds } from './sounds';
import './styles.css';

export interface GardenPlotResult {
  /** YYYY-MM-DD for the daily puzzle; undefined for practice. */
  dailyKey?: string;
  number?: number;
  size: number;
  timeMs: number;
  /** True if any hint was used. Assisted times don't go on the Staff Board. */
  assisted: boolean;
  hints: number;
  /** Tree column per row, so the server can check it. */
  answer: number[];
  /** Played from the archive after its day. Doesn't count for streaks or the Staff Board. */
  archive?: boolean;
}

export interface GardenPlotOptions {
  /** Makes the daily puzzle unique to a company (e.g. its id). */
  salt?: string;
  /** Override "today" (testing). */
  date?: Date;
  /** Called once per solved puzzle (daily or practice; not the tutorial). */
  onFinish?(result: GardenPlotResult): void;
  /** If set, the menu shows an Exit button. */
  onExit?(): void;
}

type Mode = 'daily' | 'archive' | 'practice' | 'tutorial';
interface DayRecord {
  /** Time in ms of the first solve that day. */
  t: number;
  /** Solved with hints. */
  a: boolean;
}
interface Coach {
  text: string;
  focus?: number[];
  target?: number[];
  /** A button under the text. */
  action?: { label: string; act: string };
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode etc. */
    }
  },
};
const KEY = {
  /** First solve on the day itself. */
  day: (key: string) => `garden-plot:day:${key}`,
  /** First solve of a past day, from the archive. */
  late: (key: string) => `garden-plot:late:${key}`,
  autoX: 'garden-plot:auto-x',
  muted: 'garden-plot:muted',
  toured: 'garden-plot:tutorial-done',
};

/** Shown with the rules on the menu: a solved 4×4. */
const EXAMPLE = { size: 4, beds: [0, 0, 1, 1, 0, 2, 2, 1, 3, 2, 2, 1, 3, 3, 2, 2], trees: [1, 7, 8, 14] };

const TUTORIAL_INTRO =
  "Each colour is a garden bed. Plant one tree in every row, every column and every bed, and trees can't touch, not even at the corners. Tap a square once for ×, twice for a tree. I'll walk you through it.";

/** Mount Garden Plot into `el` (which should have a size, e.g. the full screen). */
export function mountGardenPlot(el: HTMLElement, opts: GardenPlotOptions = {}): { destroy(): void } {
  let today = daily(opts.date ?? new Date(), opts.salt);
  /** Pick up a new day if the app was left open past midnight. */
  const refreshToday = () => {
    if (!opts.date) today = daily(new Date(), opts.salt);
  };
  const sounds = new Sounds();
  sounds.muted = store.get(KEY.muted) === '1';
  let autoX = store.get(KEY.autoX) === '1';

  const root = document.createElement('div');
  root.className = 'gp-root';
  // One sprite sheet of trees; each bed grows its own kind (frame k = bed k).
  root.style.setProperty('--gp-trees', `url("${treesUrl}")`);
  root.innerHTML = `
    <div class="gp-screen" data-screen="menu"></div>
    <div class="gp-game" hidden>
      <div class="gp-bar">
        <button class="gp-icon-btn" data-act="menu" aria-label="Back to menu">←</button>
        <div class="gp-label"></div>
        <span class="gp-assisted" hidden>Assisted</span>
        <div class="gp-time" aria-label="Time">0:00</div>
      </div>
      <div class="gp-status" aria-live="polite"></div>
      <div class="gp-coach" role="status" hidden>
        <span class="gp-coach-icon" aria-hidden="true">💡</span>
        <div style="flex:1;min-width:0">
          <p></p>
          <div class="gp-coach-actions" hidden></div>
        </div>
        <button class="gp-icon-btn" data-act="close-coach" aria-label="Close hint">✕</button>
      </div>
      <div class="gp-board-wrap">
        <div class="gp-board" role="grid" aria-label="Garden plot"></div>
        <button class="gp-paused" data-act="resume" hidden>Paused · tap to keep going</button>
      </div>
      <div class="gp-tools">
        <button class="gp-btn gp-secondary gp-small" data-act="undo">Undo</button>
        <button class="gp-btn gp-secondary gp-small" data-act="clear">Clear</button>
        <button class="gp-btn gp-secondary gp-small gp-hint-btn" data-act="hint">Hint</button>
      </div>
      <div class="gp-chips">
        <button class="gp-chip" data-act="auto-x" aria-pressed="false">Auto-×</button>
        <button class="gp-chip" data-act="mute" aria-pressed="true">Sound</button>
      </div>
    </div>
    <div class="gp-screen" data-screen="results" hidden></div>
    <div class="gp-screen gp-archive" data-screen="archive" hidden></div>
  `;
  el.appendChild(root);

  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
  const menu = $('[data-screen="menu"]');
  const results = $('[data-screen="results"]');
  const archive = $('[data-screen="archive"]');
  const boardWrap = $('.gp-board-wrap');
  const gameEl = $('.gp-game');
  const boardEl = $('.gp-board');
  const labelEl = $('.gp-label');
  const timeEl = $('.gp-time');
  const statusEl = $('.gp-status');
  const assistedEl = $('.gp-assisted');
  const coachEl = $('.gp-coach');
  const coachText = coachEl.querySelector('p')!;
  const coachActions = $('.gp-coach-actions');
  const pausedEl = $('.gp-paused');
  const hintBtn = $('[data-act="hint"]');
  const autoChip = $('[data-act="auto-x"]');
  const soundChip = $('[data-act="mute"]');
  const show = (which: 'menu' | 'game' | 'results' | 'archive') => {
    menu.hidden = which !== 'menu';
    gameEl.hidden = which !== 'game';
    results.hidden = which !== 'results';
    archive.hidden = which !== 'archive';
    root.scrollTop = 0;
  };

  // --- state -------------------------------------------------------------------
  let puzzle!: Puzzle;
  let grid!: Grid;
  let mode: Mode = 'daily';
  /** The daily puzzle being played (today's, or a past one from the archive). */
  let current: Daily = today;
  let archiveMonth = new Date(today.key.slice(0, 7) + '-01T12:00:00');
  /** What the player has actually entered. Auto-× marks are layered on top. */
  let manual: Uint8Array = new Uint8Array(0);
  let cells: HTMLElement[] = [];
  let undo: Uint8Array[] = [];
  let hints = 0;
  let assistArmed = false;
  let coach: Coach | null = null;
  let lastConflicts = 0;
  let elapsed = 0;
  let runningSince = 0;
  let running = false;
  let done = false;
  let timer = 0;

  const readRecord = (k: string): DayRecord | null => {
    try {
      return JSON.parse(store.get(k) ?? 'null') as DayRecord | null;
    } catch {
      return null;
    }
  };
  const dayRecord = (key = today.key) => readRecord(KEY.day(key));
  const lateRecord = (key: string) => readRecord(KEY.late(key));
  const dateOf = (key: string) => new Date(`${key}T12:00:00`);
  const shortDate = (key: string) => dateOf(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  /** Time until the next daily puzzle, e.g. "5h 12m". */
  function untilTomorrow(): string {
    const n = new Date();
    const mins = Math.max(1, Math.ceil((new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime()) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  }

  /** Every day from #1 to today, newest first. */
  function allDays(): Daily[] {
    const out: Daily[] = [];
    for (const d = dateOf(today.key); d >= EPOCH_DATE; d.setDate(d.getDate() - 1)) out.push(daily(d, opts.salt));
    return out;
  }

  /** On-the-day solves without hints, and best times per size. */
  function stats() {
    const days = allDays();
    const solved = days.filter((d) => dayRecord(d.key));
    const best = new Map<number, number>();
    for (const d of solved) {
      const r = dayRecord(d.key)!;
      if (r.a) continue;
      const size = d.options.size;
      best.set(size, Math.min(best.get(size) ?? Infinity, r.t));
    }
    return { played: solved.length, best };
  }
  const now = () => elapsed + (running ? performance.now() - runningSince : 0);
  const startClock = () => {
    if (running || done) return;
    running = true;
    runningSince = performance.now();
  };
  const stopClock = () => {
    if (!running) return;
    elapsed += performance.now() - runningSince;
    running = false;
  };

  /** The board as it looks: the player's entries plus auto-× marks. */
  function effective(): Uint8Array {
    const b = manual.slice();
    if (autoX) for (const i of impliedMarks(grid, manual)) b[i] = MARK;
    return b;
  }

  function streak(): number {
    let n = 0;
    const d = new Date(opts.date ?? new Date());
    if (!dayRecord()) d.setDate(d.getDate() - 1); // today not solved yet: count up to yesterday
    while (dayRecord(daily(d, opts.salt).key)) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  // --- menu --------------------------------------------------------------------
  function borders(i: number, size: number, beds: ArrayLike<number>): string {
    const r = Math.floor(i / size);
    const c = i % size;
    const thick = '2.5px solid var(--gp-line)';
    const thin = '1px solid var(--gp-thin)';
    const top = r === 0 ? 'none' : beds[i] !== beds[i - size] ? thick : thin;
    const left = c === 0 ? 'none' : beds[i] !== beds[i - 1] ? thick : thin;
    return `border-top:${top};border-left:${left}`;
  }

  function exampleHtml(): string {
    const { size, beds, trees } = EXAMPLE;
    const cellsHtml = beds
      .map(
        (b, i) =>
          `<div class="gp-cell${trees.includes(i) ? ' gp-tree' : ''}" style="--bed:var(--bed-${b});${borders(i, size, beds)}">${
            trees.includes(i) ? `<span class="gp-t" style="--k:${b}"></span>` : ''
          }</div>`,
      )
      .join('');
    return `<div class="gp-board gp-example" style="--n:${size}" role="img" aria-label="Example: a solved 4 by 4 plot">${cellsHtml}</div>`;
  }

  function renderMenu() {
    refreshToday();
    const rec = dayRecord();
    const s = streak();
    const toured = store.get(KEY.toured) === '1';
    const todayLine = rec
      ? `Today: solved in <strong>${fmt(rec.t)}</strong>${rec.a ? ' (with hints)' : ''}. Next puzzle in <strong class="gp-countdown">${untilTomorrow()}</strong>.`
      : `Today's plot: <strong>${today.options.size}×${today.options.size}</strong>. Smaller early in the week, bigger by the weekend.`;
    menu.innerHTML = `
      <div>
        <div class="gp-kicker">Daily puzzle #${today.number} · ${today.weekday}</div>
        <h1 class="gp-title">Garden<br><span>Plot</span></h1>
      </div>
      <div class="gp-card gp-rules">
        ${exampleHtml()}
        <div>
          <p class="gp-desc">Plant <strong>one tree</strong> in every row, every column and every colour.</p>
          <p class="gp-desc">Trees <strong>can't touch</strong>, not even at the corners.</p>
        </div>
      </div>
      <div class="gp-note">${todayLine}${s > 1 ? `<br>${s}-day streak 🌱` : ''}</div>
      ${
        toured
          ? `<button class="gp-btn" data-act="daily">${rec ? 'Play today again' : "Play today's puzzle"}</button>
             <div class="gp-pair">
               <button class="gp-btn gp-secondary" data-act="archive">Archive</button>
               <button class="gp-btn gp-secondary" data-act="practice">Practice</button>
             </div>`
          : `<button class="gp-btn" data-act="tutorial">Take the 1-minute tour</button>
             <button class="gp-btn gp-secondary" data-act="daily">${rec ? 'Play today again' : "Play today's puzzle"}</button>`
      }
      <div class="gp-foot">
        <span>Passengers only 🚫🚗</span>
        <span>
          ${toured ? '<button class="gp-link" data-act="tutorial">How to play</button>' : ''}
          ${opts.onExit ? ' · <button class="gp-link" data-act="exit">Exit</button>' : ''}
        </span>
      </div>
    `;
  }

  // --- archive -------------------------------------------------------------------
  function renderArchive() {
    refreshToday();
    const first = new Date(archiveMonth.getFullYear(), archiveMonth.getMonth(), 1, 12);
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const canBack = first > EPOCH_DATE;
    const canNext = new Date(first.getFullYear(), first.getMonth() + 1, 1, 12) <= dateOf(today.key);
    const st = stats();
    const bests = [...st.best.entries()].sort((a, b) => a[0] - b[0]).map(([n, t]) => `${n}×${n} <strong>${fmt(t)}</strong>`);
    const heads = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="gp-cal-head" aria-hidden="true">${d}</div>`).join('');
    const blanks = '<div></div>'.repeat(first.getDay());
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let dayCells = '';
    for (let d = 1; d <= daysIn; d++) {
      const date = new Date(first.getFullYear(), first.getMonth(), d, 12);
      const info = daily(date, opts.salt);
      const future = info.key > today.key;
      const before = date < EPOCH_DATE;
      const rec = dayRecord(info.key);
      const late = lateRecord(info.key);
      const state = rec ? (rec.a ? 'assisted' : 'solved') : late ? 'late' : 'open';
      const label = `${shortDate(info.key)}, puzzle ${info.number}, ${info.options.size} by ${info.options.size}, ${
        rec ? `solved in ${fmt(rec.t)}${rec.a ? ' with hints' : ''}` : late ? `solved later in ${fmt(late.t)}` : future || before ? 'not available' : 'not played'
      }`;
      dayCells +=
        future || before
          ? `<div class="gp-cal-day gp-cal-off" aria-hidden="true">${d}</div>`
          : `<button class="gp-cal-day gp-cal-${state}${info.key === today.key ? ' gp-cal-today' : ''}" data-act="archive-day" data-key="${info.key}" aria-label="${esc(label)}">
               <span>${d}</span>${rec || late ? `<span class="gp-t" style="--k:${info.number % 9}"></span>` : `<small>${info.options.size}×${info.options.size}</small>`}
             </button>`;
    }
    archive.innerHTML = `
      <div class="gp-bar">
        <button class="gp-icon-btn" data-act="menu" aria-label="Back to menu">←</button>
        <div class="gp-label">Archive</div>
      </div>
      <div class="gp-card gp-stats">
        <div><strong>${st.played}</strong> solved on the day${streak() > 1 ? ` · <strong>${streak()}</strong>-day streak` : ''}</div>
        ${bests.length ? `<div>Best: ${bests.join(' · ')}</div>` : '<div>Best times show up here (no-hint solves only).</div>'}
      </div>
      <div class="gp-cal-nav">
        <button class="gp-icon-btn" data-act="archive-month" data-step="-1" aria-label="Previous month" ${canBack ? '' : 'disabled'}>‹</button>
        <div class="gp-cal-month">${monthName}</div>
        <button class="gp-icon-btn" data-act="archive-month" data-step="1" aria-label="Next month" ${canNext ? '' : 'disabled'}>›</button>
      </div>
      <div class="gp-cal">${heads}${blanks}${dayCells}</div>
      <p class="gp-note">Missed a day? Play it here. Catch-up solves don't count for streaks or the Staff Board.</p>
      <div class="gp-legend">
        <span><i class="gp-cal-solved"></i>Solved</span>
        <span><i class="gp-cal-assisted"></i>With hints</span>
        <span><i class="gp-cal-late"></i>Caught up</span>
      </div>
    `;
  }

  // --- game --------------------------------------------------------------------
  function start(p: Puzzle, m: Mode, info: Daily = today) {
    puzzle = p;
    current = info;
    grid = new Grid(p.size, p.beds);
    mode = m;
    manual = new Uint8Array(grid.n);
    undo = [];
    hints = 0;
    assistArmed = false;
    lastConflicts = 0;
    elapsed = 0;
    done = false;
    labelEl.textContent =
      m === 'daily'
        ? `#${today.number} · ${today.weekday}`
        : m === 'archive'
          ? `#${info.number} · ${shortDate(info.key)}`
          : m === 'practice'
            ? `Practice · ${p.size}×${p.size}`
            : 'How to play';
    timeEl.hidden = m === 'tutorial';
    hintBtn.hidden = m === 'tutorial';
    assistedEl.hidden = true;
    boardEl.style.setProperty('--n', String(p.size));
    boardEl.classList.remove('gp-solved', 'gp-hidden');
    boardEl.innerHTML = [...p.beds]
      .map(
        (b, i) =>
          `<div class="gp-cell" role="gridcell" data-i="${i}" aria-label="Row ${grid.row(i) + 1}, column ${grid.col(i) + 1}, ${BED_NAMES[b]} bed" style="--bed:var(--bed-${b});${borders(
            i,
            p.size,
            p.beds,
          )}"><span class="gp-x" aria-hidden="true">×</span><span class="gp-t" style="--k:${b}"></span></div>`,
      )
      .join('');
    cells = [...boardEl.querySelectorAll<HTMLElement>('.gp-cell')];
    pausedEl.hidden = true;
    coach = m === 'tutorial' ? { text: TUTORIAL_INTRO, action: { label: "Let's go", act: 'coach-next' } } : null;
    show('game');
    render();
    startClock();
    clearInterval(timer);
    timeEl.textContent = '0:00';
    timer = window.setInterval(() => (timeEl.textContent = fmt(now())), 250);
  }

  /** In the tutorial the coach always shows the next step. */
  function tutorialCoach() {
    const h = hintFor(puzzle, effective());
    if (!h) return;
    const e = explain(h, grid);
    coach = { text: e.text, focus: e.focus, target: e.target };
  }

  function render(fresh?: number) {
    const eff = effective();
    const check = checkBoard(puzzle, eff);
    const focus = new Set(coach?.focus ?? []);
    const target = new Set(coach?.target ?? []);
    cells.forEach((cell, i) => {
      const cl = cell.classList;
      cl.toggle('gp-mark', eff[i] === MARK);
      cl.toggle('gp-auto', eff[i] === MARK && manual[i] !== MARK);
      cl.toggle('gp-tree', eff[i] === TREE);
      cl.toggle('gp-bad', check.conflicts.has(i));
      cl.toggle('gp-focus', focus.has(i));
      cl.toggle('gp-target', target.has(i));
      if (i === fresh && eff[i] === TREE) {
        cl.remove('gp-pop');
        void cell.offsetWidth;
        cl.add('gp-pop');
      }
    });
    statusEl.textContent = check.conflicts.size ? 'Some trees break the rules (shown striped).' : `${check.trees} of ${puzzle.size} trees planted`;
    statusEl.classList.toggle('gp-warn', check.conflicts.size > 0);
    if (check.conflicts.size > lastConflicts) sounds.oops();
    lastConflicts = check.conflicts.size;

    coachEl.hidden = !coach;
    if (coach) {
      coachText.textContent = coach.text;
      coachActions.hidden = !coach.action;
      coachActions.innerHTML = coach.action ? `<button class="gp-btn" data-act="${coach.action.act}">${esc(coach.action.label)}</button>` : '';
    }
    autoChip.setAttribute('aria-pressed', String(autoX));
    soundChip.setAttribute('aria-pressed', String(!sounds.muted));
    assistedEl.hidden = !(mode === 'daily' && hints > 0);
    if (check.solved) win();
  }

  /** After the player changes the board. */
  function changed(fresh?: number) {
    if (mode === 'tutorial') tutorialCoach();
    else coach = null; // a shown hint is about the old board
    render(fresh);
  }

  function snapshot() {
    undo.push(manual.slice());
    if (undo.length > 300) undo.shift();
  }

  // Tap cycles empty → × → tree → empty. Dragging paints × on empty squares
  // (or rubs × out, if the drag started on one). Trees are never dragged over.
  let drag: { start: number; last: number; mode: 'mark' | 'erase' | null; moved: boolean; id: number } | undefined;
  const cellAt = (x: number, y: number) => {
    const c = document.elementFromPoint(x, y)?.closest<HTMLElement>('.gp-cell');
    return c && boardEl.contains(c) ? Number(c.dataset.i) : -1;
  };
  const paint = (i: number, eff: Uint8Array) => {
    if (drag!.mode === 'mark' && eff[i] === EMPTY) manual[i] = MARK;
    else if (drag!.mode === 'erase' && manual[i] === MARK) manual[i] = EMPTY;
  };
  boardEl.addEventListener('pointerdown', (e) => {
    sounds.wake();
    if (done || !running) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    const eff = effective();
    drag = { start: i, last: i, mode: eff[i] === EMPTY ? 'mark' : manual[i] === MARK ? 'erase' : null, moved: false, id: e.pointerId };
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === drag.last) return;
    const eff = effective();
    if (!drag.moved) {
      drag.moved = true;
      snapshot();
      paint(drag.start, eff);
    }
    drag.last = i;
    paint(i, eff);
    if (drag.mode) sounds.mark();
    changed();
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && e.type === 'pointerup') {
      const i = drag.start;
      const was = effective()[i];
      snapshot();
      manual[i] = was === EMPTY ? MARK : was === MARK ? TREE : EMPTY;
      if (manual[i] === TREE) sounds.plant();
      else if (manual[i] === MARK) sounds.mark();
      changed(i);
    }
    drag = undefined;
  };
  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', endDrag);

  function useHint() {
    if (done || !running) return;
    const counts = mode === 'daily' && !dayRecord();
    if (counts && hints === 0 && !assistArmed) {
      assistArmed = true;
      coach = { text: "A hint marks today's time as assisted, so it won't go on the Staff Board. Tap Hint again if you'd like one." };
      render();
      return;
    }
    const h = hintFor(puzzle, effective());
    if (!h) return;
    hints++;
    const e = explain(h, grid);
    coach = { text: e.text, focus: e.focus, target: e.target };
    sounds.hint();
    render();
  }

  function share(text: string, button: HTMLElement) {
    const done = (label: string) => {
      button.textContent = label;
      setTimeout(() => (button.textContent = 'Share result'), 2000);
    };
    const manualCopy = () => {
      const ta = results.querySelector<HTMLTextAreaElement>('.gp-share-text')!;
      ta.hidden = false;
      ta.focus();
      ta.select();
      done('Copy the text below');
    };
    const copy = () =>
      navigator.clipboard
        ? navigator.clipboard.writeText(text).then(() => done('Copied!'), manualCopy)
        : manualCopy();
    if (navigator.share) {
      navigator.share({ text }).catch((err: DOMException) => {
        if (err?.name !== 'AbortError') void copy();
      });
    } else {
      void copy();
    }
  }

  function win() {
    if (done) return;
    done = true;
    stopClock();
    clearInterval(timer);
    coach = null;
    coachEl.hidden = true;
    const p = puzzle;
    const timeMs = Math.round(elapsed);
    timeEl.textContent = fmt(timeMs);
    p.solution.forEach((c, r) => {
      const cell = cells[r * p.size + c];
      cell.style.animationDelay = `${r * 70}ms`;
      cell.classList.remove('gp-pop', 'gp-focus', 'gp-target');
      void cell.offsetWidth;
      cell.classList.add('gp-pop');
    });
    boardEl.classList.add('gp-solved');
    statusEl.textContent = 'Planted!';
    sounds.solved();
    fallingLeaves();

    if (mode === 'tutorial') {
      store.set(KEY.toured, '1');
      results.innerHTML = `
        <div class="gp-kicker">How to play</div>
        <h1 class="gp-title">You're<br><span>ready</span></h1>
        <p class="gp-desc">That's the whole game. The daily puzzles get bigger through the week, and when you're stuck, <strong>Hint</strong> explains the next step.</p>
        <button class="gp-btn" data-act="daily">Play today's puzzle</button>
        <button class="gp-btn gp-secondary" data-act="menu">Menu</button>
      `;
      setTimeout(() => show('results'), 1300);
      return;
    }

    const assisted = hints > 0;
    const key = current.key;
    let first = false;
    if (mode === 'daily' && !dayRecord(key)) {
      store.set(KEY.day(key), JSON.stringify({ t: timeMs, a: assisted } satisfies DayRecord));
      first = true;
    } else if (mode === 'archive' && !dayRecord(key) && !lateRecord(key)) {
      store.set(KEY.late(key), JSON.stringify({ t: timeMs, a: assisted } satisfies DayRecord));
    }
    const isDay = mode === 'daily' || mode === 'archive';
    opts.onFinish?.({
      dailyKey: isDay ? key : undefined,
      number: isDay ? current.number : undefined,
      size: p.size,
      timeMs,
      assisted,
      hints,
      answer: [...p.solution],
      ...(mode === 'archive' ? { archive: true } : {}),
    });

    const rec = dayRecord(key);
    const s = streak();
    const withHints = `${hints} hint${hints > 1 ? 's' : ''}`;
    let note: string;
    if (mode === 'practice') note = assisted ? `Solved with ${withHints}. Practice is just for fun.` : 'Practice puzzles are just for fun.';
    else if (mode === 'archive') note = "Caught up! Catch-up solves don't count for streaks or the Staff Board.";
    else if (!first) note = `Replays don't change today's time (<strong>${fmt(rec!.t)}</strong>${rec!.a ? ', with hints' : ''}).`;
    else if (assisted) note = `Solved with ${withHints}, so this one stays off the Staff Board. Try tomorrow's without!`;
    else note = "That's today's time.";
    if (mode === 'daily' && s > 1) note += `<br>${s}-day streak 🌱`;

    const shareText =
      mode === 'daily'
        ? [`Garden Plot #${today.number} · ${p.size}×${p.size}`, rec!.a ? `🌱 Solved with hints in ${fmt(rec!.t)}` : `🌳 Solved in ${fmt(rec!.t)}`, ...(s > 1 ? [`🔥 ${s}-day streak`] : [])].join('\n')
        : '';
    const kicker =
      mode === 'daily' ? `Garden Plot #${today.number} · ${p.size}×${p.size}` : mode === 'archive' ? `Garden Plot #${current.number} · ${shortDate(key)}` : `Practice · ${p.size}×${p.size}`;
    results.innerHTML = `
      <div class="gp-kicker">${kicker}</div>
      <h1 class="gp-title">Planted<span>!</span></h1>
      ${assisted ? '<div class="gp-badge">With hints</div>' : ''}
      <div class="gp-result-time">${fmt(timeMs)}</div>
      <div class="gp-note">${note}</div>
      ${
        mode === 'daily'
          ? `<button class="gp-btn" data-act="share">Share result</button>
             <textarea class="gp-share-text" readonly hidden aria-label="Result to copy">${esc(shareText)}</textarea>
             <button class="gp-btn gp-secondary" data-act="practice">Practice puzzle</button>`
          : mode === 'archive'
            ? `<button class="gp-btn" data-act="archive">Back to the archive</button>`
            : `<button class="gp-btn" data-act="practice">Another practice puzzle</button>`
      }
      <button class="gp-btn gp-secondary" data-act="menu">Menu</button>
    `;
    results.dataset.share = shareText;
    setTimeout(() => show('results'), 1400);
  }

  /** A short shower of autumn leaves over the plot. */
  function fallingLeaves() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const colours = ['#d9822b', '#c0392b', '#e5b52b', '#8fbf4a', '#a0522d'];
    for (let k = 0; k < 26; k++) {
      const leaf = document.createElement('i');
      leaf.className = 'gp-leaf';
      leaf.style.left = `${Math.random() * 100}%`;
      leaf.style.background = colours[k % colours.length];
      leaf.style.animationDelay = `${Math.random() * 0.6}s`;
      leaf.style.animationDuration = `${1.4 + Math.random() * 0.9}s`;
      leaf.style.setProperty('--drift', `${(Math.random() * 2 - 1) * 60}px`);
      leaf.style.setProperty('--spin', `${(Math.random() * 2 - 1) * 540}deg`);
      boardWrap.appendChild(leaf);
      setTimeout(() => leaf.remove(), 2600);
    }
  }

  function pause() {
    if (!running || done) return;
    stopClock();
    boardEl.classList.add('gp-hidden'); // no peeking while the clock is stopped
    pausedEl.hidden = false;
  }

  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    sounds.wake();
    switch (t.dataset.act) {
      case 'daily':
        refreshToday();
        start(generate(today.seed, today.options), 'daily', today);
        break;
      case 'archive':
        stopClock();
        clearInterval(timer);
        renderArchive();
        show('archive');
        break;
      case 'archive-month':
        archiveMonth = new Date(archiveMonth.getFullYear(), archiveMonth.getMonth() + Number(t.dataset.step), 1, 12);
        renderArchive();
        break;
      case 'archive-day': {
        const info = daily(dateOf(t.dataset.key!), opts.salt);
        start(generate(info.seed, info.options), info.key === today.key ? 'daily' : 'archive', info);
        break;
      }
      case 'practice':
        start(generate((Math.random() * 2 ** 32) >>> 0, PRACTICE), 'practice');
        break;
      case 'tutorial':
        start(generate(TUTORIAL.seed, TUTORIAL.options), 'tutorial');
        break;
      case 'coach-next':
        tutorialCoach();
        render();
        break;
      case 'close-coach':
        if (mode === 'tutorial') return;
        coach = null;
        render();
        break;
      case 'hint':
        useHint();
        break;
      case 'undo':
        if (!done && running && undo.length) {
          manual = undo.pop()!;
          changed();
        }
        break;
      case 'clear':
        if (!done && running && manual.some((v) => v !== EMPTY)) {
          snapshot();
          manual.fill(EMPTY);
          changed();
        }
        break;
      case 'auto-x':
        autoX = !autoX;
        store.set(KEY.autoX, autoX ? '1' : '0');
        if (puzzle && !done) changed();
        break;
      case 'mute':
        sounds.muted = !sounds.muted;
        store.set(KEY.muted, sounds.muted ? '1' : '0');
        if (puzzle) render();
        break;
      case 'share':
        share(results.dataset.share ?? '', t);
        break;
      case 'resume':
        pausedEl.hidden = true;
        boardEl.classList.remove('gp-hidden');
        startClock();
        break;
      case 'menu':
        stopClock();
        clearInterval(timer);
        renderMenu();
        show('menu');
        break;
      case 'exit':
        opts.onExit?.();
        break;
    }
  });
  const onVisibility = () => {
    if (document.hidden) pause();
    else if (!menu.hidden) renderMenu(); // may be a new day
  };
  const tick = window.setInterval(() => {
    const el = menu.querySelector('.gp-countdown');
    if (el && !menu.hidden) el.textContent = untilTomorrow();
  }, 30000);
  document.addEventListener('visibilitychange', onVisibility);
  if (import.meta.env.DEV) (window as unknown as { __gp: unknown }).__gp = { get puzzle() { return puzzle; } };

  renderMenu();
  show('menu');

  return {
    destroy() {
      clearInterval(timer);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    },
  };
}
