// Binary searches over a sorted Float64Array (timestamps). O(log n).

/** First index i with x[i] >= value (x.length if none). */
export function lowerBound(x: ArrayLike<number>, value: number, lo = 0, hi = x.length): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (x[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Index range [start, end) of the points to draw for the view [x0, x1],
 * including one point beyond each edge so the line reaches the plot border.
 */
export function visibleRange(x: ArrayLike<number>, x0: number, x1: number): [number, number] {
  const start = Math.max(0, lowerBound(x, x0) - 1);
  const end = Math.min(x.length, lowerBound(x, x1) + 1);
  return [start, end];
}
