// Statistics for the screen-reader summary of the visible range.
// One O(n) pass: min, max, and a least-squares line for the trend.

export interface RangeStats {
  count: number;
  min: number;
  minAt: number;
  max: number;
  maxAt: number;
  /** Change of the fitted straight line from the start to the end of the range. */
  fittedChange: number;
}

export function rangeStats(x: ArrayLike<number>, y: ArrayLike<number>, start = 0, end = x.length): RangeStats | null {
  const n = end - start;
  if (n <= 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let minAt = x[start];
  let maxAt = x[start];
  // Least squares on x relative to the first point (keeps the numbers small).
  const t0 = x[start];
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = start; i < end; i++) {
    const v = y[i];
    const t = x[i] - t0;
    if (v < min) {
      min = v;
      minAt = x[i];
    }
    if (v > max) {
      max = v;
      maxAt = x[i];
    }
    sx += t;
    sy += v;
    sxx += t * t;
    sxy += t * v;
  }
  const denom = n * sxx - sx * sx;
  const slope = n > 1 && denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  return { count: n, min, minAt, max, maxAt, fittedChange: slope * (x[end - 1] - t0) };
}

/** "rising", "falling" or "roughly flat": flat if the fitted change is under 10% of the spread. */
export function trendWord(s: RangeStats): string {
  const spread = s.max - s.min;
  if (spread === 0 || Math.abs(s.fittedChange) < 0.1 * spread) return 'roughly flat';
  return s.fittedChange > 0 ? 'rising' : 'falling';
}
