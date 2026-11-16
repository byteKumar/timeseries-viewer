// Pure viewport math: the visible x-range [x0, x1] inside the data bounds.
// Kept free of React and the DOM so it can be unit-tested directly.

export interface View {
  x0: number;
  x1: number;
}

export interface Bounds {
  min: number;
  max: number;
  /** Smallest span the user may zoom in to. */
  minSpan: number;
}

/** Shift a view so it lies inside the bounds, keeping its span when possible. */
export function clampView(v: View, b: Bounds): View {
  let span = Math.min(Math.max(v.x1 - v.x0, b.minSpan), b.max - b.min);
  let x0 = v.x0;
  if (x0 < b.min) x0 = b.min;
  if (x0 + span > b.max) x0 = b.max - span;
  return { x0, x1: x0 + span };
}

/**
 * Zoom by `factor` (< 1 zooms in, > 1 zooms out) around `anchor`, a fraction
 * 0..1 across the plot. The data point under the anchor stays under it.
 */
export function zoomView(v: View, factor: number, anchor: number, b: Bounds): View {
  const span = v.x1 - v.x0;
  const at = v.x0 + span * anchor;
  const newSpan = Math.min(Math.max(span * factor, b.minSpan), b.max - b.min);
  return clampView({ x0: at - newSpan * anchor, x1: at - newSpan * anchor + newSpan }, b);
}

/** Pan by a fraction of the current span (positive moves the view right/later). */
export function panView(v: View, fraction: number, b: Bounds): View {
  const dx = (v.x1 - v.x0) * fraction;
  return clampView({ x0: v.x0 + dx, x1: v.x1 + dx }, b);
}
