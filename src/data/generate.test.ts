import { describe, expect, it } from 'vitest';
import { generateSeries, generateSeriesChunked, SAMPLE_INTERVAL_MS, START_MS, yExtent } from './generate';

describe('generateSeries', () => {
  it('returns 3 series of the requested length with shared timestamps', () => {
    const d = generateSeries(10_000);
    expect(d.x.length).toBe(10_000);
    expect(d.ys).toHaveLength(3);
    expect(d.names).toHaveLength(3);
    for (const y of d.ys) expect(y.length).toBe(10_000);
  });

  it('has strictly increasing, evenly spaced timestamps', () => {
    const { x } = generateSeries(1_000);
    expect(x[0]).toBe(START_MS);
    for (let i = 1; i < x.length; i++) expect(x[i] - x[i - 1]).toBe(SAMPLE_INTERVAL_MS);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = generateSeries(5_000, 7);
    const b = generateSeries(5_000, 7);
    const c = generateSeries(5_000, 8);
    expect(Array.from(a.ys[0])).toEqual(Array.from(b.ys[0]));
    expect(Array.from(a.ys[0])).not.toEqual(Array.from(c.ys[0]));
  });

  it('contains spikes well outside the sine + noise band', () => {
    // Series 0: |sine parts| <= 2.4 and |noise| <= 0.45, so anything beyond 3 is a spike.
    const { ys } = generateSeries(200_000);
    const spikes = ys[0].filter((v) => Math.abs(v) > 3).length;
    expect(spikes).toBeGreaterThan(0);
  });

  it('the chunked version produces exactly the same data', async () => {
    const a = generateSeries(10_007, 3);
    const b = (await generateSeriesChunked(10_007, 3, undefined, 1_000))!;
    expect(Array.from(b.x)).toEqual(Array.from(a.x));
    for (let s = 0; s < 3; s++) expect(Array.from(b.ys[s])).toEqual(Array.from(a.ys[s]));
  });

  it('the chunked version stops when aborted', async () => {
    const ctl = new AbortController();
    const p = generateSeriesChunked(100_000, 1, ctl.signal, 1_000);
    ctl.abort();
    expect(await p).toBeNull();
  });

  it('rejects bad sizes', () => {
    expect(() => generateSeries(1)).toThrow();
    expect(() => generateSeries(2.5)).toThrow();
  });
});

describe('yExtent', () => {
  it('pads the min/max of all series by 5%', () => {
    const [lo, hi] = yExtent([Float64Array.from([0, 10]), Float64Array.from([5])]);
    expect(lo).toBeCloseTo(-0.5);
    expect(hi).toBeCloseTo(10.5);
  });
});
