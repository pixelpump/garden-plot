import { describe, expect, it } from 'vitest';
import { explain, unitName } from './explain';
import { daily, generate, Grid, hintFor, MARK, TREE, type Puzzle } from './puzzle';

describe('explain', () => {
  it('names rows, columns and beds the way a person would', () => {
    expect(unitName({ kind: 'row', index: 2 })).toBe('row 3');
    expect(unitName({ kind: 'col', index: 0 })).toBe('column 1');
    expect(unitName({ kind: 'bed', index: 4 })).toBe('the lavender bed');
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
