import { describe, expect, it } from 'vitest';
import {
  applyStep,
  checkBoard,
  countSolutions,
  daily,
  EMPTY,
  generate,
  Grid,
  hintFor,
  logicSolve,
  MARK,
  PRACTICE,
  TREE,
  TUTORIAL,
  type Puzzle,
  type Step,
} from './puzzle';

function solutionBoard(p: Puzzle): Uint8Array {
  const b = new Uint8Array(p.size * p.size);
  p.solution.forEach((c, r) => (b[r * p.size + c] = TREE));
  return b;
}

function bedsConnected(p: Puzzle): boolean {
  const { size, beds } = p;
  for (let bed = 0; bed < size; bed++) {
    const cells = [...beds.keys()].filter((i) => beds[i] === bed);
    const seen = new Set([cells[0]]);
    const q = [cells[0]];
    while (q.length) {
      const i = q.pop()!;
      for (const j of [i - size, i + size, i % size ? i - 1 : -1, (i + 1) % size ? i + 1 : -1]) {
        if (j >= 0 && j < beds.length && beds[j] === bed && !seen.has(j)) {
          seen.add(j);
          q.push(j);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}

/** Play a puzzle by following hints only, the way a stuck player would. */
function playByHints(p: Puzzle, autoX: boolean): { board: Uint8Array; hints: number } {
  const g = new Grid(p.size, p.beds);
  const board = new Uint8Array(p.size * p.size);
  let hints = 0;
  for (; hints < 500; hints++) {
    const h = hintFor(p, board);
    if (!h) break;
    if (h.kind === 'single') board[h.place] = TREE;
    else if ('eliminate' in h) for (const i of h.eliminate) board[i] = MARK;
    else throw new Error(`unexpected hint ${h.kind}`);
    if (autoX) for (const i of [...board.keys()]) if (board[i] === EMPTY && [...board.keys()].some((t) => board[t] === TREE && g.clash(t, i))) board[i] = MARK;
  }
  return { board, hints };
}

describe('daily puzzle', () => {
  it('is the same for everyone on the same day', () => {
    const a = daily(new Date(2026, 9, 27, 7, 0));
    const b = daily(new Date(2026, 9, 27, 22, 30));
    expect(a).toEqual(b);
    expect(a.key).toBe('2026-10-27');
    expect(a.number).toBe(27);
    expect(generate(a.seed, a.options).beds).toEqual(generate(b.seed, b.options).beds);
  });

  it('changes every day, and per company when salted', () => {
    expect(daily(new Date(2026, 9, 27)).seed).not.toBe(daily(new Date(2026, 9, 28)).seed);
    expect(daily(new Date(2026, 9, 27), 'bishop').seed).not.toBe(daily(new Date(2026, 9, 27), 'other').seed);
  });

  it('gets bigger through the week', () => {
    expect(daily(new Date(2026, 9, 26)).options.size).toBe(7); // Monday
    expect(daily(new Date(2026, 9, 30)).options.size).toBe(9); // Friday
  });

  it('every puzzle for the next 90 days is fair', () => {
    for (let k = 0; k < 90; k++) {
      const info = daily(new Date(2026, 9, 27 + k));
      const t = performance.now();
      const p = generate(info.seed, info.options);
      expect(performance.now() - t, `${info.key} generation time`).toBeLessThan(1500);
      expect(p.size).toBe(info.options.size);
      expect(countSolutions(p.size, p.beds), `${info.key} unique`).toBe(1);
      expect(checkBoard(p, solutionBoard(p)).solved, `${info.key} solution valid`).toBe(true);
      expect(logicSolve(p.size, p.beds).solved, `${info.key} solvable without guessing`).toBe(true);
      expect(p.level).toBeLessThanOrEqual(info.options.maxLevel);
      expect(bedsConnected(p), `${info.key} beds in one piece`).toBe(true);
    }
  }, 120000);
});

describe('checkBoard', () => {
  const p = generate(1, { size: 7, maxLevel: 2 });

  it('accepts the solution', () => {
    expect(checkBoard(p, solutionBoard(p))).toMatchObject({ trees: 7, solved: true });
  });

  it('flags trees that touch diagonally', () => {
    const b = new Uint8Array(49);
    b[0] = TREE;
    b[8] = TREE;
    expect([...checkBoard(p, b).conflicts].sort()).toEqual([0, 8]);
  });

  it('a full board with a rule broken is not solved', () => {
    const b = solutionBoard(p);
    b[p.solution[0]] = EMPTY;
    b[(p.solution[0] + 3) % 7] = TREE;
    expect(checkBoard(p, b).solved).toBe(false);
  });
});

describe('hints', () => {
  const p = generate(daily(new Date(2026, 9, 30)).seed, daily(new Date(2026, 9, 30)).options); // a 9×9

  it('following hints alone solves the puzzle, with or without auto-×', () => {
    for (const autoX of [false, true]) {
      const { board, hints } = playByHints(p, autoX);
      expect(checkBoard(p, board).solved).toBe(true);
      expect(hints).toBeGreaterThan(p.size - 1);
    }
  });

  it('points out a wrongly planted tree first', () => {
    const b = new Uint8Array(p.size * p.size);
    const wrong = p.solution[0] === 0 ? 1 : 0; // row 0, not the solution column
    b[wrong] = TREE;
    expect(hintFor(p, b)).toEqual({ kind: 'wrong-tree', level: -1, cell: wrong });
  });

  it('points out an × on a square that needs a tree', () => {
    const b = new Uint8Array(p.size * p.size);
    b[p.solution[2] + 2 * p.size] = MARK;
    expect(hintFor(p, b)).toMatchObject({ kind: 'wrong-mark' });
  });

  it('reminds about squares ruled out by a planted tree', () => {
    const b = new Uint8Array(p.size * p.size);
    b[p.solution[0]] = TREE;
    const h = hintFor(p, b);
    expect(h?.kind).toBe('implied');
    if (h?.kind === 'implied') expect(h.eliminate).toContain(p.solution[0] + p.size); // directly below
  });

  it('has nothing to say about a solved board', () => {
    expect(hintFor(p, solutionBoard(p))).toBeNull();
  });

  it('every step it suggests is correct', () => {
    const g = new Grid(p.size, p.beds);
    const s = { open: new Uint8Array(g.n).fill(1), tree: new Uint8Array(g.n) };
    const sol = new Set([...p.solution].map((c, r) => r * p.size + c));
    for (let guard = 0; guard < 500 && s.tree.reduce((a, v) => a + v, 0) < p.size; guard++) {
      const h = hintFor(p, Uint8Array.from(s.tree, (t, i) => (t ? TREE : s.open[i] ? EMPTY : MARK)));
      if (!h || h.level < 0) throw new Error(`bad hint ${h?.kind}`);
      if (h.kind === 'single') expect(sol.has(h.place)).toBe(true);
      else if ('eliminate' in h) for (const i of h.eliminate) expect(sol.has(i)).toBe(false);
      if (h.kind === 'implied') for (const i of h.eliminate) s.open[i] = 0;
      else applyStep(g, s, h as Step);
    }
  });
});

describe('practice and tutorial puzzles', () => {
  it('practice puzzles generate quickly', () => {
    for (let seed = 100; seed < 110; seed++) {
      const t = performance.now();
      const p = generate(seed, PRACTICE);
      expect(performance.now() - t).toBeLessThan(1500);
      expect(countSolutions(p.size, p.beds)).toBe(1);
    }
  });

  it('the tutorial is a 5×5 that teaches one "bed fits in a line" step', () => {
    const p = generate(TUTORIAL.seed, TUTORIAL.options);
    expect(p.size).toBe(5);
    expect(p.level).toBe(2);
    expect(countSolutions(p.size, p.beds)).toBe(1);
  });
});
