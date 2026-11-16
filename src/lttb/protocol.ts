import type { RangeStats } from '../a11y/summary';

// Messages between the main thread and the LTTB worker.

export interface LoadMessage {
  type: 'load';
  x: Float64Array;
  ys: Float64Array[];
}

export interface DownsampleRequest {
  type: 'downsample';
  id: number;
  x0: number;
  x1: number;
  /** Points to keep per series (about 2x the plot width in CSS px). */
  threshold: number;
  /** The range actually on screen (x0/x1 include overscan); stats are computed for this. */
  viewX0: number;
  viewX1: number;
}

export type ToWorker = LoadMessage | DownsampleRequest;

export interface DownsampleResult {
  id: number;
  x0: number;
  x1: number;
  /** One entry per series; each has its own x because LTTB keeps different points. */
  lines: { x: Float64Array; y: Float64Array }[];
  /** Raw points in the requested range (per series), before downsampling. */
  visiblePoints: number;
  /** Exact min / max / trend of the RAW data on screen, per series (for the screen-reader summary). */
  stats: (RangeStats | null)[];
  workerMs: number;
}
