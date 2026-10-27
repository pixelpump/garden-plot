import type { Grid, Hint, UnitRef } from './puzzle';

/** Garden bed names, matched to the bed colours in styles.css (--bed-0 …). */
export const BED_NAMES = ['clover', 'sunflower', 'terracotta', 'rose', 'lavender', 'forget-me-not', 'mint', 'mulch', 'gravel'];

export interface Explained {
  text: string;
  /** Squares the hint is about (soft highlight). */
  focus: number[];
  /** Squares to act on (strong highlight). */
  target: number[];
}

export function unitName(u: UnitRef): string {
  return u.kind === 'row' ? `row ${u.index + 1}` : u.kind === 'col' ? `column ${u.index + 1}` : `the ${BED_NAMES[u.index]} bed`;
}

function list(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "row 3 and row 4" → "rows 3 and 4" when they're all the same kind of line. */
function linesName(us: UnitRef[]): string {
  if (us.every((u) => u.kind === 'row')) return `rows ${list(us.map((u) => String(u.index + 1)))}`;
  if (us.every((u) => u.kind === 'col')) return `columns ${list(us.map((u) => String(u.index + 1)))}`;
  return list(us.map(unitName));
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Tell the player what to do with the highlighted squares of an elimination step. */
function markThem(e: Explained): Explained {
  const what = e.target.length === 1 ? 'the highlighted square' : 'the highlighted squares';
  return { ...e, text: `${e.text} Mark ${what} with ×.` };
}

export function explain(h: Hint, g: Grid): Explained {
  const e = describe(h, g);
  const eliminates = h.kind === 'bed-in-line' || h.kind === 'line-in-bed' || h.kind === 'touch-all' || h.kind === 'squeeze' || h.kind === 'what-if';
  return eliminates ? markThem(e) : e;
}

function describe(h: Hint, g: Grid): Explained {
  const cells = (u: UnitRef) => g.unit(u).cells;
  switch (h.kind) {
    case 'wrong-tree':
      return { text: "This tree isn't part of the solution. Tap it to clear it, then look again.", focus: [], target: [h.cell] };
    case 'wrong-mark':
      return { text: 'This × is on a square that needs a tree. Tap it to clear the ×.', focus: [], target: [h.cell] };
    case 'reveal':
      return { text: 'A tree goes here.', focus: [], target: [h.cell] };
    case 'implied':
      return {
        text: 'A tree rules out its whole row, column and bed, and every square touching it. Mark the highlighted squares with × (Auto-× can do this for you).',
        focus: h.trees,
        target: h.eliminate,
      };
    case 'single':
      return { text: `${cap(unitName(h.unit))} has only one open square left, so its tree goes here. Tap it twice to plant.`, focus: cells(h.unit), target: [h.place] };
    case 'bed-in-line': {
      const bed = unitName(h.bed);
      const line = unitName(h.line);
      return {
        text: `${cap(bed)} fits entirely in ${line}, so its tree must be in ${line}. That rules out the rest of ${line}.`,
        focus: cells(h.bed),
        target: h.eliminate,
      };
    }
    case 'line-in-bed': {
      const bed = unitName(h.bed);
      const line = unitName(h.line);
      return {
        text: `Every open square in ${line} is in ${bed}, so that bed's tree is in ${line}. The rest of ${bed} is ruled out.`,
        focus: cells(h.line),
        target: h.eliminate,
      };
    }
    case 'touch-all': {
      const u = unitName(h.unit);
      const these = h.eliminate.length > 1 ? 'These squares touch' : 'This square touches';
      return {
        text: `${these} every open square in ${u}. Wherever its tree goes, it would touch, so no tree here.`,
        focus: cells(h.unit),
        target: h.eliminate,
      };
    }
    case 'squeeze': {
      const k = h.units.length;
      const words = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][k] ?? String(k);
      const text =
        h.units[0].kind === 'bed'
          ? `${cap(list(h.units.map(unitName)))} all fit within ${linesName(h.into)}. Those ${words} lines must hold those ${words} beds' trees, so nothing else in them can have one.`
          : `${cap(linesName(h.units))} only have open squares in ${list(h.into.map(unitName))}. Those beds' trees must be in these lines, so the rest of the beds is ruled out.`;
      return { text, focus: h.units.flatMap(cells), target: h.eliminate };
    }
    case 'what-if':
      return {
        text: `Try it: a tree here would leave ${unitName(h.emptied)} with no room for its own tree. So no tree here.`,
        focus: cells(h.emptied),
        target: [h.cell],
      };
  }
}
