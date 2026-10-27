# Garden Plot

A daily tree-planting logic puzzle for Shepherd crews. Plant one tree in every row, every column and every garden bed, and trees can't touch, not even at the corners. Everyone in the company gets the same puzzle each day, and the fastest planters go up on the Staff Board.

```
npm install
npm run dev        # http://localhost:5173, also on your LAN for phone testing
npm test           # puzzle generator, solver, hints, explanations
npm run build      # typecheck + production build in dist/ (~10 KB gzipped)
```

## How it plays

- **Tap** a square once for ×, twice for a tree, again to clear. **Drag** to mark several squares with ×.
- Trees that break a rule are striped red. Undo and Clear are under the board.
- **Auto-×** (optional) marks every square a tree rules out, automatically.
- **Hint** explains the next logical step in plain words and highlights the squares involved. On the daily puzzle, the first press warns that hints make the time *assisted*. Assisted times are kept but stay off the Staff Board.
- **How to play**: a guided 5×5 where the hint coach walks you through every step. It's offered first to new players.
- Leaving the app pauses the clock and hides the board.
- Your first solve each day is your time. Streaks count consecutive days solved. **Share result** copies a short summary for the crew chat. When today's is done, the menu counts down to the next puzzle.
- **Archive**: a calendar of every daily puzzle since #1, showing which you solved, which needed hints, and which you caught up on later. Catch-up solves don't count for streaks or the Staff Board. It also shows how many you've solved and your best (no-hint) time per size.

### Art

The tree is hand-drawn pixel art: `scripts/draw-tree.py` writes `src/assets/tree.png` from a 16×16 character map. Edit the map and re-run it, or simply replace the PNG with other art of any size.

### The weekly rhythm

| Day | Size | Hardest step needed |
|---|---|---|
| Mon | 7×7 | 2 |
| Tue | 7×7 | 2 |
| Wed | 8×8 | 2 |
| Thu | 8×8 | 3 |
| Fri | 9×9 | 3 |
| Sat | 9×9 | 4 |
| Sun | 9×9 | 3 |

## How puzzles are made

`src/puzzle.ts`

1. Place trees randomly: one per row and column, never touching.
2. Grow a garden bed out from each tree, at uneven rates, until the grid is full.
3. While a second solution exists, move one of its squares into a neighbouring bed. That breaks the second solution without touching the intended one.
4. Solve it the way a person would, one step at a time. Keep the puzzle only if it's solvable without guessing and the hardest step fits the day.

The steps, from easiest to hardest, are listed at the top of `puzzle.ts`. The same step finder powers grading, the **Hint** button (`hintFor`) and the tutorial. `src/explain.ts` turns each step into a sentence.

The tests generate the next 90 daily puzzles. They check that each has exactly one solution, can be solved by logic alone, has beds in one piece, and generates in well under a second. They also check that following hints alone always finishes a puzzle and that every hint is correct.

## Embedding in Shepherd (bishop_flow)

```ts
import { mountGardenPlot } from 'garden-plot';

const game = mountGardenPlot(container, {
  salt: company.id,            // each company gets its own daily puzzle
  onFinish: (r) => api.post('/games/garden-plot/results', r),
  onExit: () => navigate(-1),
});
// later: game.destroy()
```

`onFinish` receives `{ dailyKey, number, size, timeMs, assisted, hints, answer }`.

### Keeping the Staff Board honest

The server doesn't need to trust the client:

1. `GET /games/garden-plot/today` records *when* this person was served today's puzzle.
2. `POST /games/garden-plot/results` regenerates the puzzle with `daily(date, companyId)` and `generate(seed, options)`, then checks `answer` against the solution.
3. The server times the solve: receipt time minus served time. Use the client's `timeMs` only as a sanity check.
4. Store `assisted`. Only unassisted first solves count for the daily, weekly and monthly contests.

Day boundaries should use the company's time zone, not UTC.
