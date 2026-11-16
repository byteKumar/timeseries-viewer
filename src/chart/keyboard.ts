// Pure keyboard logic for the chart, so it can be unit-tested without a browser.
import { lowerBound, nearestIndex } from '../lttb/search';
import type { Line } from './drawCanvas';
import type { View } from './viewport';

/** Keyboard cursor: which series, and the timestamp of the point it is on. */
export interface Cursor {
  series: number;
  t: number;
}

export type KeyAction =
  | { kind: 'move'; cursor: Cursor }
  | { kind: 'zoom'; factor: number }
  | { kind: 'clear' }
  | { kind: 'none' };

export const KEY_HELP =
  'Left and Right arrows move between points; Shift+arrow or Page Up/Down jumps 10% of the view; Up and Down switch series; Home and End go to the first and last point in view; plus and minus zoom; Escape clears the cursor.';

/**
 * Work out what a key press does. The cursor is stored as a timestamp, not an
 * index, because the points on screen change whenever the worker sends a new
 * level of detail; re-finding the index each time keeps the cursor on the same spot.
 */
export function keyAction(key: string, shift: boolean, cursor: Cursor | null, lines: Line[], visible: boolean[], view: View): KeyAction {
  const shown = visible.flatMap((on, i) => (on && lines[i]?.x.length ? [i] : []));
  if (shown.length === 0) return { kind: 'none' };
  if (key === '+' || key === '=') return { kind: 'zoom', factor: 0.5 };
  if (key === '-' || key === '_') return { kind: 'zoom', factor: 2 };
  if (key === 'Escape') return cursor ? { kind: 'clear' } : { kind: 'none' };

  // Start in the middle of the view on the first visible series.
  const series = cursor && shown.includes(cursor.series) ? cursor.series : shown[0];
  const t = cursor ? cursor.t : (view.x0 + view.x1) / 2;
  const { x } = lines[series];
  const i = nearestIndex(x, t);
  const at = (j: number): KeyAction => ({ kind: 'move', cursor: { series, t: x[Math.min(x.length - 1, Math.max(0, j))] } });
  const jump = (view.x1 - view.x0) * 0.1;

  switch (key) {
    case 'ArrowRight':
      return shift ? at(nearestIndex(x, t + jump)) : at(cursor ? i + 1 : i);
    case 'ArrowLeft':
      return shift ? at(nearestIndex(x, t - jump)) : at(cursor ? i - 1 : i);
    case 'PageDown':
      return at(nearestIndex(x, t + jump));
    case 'PageUp':
      return at(nearestIndex(x, t - jump));
    case 'Home':
      return at(lowerBound(x, view.x0));
    case 'End':
      return at(lowerBound(x, view.x1 + 1e-9) - 1);
    case 'ArrowUp':
    case 'ArrowDown': {
      const k = shown.indexOf(series);
      const next = shown[(k + (key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length];
      const nx = lines[next].x;
      return { kind: 'move', cursor: { series: next, t: nx[nearestIndex(nx, t)] } };
    }
    default:
      return { kind: 'none' };
  }
}
