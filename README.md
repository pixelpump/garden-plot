# Garden Plot

A daily tree-planting logic puzzle for Shepherd crews. Plant one tree in every row, every column and every garden bed, and trees can't touch, not even at the corners. Everyone in the company gets the same puzzle each day, and the fastest planters go up on the Staff Board.

```
npm install
npm run dev        # http://localhost:5173, also on your LAN for phone testing
npm test           # puzzle generator, solver, hints, explanations
npm run build      # typecheck + production build in dist/ (~10 KB gzipped)
```

## How it plays

- **Tap** a square once for ×, twice for a tree, again to clear. **Press and hold** toggles ×. **Drag** to mark several squares with ×.
- **One-tap trees** (optional): a tap plants a tree (or clears one), and × is press-and-hold or drag. Off by default, so new players get the familiar Queens-style controls. Hints and the tour word their instructions to match.
- Trees that break a rule are striped red. Undo and Clear are under the board.
- **Auto-×** (optional) marks every square a tree rules out, automatically.
- **Hint** explains the next logical step in plain words and highlights the squares involved. On the daily puzzle, the first press warns that hints make the time *assisted*. Assisted times are kept but stay off the Staff Board.
- **How to play**: a guided 5×5 where the hint coach walks you through every step. It's offered first to new players.
- Leaving the app pauses the clock and hides the board.
- Your first solve each day is your time. Streaks count consecutive days solved. **Share result** copies a short summary for the crew chat. When today's is done, the menu counts down to the next puzzle.
- **Archive**: a calendar of every daily puzzle since #1, showing which you solved, which needed hints, and which you caught up on later. Catch-up solves don't count for streaks or the Staff Board. It also shows how many you've solved and your best (no-hint) time per size.

### Art

Each garden bed grows its own kind of tree, chosen to stand out against that bed's colour:

| Bed | Tree | Bed | Tree | Bed | Tree |
|---|---|---|---|---|---|
| sage | maple | clay | spruce | eucalyptus | copper beech |
| wheat | pine | heather | aspen | ochre | cypress |
| terracotta | oak | slate | cherry | stone | apple |

They're hand-drawn 16×16 pixel art: `scripts/draw-trees.py` writes the 9-frame sheet `src/assets/trees.png` from character maps (frame *k* = bed *k*). Edit a shape or palette and re-run it, or replace the sheet with other art in the same 9-frame layout.

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

Shepherd keeps its own copy of the game, so its builds don't depend on this repo:

```
npm run export:shepherd -- ../bishop_flow
```

That writes the game to `bishop_flow/src/lib/garden-plot/` and a CommonJS build of the puzzle checker (`src/server.ts`) to `bishop_flow/server/vendor/garden-plot.cjs`. Change the game here, re-export, and commit the result in bishop_flow.

```ts
import { mountGardenPlot } from '@/lib/garden-plot';

const game = mountGardenPlot(container, {
  salt: company.id,               // each company gets its own daily puzzle
  timeZone: company.timeZone,     // the puzzle rolls over at the company's midnight
  onFinish: (r) => r.dailyKey && api.post('/api/games/garden-plot/results', r),
  onExit: () => navigate(-1),
});
// later: game.destroy()
```

`onFinish` receives `{ dailyKey, number, size, timeMs, assisted, hints, answer, archive? }`. `answer` is the column of the tree in each row.

### Keeping the Staff Board honest

The official time is the phone's timer (`timeMs`). It pauses when the app is in the background, so a phone call on the way to a job doesn't cost anyone. The server doesn't trust the rest:

1. It rebuilds the day's puzzle from `dailyKey` and the company id (`verifyDaily` in `src/server.ts`) and checks `answer` against it.
2. It rejects times faster than `minSolveMs(size)` (half a second per tree) and times longer than the gap since the start of that day.
3. A solve only counts for the day it belongs to, in the company's time zone. Archive catch-ups and solves with hints (`assisted`) are stored but stay off the Staff Board.
4. Each person's first solve of a day is the one that counts.
