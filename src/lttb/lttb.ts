// Largest-Triangle-Three-Buckets (Steinarsson, 2013).
// Keeps the first and last point, splits the rest into (threshold - 2) buckets,
// and from each bucket keeps the point that forms the largest triangle with the
// point kept from the previous bucket and the average of the next bucket.
// Visually important points (peaks, spikes) make big triangles, so they survive.
// O(n) time, one pass.

export interface Points {
  x: Float64Array;
  y: Float64Array;
}

export function lttb(x: ArrayLike<number>, y: ArrayLike<number>, threshold: number, start = 0, end = x.length): Points {
  const n = end - start;
  if (threshold >= n || threshold < 3) {
    // Nothing to reduce: copy the range as is.
    return { x: Float64Array.from({ length: n }, (_, i) => x[start + i]), y: Float64Array.from({ length: n }, (_, i) => y[start + i]) };
  }

  const outX = new Float64Array(threshold);
  const outY = new Float64Array(threshold);
  const bucketSize = (n - 2) / (threshold - 2);

  let a = start; // index of the previously kept point
  outX[0] = x[a];
  outY[0] = y[a];

  for (let i = 0; i < threshold - 2; i++) {
    // Average of the NEXT bucket (the last "bucket" is just the final point).
    const nextStart = start + Math.floor((i + 1) * bucketSize) + 1;
    const nextEnd = Math.min(start + Math.floor((i + 2) * bucketSize) + 1, end);
    let avgX = 0;
    let avgY = 0;
    for (let j = nextStart; j < nextEnd; j++) {
      avgX += x[j];
      avgY += y[j];
    }
    const count = nextEnd - nextStart;
    avgX /= count;
    avgY /= count;

    // Pick the point in THIS bucket with the largest triangle area (x2, constant factor dropped).
    const from = start + Math.floor(i * bucketSize) + 1;
    const to = start + Math.floor((i + 1) * bucketSize) + 1;
    const ax = x[a];
    const ay = y[a];
    let maxArea = -1;
    let chosen = from;
    for (let j = from; j < to; j++) {
      const area = Math.abs((ax - avgX) * (y[j] - ay) - (ax - x[j]) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }
    outX[i + 1] = x[chosen];
    outY[i + 1] = y[chosen];
    a = chosen;
  }

  outX[threshold - 1] = x[end - 1];
  outY[threshold - 1] = y[end - 1];
  return { x: outX, y: outY };
}
