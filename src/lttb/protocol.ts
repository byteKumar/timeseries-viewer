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
}

export type ToWorker = LoadMessage | DownsampleRequest;

export interface DownsampleResult {
  id: number;
  x0: number;
  x1: number;
  /** One entry per series; each has its own x because LTTB keeps different points. */
  lines: { x: Float64Array; y: Float64Array }[];
  /** Raw points in the visible range (per series), before downsampling. */
  visiblePoints: number;
  workerMs: number;
}
