import { describe, expect, it } from 'vitest';
import { keyAction, type Cursor } from './keyboard';

const x = Float64Array.from({ length: 101 }, (_, i) => i * 10); // 0, 10, ..., 1000
const lines = [
  { x, y: x.map((v) => v / 10) },
  { x, y: x.map((v) => -v) },
  { x, y: x.map(() => 0) },
];
const all = [true, true, true];
const view = { x0: 200, x1: 600 };
const move = (key: string, cursor: Cursor | null, shift = false, visible = all) => {
  const a = keyAction(key, shift, cursor, lines, visible, view);
  if (a.kind !== 'move') throw new Error(`expected a move, got ${a.kind}`);
  return a.cursor;
};

describe('chart keyboard', () => {
  it('first arrow press lands on the point nearest the middle of the view', () => {
    expect(move('ArrowRight', null)).toEqual({ series: 0, t: 400 });
  });

  it('arrows step one point; Shift and Page keys jump 10% of the view', () => {
    expect(move('ArrowRight', { series: 0, t: 400 })).toEqual({ series: 0, t: 410 });
    expect(move('ArrowLeft', { series: 0, t: 400 })).toEqual({ series: 0, t: 390 });
    expect(move('ArrowRight', { series: 0, t: 400 }, true)).toEqual({ series: 0, t: 440 });
    expect(move('PageUp', { series: 0, t: 400 })).toEqual({ series: 0, t: 360 });
  });

  it('stops at the ends of the data', () => {
    expect(move('ArrowRight', { series: 0, t: 1000 })).toEqual({ series: 0, t: 1000 });
    expect(move('ArrowLeft', { series: 0, t: 0 })).toEqual({ series: 0, t: 0 });
  });

  it('Home and End go to the first and last point inside the view', () => {
    expect(move('Home', { series: 1, t: 400 })).toEqual({ series: 1, t: 200 });
    expect(move('End', { series: 1, t: 400 })).toEqual({ series: 1, t: 600 });
  });

  it('End reaches the last point with real epoch-ms timestamps (float precision regression)', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const big = Float64Array.from({ length: 11 }, (_, i) => t0 + i * 10);
    const l = [{ x: big, y: new Float64Array(11) }];
    const a = keyAction('End', false, null, l, [true], { x0: t0, x1: t0 + 100 });
    expect(a).toEqual({ kind: 'move', cursor: { series: 0, t: t0 + 100 } });
  });

  it('Up/Down cycle through visible series only, keeping the time', () => {
    expect(move('ArrowDown', { series: 0, t: 400 })).toEqual({ series: 1, t: 400 });
    expect(move('ArrowDown', { series: 0, t: 400 }, false, [true, false, true])).toEqual({ series: 2, t: 400 });
    expect(move('ArrowUp', { series: 0, t: 400 })).toEqual({ series: 2, t: 400 });
  });

  it('+/- zoom, Escape clears, other keys and no visible series do nothing', () => {
    expect(keyAction('+', false, null, lines, all, view)).toEqual({ kind: 'zoom', factor: 0.5 });
    expect(keyAction('-', false, null, lines, all, view)).toEqual({ kind: 'zoom', factor: 2 });
    expect(keyAction('Escape', false, { series: 0, t: 1 }, lines, all, view)).toEqual({ kind: 'clear' });
    expect(keyAction('a', false, null, lines, all, view)).toEqual({ kind: 'none' });
    expect(keyAction('ArrowRight', false, null, lines, [false, false, false], view)).toEqual({ kind: 'none' });
  });

  it('a hidden series is never the target: the cursor moves to the first visible one', () => {
    expect(move('ArrowRight', { series: 0, t: 400 }, false, [false, true, true]).series).toBe(1);
  });
});
