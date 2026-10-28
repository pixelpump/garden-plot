import { describe, expect, it } from 'vitest';
import { dailyPuzzle, minSolveMs, verifyDaily } from './server';

describe('server checking', () => {
  const { puzzle } = dailyPuzzle('2026-10-28', 'org-1');
  const answer = [...puzzle.solution];

  it("accepts the day's solution", () => {
    const v = verifyDaily('2026-10-28', 'org-1', answer);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.info.number).toBe(28);
  });

  it("rejects another company's or another day's puzzle", () => {
    expect(verifyDaily('2026-10-28', 'org-2', answer).ok).toBe(false);
    expect(verifyDaily('2026-10-29', 'org-1', answer).ok).toBe(false);
  });

  it('rejects junk', () => {
    expect(verifyDaily('2026-02-30', 'org-1', answer)).toEqual({ ok: false, reason: 'bad day' });
    expect(verifyDaily('2026-10-28', 'org-1', answer.slice(1))).toEqual({ ok: false, reason: 'bad answer' });
    expect(verifyDaily('2026-10-28', 'org-1', answer.map(() => 99))).toEqual({ ok: false, reason: 'bad answer' });
    expect(verifyDaily('2026-10-28', 'org-1', 'nope')).toEqual({ ok: false, reason: 'bad answer' });
    expect(verifyDaily('2026-10-28', 'org-1', [...answer].reverse())).toEqual({ ok: false, reason: 'wrong answer' });
  });

  it('allows half a second per tree', () => {
    expect(minSolveMs(7)).toBe(3500);
  });
});
