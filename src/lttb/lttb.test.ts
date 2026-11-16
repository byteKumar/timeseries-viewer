import { describe, expect, it } from 'vitest';
import { generateSeries } from '../data/generate';
import { lttb } from './lttb';
import { lowerBound, visibleRange } from './search';

// Math.max(...arr) overflows the call stack for ~100k+ elements, so loop instead.
function max(a: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  return m;
}
function min(a: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0; i < a.length; i++) if (a[i] < m) m = a[i];
  return m;
}
const range = (n: number) => Float64Array.from({ length: n }, (_, i) => i);

describe('lttb', () => {
  it('returns exactly `threshold` points', () => {
    const x = range(10_000);
    const y = x.map((v) => Math.sin(v / 50));
    for (const t of [3, 10, 100, 2400]) expect(lttb(x, y, t).x.length).toBe(t);
  });

  it('keeps the first and last points', () => {
    const x = range(1_000);
    const y = x.map((v) => v * v);
    const out = lttb(x, y, 50);
    expect([out.x[0], out.y[0]]).toEqual([0, 0]);
    expect([out.x[49], out.y[49]]).toEqual([999, 999 * 999]);
  });

  it('keeps isolated extremes (spikes) of a flat signal', () => {
    const x = range(10_000);
    const y = new Float64Array(10_000);
    y[3_141] = 10;
    y[7_777] = -8;
    const out = lttb(x, y, 100);
    expect(Array.from(out.x)).toContain(3_141);
    expect(Array.from(out.x)).toContain(7_777);
    expect(Math.max(...out.y)).toBe(10);
    expect(Math.min(...out.y)).toBe(-8);
  });

  it('keeps the global max and min of the generated data (spikes)', () => {
    const d = generateSeries(200_000);
    for (const y of d.ys) {
      const out = lttb(d.x, y, 2_400);
      expect(max(out.y)).toBe(max(y));
      expect(min(out.y)).toBe(min(y));
    }
  });

  it('outputs points in increasing x order, all taken from the input', () => {
    const x = range(5_000);
    const y = x.map((v) => Math.cos(v / 7) + (v % 13));
    const out = lttb(x, y, 300);
    for (let i = 1; i < out.x.length; i++) expect(out.x[i]).toBeGreaterThan(out.x[i - 1]);
    for (let i = 0; i < out.x.length; i++) expect(out.y[i]).toBe(y[out.x[i]]);
  });

  it('returns the input unchanged when it is already small enough', () => {
    const x = range(20);
    const y = x.map((v) => v * 2);
    const out = lttb(x, y, 100);
    expect(Array.from(out.x)).toEqual(Array.from(x));
    expect(Array.from(out.y)).toEqual(Array.from(y));
  });

  it('works on a sub-range [start, end)', () => {
    const x = range(1_000);
    const y = x.map((v) => v % 10);
    const out = lttb(x, y, 20, 200, 400);
    expect(out.x.length).toBe(20);
    expect(out.x[0]).toBe(200);
    expect(out.x[19]).toBe(399);
  });
});

describe('binary search', () => {
  const x = Float64Array.from([10, 20, 30, 40, 50]);
  it('lowerBound finds the first index >= value', () => {
    expect(lowerBound(x, 5)).toBe(0);
    expect(lowerBound(x, 30)).toBe(2);
    expect(lowerBound(x, 31)).toBe(3);
    expect(lowerBound(x, 99)).toBe(5);
  });
  it('visibleRange includes one point past each edge', () => {
    expect(visibleRange(x, 25, 35)).toEqual([1, 4]);
    expect(visibleRange(x, 0, 100)).toEqual([0, 5]);
  });
});
