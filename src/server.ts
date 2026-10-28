// Server-side checking for the Staff Board (built to dist-server/garden-plot.cjs).
// The server rebuilds a day's puzzle from the day key and the company id, so it
// never has to trust the phone's answer.
import { checkBoard, dailyFromKey, generate, isDayKey, TREE, type Daily, type Puzzle } from './puzzle';

export { dailyFromKey, dayKey, isDayKey, minutesToMidnight, type Daily, type Puzzle } from './puzzle';

const cache = new Map<string, { info: Daily; puzzle: Puzzle }>();

/** The daily puzzle for `key` (YYYY-MM-DD) and `salt` (the company id). Cached. */
export function dailyPuzzle(key: string, salt: string): { info: Daily; puzzle: Puzzle } {
  const id = `${salt}:${key}`;
  let hit = cache.get(id);
  if (!hit) {
    const info = dailyFromKey(key, salt);
    hit = { info, puzzle: generate(info.seed, info.options) };
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(id, hit);
  }
  return hit;
}

export type Verdict = { ok: true; info: Daily; puzzle: Puzzle } | { ok: false; reason: string };

/** Checks that `answer` (the tree's column in each row) solves that day's puzzle. */
export function verifyDaily(key: string, salt: string, answer: unknown): Verdict {
  if (typeof key !== 'string' || !isDayKey(key)) return { ok: false, reason: 'bad day' };
  const { info, puzzle } = dailyPuzzle(key, salt);
  const n = puzzle.size;
  if (!Array.isArray(answer) || answer.length !== n || !answer.every((c) => Number.isInteger(c) && c >= 0 && c < n)) {
    return { ok: false, reason: 'bad answer' };
  }
  const board = new Uint8Array(n * n);
  answer.forEach((c: number, r) => (board[r * n + c] = TREE));
  if (!checkBoard(puzzle, board).solved) return { ok: false, reason: 'wrong answer' };
  return { ok: true, info, puzzle };
}

/**
 * Shortest believable solve for a puzzle this size, in ms: about half a second
 * per tree. Anything faster came from a script, not a thumb.
 */
export const minSolveMs = (size: number) => size * 500;
