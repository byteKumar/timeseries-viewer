// Owns the full-resolution data. The main thread transfers the arrays here once
// (zero-copy) and then only asks for "points for [x0, x1] at N points per series".
import { lttb } from './lttb';
import type { DownsampleResult, ToWorker } from './protocol';
import { visibleRange } from './search';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let x: Float64Array = new Float64Array(0);
let ys: Float64Array[] = [];

scope.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  if (msg.type === 'load') {
    x = msg.x;
    ys = msg.ys;
    return;
  }
  const t0 = performance.now();
  const [start, end] = visibleRange(x, msg.x0, msg.x1);
  const lines = ys.map((y) => lttb(x, y, msg.threshold, start, end));
  const result: DownsampleResult = {
    id: msg.id,
    x0: msg.x0,
    x1: msg.x1,
    lines,
    visiblePoints: end - start,
    workerMs: performance.now() - t0,
  };
  // Transfer the result buffers back instead of copying them.
  scope.postMessage(result, lines.flatMap((l) => [l.x.buffer, l.y.buffer]));
};
