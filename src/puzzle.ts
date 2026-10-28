/**
 * Garden Plot puzzles: plant one tree in every row, every column and every
 * garden bed, and no two trees may touch, not even diagonally.
 *
 * Puzzles come from a seed, so a date gives everyone the same daily puzzle.
 * Every puzzle has exactly one solution and can be solved one logical step
 * at a time. The same steps power the hints and the tutorial.
 */
import { createRng, type Rng } from './rng';

export interface Puzzle {
  size: number;
  /** Garden bed id (0..size-1) per cell, row-major. */
  beds: Uint8Array;
  /** The solution: tree column for each row. */
  solution: Uint8Array;
  /** Hardest step needed: 1 easy … 4 hard. */
  level: number;
}

/** Cell states on a player's board. */
export const EMPTY = 0;
export const MARK = 1;
export const TREE = 2;

export type UnitRef = { kind: 'row' | 'col' | 'bed'; index: number };

/**
 * One logical step, from easiest to hardest:
 *   0 implied      squares in line with, in the bed of, or touching a tree are out
 *   1 single       a row, column or bed has one open square left: it gets the tree
 *   2 bed-in-line  a bed fits in one row (or column): the rest of that row is out
 *   2 line-in-bed  a row's open squares are all in one bed: the rest of that bed is out
 *   2 touch-all    a square touching every open square of a row/column/bed is out
 *   3 squeeze      N beds fit in N rows (or columns): the rest of those rows is out
 *   4 what-if      planting here would leave some row/column/bed with no room: out
 */
export type Step =
  | { kind: 'implied'; level: 0; trees: number[]; eliminate: number[] }
  | { kind: 'single'; level: 1; unit: UnitRef; place: number }
  | { kind: 'bed-in-line'; level: 2; bed: UnitRef; line: UnitRef; eliminate: number[] }
  | { kind: 'line-in-bed'; level: 2; line: UnitRef; bed: UnitRef; eliminate: number[] }
  | { kind: 'touch-all'; level: 2; unit: UnitRef; eliminate: number[] }
  | { kind: 'squeeze'; level: 3; units: UnitRef[]; into: UnitRef[]; eliminate: number[] }
  | { kind: 'what-if'; level: 4; cell: number; emptied: UnitRef; eliminate: number[] };

// --- grid helpers ----------------------------------------------------------------

interface Unit {
  ref: UnitRef;
  cells: number[];
}

/** Precomputed rows, columns and beds of a puzzle. */
export class Grid {
  readonly n: number;
  readonly rows: Unit[];
  readonly cols: Unit[];
  readonly bedUnits: Unit[];
  readonly all: Unit[];

  constructor(
    readonly size: number,
    readonly beds: Uint8Array,
  ) {
    this.n = size * size;
    const idx = [...Array(size).keys()];
    this.rows = idx.map((r) => ({ ref: { kind: 'row', index: r }, cells: idx.map((c) => r * size + c) }));
    this.cols = idx.map((c) => ({ ref: { kind: 'col', index: c }, cells: idx.map((r) => r * size + c) }));
    this.bedUnits = idx.map((b) => ({ ref: { kind: 'bed', index: b }, cells: [...Array(this.n).keys()].filter((i) => beds[i] === b) }));
    this.all = [...this.rows, ...this.cols, ...this.bedUnits];
  }

  row(i: number) {
    return Math.floor(i / this.size);
  }
  col(i: number) {
    return i % this.size;
  }
  unit(ref: UnitRef): Unit {
    return ref.kind === 'row' ? this.rows[ref.index] : ref.kind === 'col' ? this.cols[ref.index] : this.bedUnits[ref.index];
  }
  /** Do trees at a and b break a rule? */
  clash(a: number, b: number): boolean {
    if (a === b) return false;
    const ra = this.row(a);
    const rb = this.row(b);
    const ca = this.col(a);
    const cb = this.col(b);
    return ra === rb || ca === cb || this.beds[a] === this.beds[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1);
  }
}

/** Solver state: `open` = could still hold a tree; `tree` = has one. */
export interface State {
  open: Uint8Array;
  tree: Uint8Array;
}

function plant(g: Grid, s: State, i: number): void {
  s.tree[i] = 1;
  s.open[i] = 0;
  for (let j = 0; j < g.n; j++) if (s.open[j] && g.clash(i, j)) s.open[j] = 0;
}

const done = (s: State, u: Unit) => u.cells.some((i) => s.tree[i]);
const openIn = (s: State, u: Unit) => u.cells.filter((i) => s.open[i]);

/** A row, column or bed with no tree and no open square left, if any. */
function deadEnd(g: Grid, s: State): UnitRef | null {
  for (const u of g.all) if (!done(s, u) && openIn(s, u).length === 0) return u.ref;
  return null;
}

/** Apply singles until none are left. Returns the unit that ran out of room, if any. */
function propagate(g: Grid, s: State): UnitRef | null {
  for (let again = true; again; ) {
    again = false;
    for (const u of g.all) {
      if (done(s, u)) continue;
      const spots = openIn(s, u);
      if (spots.length === 0) return u.ref;
      if (spots.length === 1) {
        plant(g, s, spots[0]);
        again = true;
      }
    }
  }
  return null;
}

/** The easiest next step from this state, or null if stuck (or solved). */
export function nextStep(g: Grid, s: State): Step | null {
  // 1: singles
  for (const u of g.all) {
    if (done(s, u)) continue;
    const spots = openIn(s, u);
    if (spots.length === 1) return { kind: 'single', level: 1, unit: u.ref, place: spots[0] };
  }

  // 2: a bed confined to one line, or a line confined to one bed
  for (const bed of g.bedUnits) {
    if (done(s, bed)) continue;
    const spots = openIn(s, bed);
    for (const lines of [g.rows, g.cols]) {
      const keys = new Set(spots.map((i) => (lines === g.rows ? g.row(i) : g.col(i))));
      if (keys.size !== 1) continue;
      const line = lines[[...keys][0]];
      const out = line.cells.filter((i) => s.open[i] && g.beds[i] !== bed.ref.index);
      if (out.length) return { kind: 'bed-in-line', level: 2, bed: bed.ref, line: line.ref, eliminate: out };
    }
  }
  for (const line of [...g.rows, ...g.cols]) {
    if (done(s, line)) continue;
    const spots = openIn(s, line);
    const beds = new Set(spots.map((i) => g.beds[i]));
    if (beds.size !== 1) continue;
    const bed = g.bedUnits[[...beds][0]];
    const out = bed.cells.filter((i) => s.open[i] && !line.cells.includes(i));
    if (out.length) return { kind: 'line-in-bed', level: 2, line: line.ref, bed: bed.ref, eliminate: out };
  }
  // 2: a square that touches every open square of a unit
  for (const u of g.all) {
    if (done(s, u)) continue;
    const spots = openIn(s, u);
    if (spots.length === 0) continue;
    const r0 = g.row(spots[0]);
    const c0 = g.col(spots[0]);
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = r0 + dr;
        const c = c0 + dc;
        if (r < 0 || c < 0 || r >= g.size || c >= g.size) continue;
        const x = r * g.size + c;
        if (!s.open[x] || u.cells.includes(x)) continue;
        if (spots.every((sp) => Math.abs(g.row(sp) - r) <= 1 && Math.abs(g.col(sp) - c) <= 1)) out.push(x);
      }
    }
    if (out.length) return { kind: 'touch-all', level: 2, unit: u.ref, eliminate: out };
  }

  // 3: N units squeezed into N of another kind
  const pairs: [Unit[], (i: number) => number, Unit[]][] = [
    [g.bedUnits, (i) => g.row(i), g.rows],
    [g.bedUnits, (i) => g.col(i), g.cols],
    [g.rows, (i) => g.beds[i], g.bedUnits],
    [g.cols, (i) => g.beds[i], g.bedUnits],
  ];
  for (const [sets, key, targets] of pairs) {
    const live = sets.filter((u) => !done(s, u));
    for (let mask = 1; mask < 1 << live.length; mask++) {
      const k = popcount(mask);
      if (k < 2 || k >= live.length) continue;
      const chosen = live.filter((_, j) => mask & (1 << j));
      const keys = new Set(chosen.flatMap((u) => openIn(s, u)).map(key));
      if (keys.size !== k) continue;
      const inside = new Set(chosen.flatMap((u) => u.cells));
      const into = [...keys].sort((a, b) => a - b).map((x) => targets[x]);
      const out = into.flatMap((t) => t.cells).filter((i) => s.open[i] && !inside.has(i));
      if (out.length) return { kind: 'squeeze', level: 3, units: chosen.map((u) => u.ref), into: into.map((t) => t.ref), eliminate: out };
    }
  }

  // 4: what if a tree went here?
  for (let i = 0; i < g.n; i++) {
    if (!s.open[i]) continue;
    const t: State = { open: s.open.slice(), tree: s.tree.slice() };
    plant(g, t, i);
    const emptied = deadEnd(g, t) ?? propagate(g, t);
    if (emptied) return { kind: 'what-if', level: 4, cell: i, emptied, eliminate: [i] };
  }
  return null;
}

export function applyStep(g: Grid, s: State, step: Step): void {
  if (step.kind === 'single') plant(g, s, step.place);
  else for (const i of step.eliminate) s.open[i] = 0;
}

function popcount(x: number): number {
  let c = 0;
  for (; x; x &= x - 1) c++;
  return c;
}

/** Solve step by step like a person would. `level` = hardest step needed. */
export function logicSolve(size: number, beds: Uint8Array): { solved: boolean; level: number } {
  const g = new Grid(size, beds);
  const s: State = { open: new Uint8Array(g.n).fill(1), tree: new Uint8Array(g.n) };
  let level = 1;
  for (;;) {
    if (s.tree.reduce((a, v) => a + v, 0) === size) return { solved: true, level };
    if (deadEnd(g, s)) return { solved: false, level };
    const step = nextStep(g, s);
    if (!step) return { solved: false, level };
    level = Math.max(level, step.level);
    applyStep(g, s, step);
  }
}

// --- hints from a player's board --------------------------------------------------

export type Hint =
  | Step
  | { kind: 'wrong-tree'; level: -1; cell: number }
  | { kind: 'wrong-mark'; level: -1; cell: number }
  | { kind: 'reveal'; level: -1; cell: number };

/**
 * The most useful next hint for this board: first point out mistakes,
 * then the × marks the player's trees already imply, then the easiest
 * logical step. Null if the board is solved.
 */
export function hintFor(p: Puzzle, board: Uint8Array): Hint | null {
  const g = new Grid(p.size, p.beds);
  const isSolution = (i: number) => p.solution[g.row(i)] === g.col(i);
  for (let i = 0; i < g.n; i++) if (board[i] === TREE && !isSolution(i)) return { kind: 'wrong-tree', level: -1, cell: i };
  for (let i = 0; i < g.n; i++) if (board[i] === MARK && isSolution(i)) return { kind: 'wrong-mark', level: -1, cell: i };

  const trees = [...board.keys()].filter((i) => board[i] === TREE);
  if (trees.length === p.size) return null;

  const implied = impliedMarks(g, board);
  if (implied.length) {
    const by = trees.filter((t) => implied.some((i) => g.clash(t, i)));
    return { kind: 'implied', level: 0, trees: by, eliminate: implied };
  }

  const s: State = { open: new Uint8Array(g.n), tree: new Uint8Array(g.n) };
  for (let i = 0; i < g.n; i++) {
    s.tree[i] = board[i] === TREE ? 1 : 0;
    s.open[i] = board[i] === EMPTY ? 1 : 0;
  }
  const step = nextStep(g, s);
  if (step) return step;
  // Shouldn't happen for a generated puzzle; fall back to showing a tree.
  const r = [...Array(p.size).keys()].find((r) => board[r * p.size + p.solution[r]] !== TREE)!;
  return { kind: 'reveal', level: -1, cell: r * p.size + p.solution[r] };
}

/** Empty squares that can't hold a tree because of the trees already planted. */
export function impliedMarks(g: Grid, board: Uint8Array): number[] {
  const trees = [...board.keys()].filter((i) => board[i] === TREE);
  return [...board.keys()].filter((i) => board[i] === EMPTY && trees.some((t) => g.clash(t, i)));
}

// --- generation --------------------------------------------------------------------

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random tree layout: one per row and column, never touching. */
function placeTrees(size: number, rng: Rng): Uint8Array | null {
  const cols = new Uint8Array(size);
  const used = new Uint8Array(size);
  const go = (r: number): boolean => {
    if (r === size) return true;
    for (const c of shuffle([...Array(size).keys()], rng)) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      cols[r] = c;
      used[c] = 1;
      if (go(r + 1)) return true;
      used[c] = 0;
    }
    return false;
  };
  return go(0) ? cols : null;
}

/** Grow one bed from each tree until the grid is full, giving organic shapes. */
function growBeds(size: number, trees: Uint8Array, rng: Rng): Uint8Array {
  const n = size * size;
  const beds = new Uint8Array(n).fill(255);
  for (let r = 0; r < size; r++) beds[r * size + trees[r]] = r;
  let left = n - size;
  // Uneven growth rates make some beds big and some small, which makes better puzzles.
  const rate = Array.from({ length: size }, () => 0.3 + rng() * 1.7);
  while (left > 0) {
    const total = rate.reduce((a, b) => a + b, 0);
    let pick = rng() * total;
    let bed = 0;
    while (pick > rate[bed]) pick -= rate[bed++];
    const frontier: number[] = [];
    for (let i = 0; i < n; i++) {
      if (beds[i] !== bed) continue;
      const r = Math.floor(i / size);
      const c = i % size;
      if (r > 0 && beds[i - size] === 255) frontier.push(i - size);
      if (r < size - 1 && beds[i + size] === 255) frontier.push(i + size);
      if (c > 0 && beds[i - 1] === 255) frontier.push(i - 1);
      if (c < size - 1 && beds[i + 1] === 255) frontier.push(i + 1);
    }
    if (frontier.length === 0) {
      rate[bed] = 0; // boxed in
      continue;
    }
    beds[frontier[Math.floor(rng() * frontier.length)]] = bed;
    left--;
  }
  return beds;
}

/** Number of solutions, stopping once `limit` are found. */
export function countSolutions(size: number, beds: Uint8Array, limit = 2): number {
  const usedCol = new Uint8Array(size);
  const usedBed = new Uint8Array(size);
  let found = 0;
  const go = (r: number, prev: number) => {
    if (found >= limit) return;
    if (r === size) {
      found++;
      return;
    }
    for (let c = 0; c < size; c++) {
      const b = beds[r * size + c];
      if (usedCol[c] || usedBed[b] || (r > 0 && Math.abs(prev - c) < 2)) continue;
      usedCol[c] = usedBed[b] = 1;
      go(r + 1, c);
      usedCol[c] = usedBed[b] = 0;
    }
  };
  go(0, -10);
  return found;
}

/** A solution other than `not` (tree column per row), or null if there's none. */
function otherSolution(size: number, beds: Uint8Array, not: Uint8Array): Uint8Array | null {
  const cols = new Uint8Array(size);
  const usedCol = new Uint8Array(size);
  const usedBed = new Uint8Array(size);
  const go = (r: number): boolean => {
    if (r === size) return cols.some((c, i) => c !== not[i]);
    for (let c = 0; c < size; c++) {
      const b = beds[r * size + c];
      if (usedCol[c] || usedBed[b] || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      cols[r] = c;
      usedCol[c] = usedBed[b] = 1;
      if (go(r + 1)) return true;
      usedCol[c] = usedBed[b] = 0;
    }
    return false;
  };
  return go(0) ? cols : null;
}

/** Is bed `b` still in one piece if cell `skip` is taken out of it? */
function connectedWithout(size: number, beds: Uint8Array, b: number, skip: number): boolean {
  const cells = [...beds.keys()].filter((i) => beds[i] === b && i !== skip);
  if (cells.length === 0) return false;
  const seen = new Set([cells[0]]);
  const q = [cells[0]];
  while (q.length) {
    const i = q.pop()!;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const j of [r > 0 ? i - size : -1, r < size - 1 ? i + size : -1, c > 0 ? i - 1 : -1, c < size - 1 ? i + 1 : -1]) {
      if (j >= 0 && j !== skip && beds[j] === b && !seen.has(j)) {
        seen.add(j);
        q.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/**
 * Reshape beds until the intended layout is the only solution: whenever
 * another solution exists, move one of its trees' squares into a neighbouring
 * bed. That breaks the other solution and never touches the intended trees.
 */
function makeUnique(size: number, beds: Uint8Array, trees: Uint8Array, rng: Rng): boolean {
  for (let step = 0; step < 300; step++) {
    const other = otherSolution(size, beds, trees);
    if (!other) return true;
    const moves: [number, number][] = [];
    for (let r = 0; r < size; r++) {
      if (other[r] === trees[r]) continue;
      const x = r * size + other[r];
      const c = other[r];
      for (const j of [r > 0 ? x - size : -1, r < size - 1 ? x + size : -1, c > 0 ? x - 1 : -1, c < size - 1 ? x + 1 : -1]) {
        if (j >= 0 && beds[j] !== beds[x] && connectedWithout(size, beds, beds[x], x)) moves.push([x, beds[j]]);
      }
    }
    if (moves.length === 0) return false;
    const [x, to] = moves[Math.floor(rng() * moves.length)];
    beds[x] = to;
  }
  return false;
}

export interface GenerateOptions {
  size: number;
  /** Hardest step a solver may need (1..4). */
  maxLevel: number;
  /** Easiest acceptable puzzle: needs at least this level (1..4). */
  minLevel?: number;
}

export function generate(seed: number, opts: GenerateOptions): Puzzle {
  const rng = createRng(seed);
  const { size, maxLevel, minLevel = 1 } = opts;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const trees = placeTrees(size, rng);
    if (!trees) continue;
    for (let k = 0; k < 4; k++) {
      const beds = growBeds(size, trees, rng);
      if (!makeUnique(size, beds, trees, rng)) continue;
      const { solved, level } = logicSolve(size, beds);
      if (solved && level <= maxLevel && level >= minLevel) return { size, beds, solution: trees, level };
    }
  }
  throw new Error(`Could not generate a ${size}×${size} puzzle (seed ${seed})`);
}

// --- checking a player's board -------------------------------------------------------

export interface BoardCheck {
  trees: number;
  /** Squares with a tree that breaks a rule. */
  conflicts: Set<number>;
  solved: boolean;
}

export function checkBoard(p: Puzzle, board: Uint8Array): BoardCheck {
  const g = new Grid(p.size, p.beds);
  const trees = [...board.keys()].filter((i) => board[i] === TREE);
  const conflicts = new Set<number>();
  for (let a = 0; a < trees.length; a++) {
    for (let b = a + 1; b < trees.length; b++) {
      if (g.clash(trees[a], trees[b])) {
        conflicts.add(trees[a]);
        conflicts.add(trees[b]);
      }
    }
  }
  return { trees: trees.length, conflicts, solved: trees.length === p.size && conflicts.size === 0 };
}

// --- the daily puzzle ------------------------------------------------------------------

/** Day 1 of Garden Plot. */
const EPOCH = Date.UTC(2026, 9, 1);
/** Day 1 as a local date (noon, so time zones never shift it a day). */
export const EPOCH_DATE = new Date(2026, 9, 1, 12);

/** Bigger and trickier through the week, like a newspaper crossword. Index = getDay(). */
const WEEK: GenerateOptions[] = [
  { size: 9, maxLevel: 3, minLevel: 2 }, // Sun
  { size: 7, maxLevel: 2, minLevel: 1 }, // Mon
  { size: 7, maxLevel: 2, minLevel: 2 }, // Tue
  { size: 8, maxLevel: 2, minLevel: 2 }, // Wed
  { size: 8, maxLevel: 3, minLevel: 2 }, // Thu
  { size: 9, maxLevel: 3, minLevel: 2 }, // Fri
  { size: 9, maxLevel: 4, minLevel: 3 }, // Sat
];

export const PRACTICE: GenerateOptions = { size: 8, maxLevel: 3, minLevel: 2 };

/** The tutorial plot: a small 5×5 that needs one "bed fits in a line" step. */
export const TUTORIAL = { seed: 7, options: { size: 5, maxLevel: 2, minLevel: 2 } as GenerateOptions };

export interface Daily {
  /** YYYY-MM-DD in the company's (or the device's) time zone. */
  key: string;
  number: number;
  weekday: string;
  seed: number;
  options: GenerateOptions;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The calendar day at `now` as YYYY-MM-DD, in `timeZone` (an IANA name such as
 * "America/Vancouver") or, without one, in the device's own time zone.
 */
export function dayKey(now: Date = new Date(), timeZone?: string): string {
  if (timeZone) {
    const p = zoneParts(now, timeZone);
    if (p) return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Minutes until the next daily puzzle (midnight in `timeZone`, or the device's). */
export function minutesToMidnight(now: Date = new Date(), timeZone?: string): number {
  const p = timeZone ? zoneParts(now, timeZone) : null;
  const h = p ? p.hour : now.getHours();
  const m = p ? p.minute : now.getMinutes();
  const s = p ? p.second : now.getSeconds();
  return Math.max(1, Math.ceil(24 * 60 - h * 60 - m - s / 60));
}

function zoneParts(now: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((x) => x.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
  } catch {
    return null; // unknown time zone: fall back to the device's
  }
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isDayKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * The daily puzzle for a YYYY-MM-DD day. Same day + salt → same puzzle on every
 * phone and on the server. `salt` makes it per company.
 */
export function dailyFromKey(key: string, salt = ''): Daily {
  if (!isDayKey(key)) throw new Error(`Not a day: ${key}`);
  const t = Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
  const number = Math.round((t - EPOCH) / 86400000) + 1;
  let seed = 2166136261;
  for (const ch of `garden-plot:${salt}:${key}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const w = new Date(t).getUTCDay();
  return {
    key,
    number,
    weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][w],
    seed: seed >>> 0,
    options: WEEK[w],
  };
}

/** The daily puzzle for `date`'s calendar day in the device's time zone. */
export function daily(date: Date, salt = ''): Daily {
  return dailyFromKey(dayKey(date), salt);
}
