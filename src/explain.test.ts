import { describe, expect, it } from 'vitest';
import { explain, unitName } from './explain';
import { daily, generate, Grid, hintFor, MARK, TREE, type Puzzle } from './puzzle';

describe('explain', () => {
  it('names rows, columns and beds the way a person would', () => {
    expect(unitName({ kind: 'row', index: 2 })).toBe('row 3');
    expect(unitName({ kind: 'col', index: 0 })).toBe('column 1');
    expect(unitName({ kind: 'bed', index: 4 })).toBe('the heather bed');
  });

  it("says how to act in the player's control style", () => {
    const p = generate(daily(new Date(2026, 9, 26)).seed, daily(new Date(2026, 9, 26)).options);
    const g = new Grid(p.size, p.beds);
    const board = new Uint8Array(g.n);
    board[p.solution[0]] = TREE;
    const implied = hintFor(p, board)!;
    expect(explain(implied, g).text).not.toMatch(/press and hold/);
    expect(explain(implied, g, { oneTap: true }).text).toMatch(/press and hold/);
    // A "plant here" hint.
    const solved = new Uint8Array(g.n);
    p.solution.forEach((c, r) => r > 0 && (solved[r * p.size + c] = TREE));
    for (let i = 0; i < g.n; i++) if (!solved[i] && i !== p.solution[0]) solved[i] = MARK;
    const single = hintFor(p, solved)!;
    expect(single.kind).toBe('single');
    expect(explain(single, g).text).toMatch(/Tap it twice to plant/);
    expect(explain(single, g, { oneTap: true }).text).toMatch(/Tap it to plant/);
  });

  it('every hint on the way through a week of puzzles has a sensible explanation', () => {
    for (let d = 0; d < 7; d++) {
      const info = daily(new Date(2026, 10, 2 + d));
      const p: Puzzle = generate(info.seed, info.options);
      const g = new Grid(p.size, p.beds);
      const board = new Uint8Array(g.n);
      for (let guard = 0; guard < 400; guard++) {
        const h = hintFor(p, board);
        if (!h) break;
        const e = explain(h, g);
        expect(e.text.length, h.kind).toBeGreaterThan(20);
        expect(e.text).not.toMatch(/undefined|NaN|\[object/);
        expect(e.target.length, h.kind).toBeGreaterThan(0);
        if (h.kind === 'single') board[h.place] = TREE;
        else if ('eliminate' in h) for (const i of h.eliminate) board[i] = MARK;
      }
    }
  });
});
