import type { SeriesData } from '../data/generate';
import { perf } from '../perf';
import type { DownsampleRequest, DownsampleResult } from './protocol';

/**
 * Main-thread handle to the LTTB worker.
 * - load() TRANSFERS the arrays: after it, the caller's arrays are detached
 *   (length 0). That avoids copying up to 160 MB, but the main thread no
 *   longer has the raw data.
 * - request() keeps at most one request in flight. If the view changes while
 *   the worker is busy, only the newest view is sent next ("latest wins"),
 *   so a fast wheel never builds up a queue of stale work.
 */
export class DownsampleClient {
  private worker = new Worker(new URL('./lttb.worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private inFlight: { id: number; sentAt: number } | null = null;
  private pending: Omit<DownsampleRequest, 'type' | 'id'> | null = null;
  onResult: (r: DownsampleResult) => void = () => {};

  constructor() {
    this.worker.onmessage = (e: MessageEvent<DownsampleResult>) => {
      if (this.inFlight) (perf.lodRoundTripMs ??= []).push(performance.now() - this.inFlight.sentAt);
      (perf.workerMs ??= []).push(e.data.workerMs);
      this.inFlight = null;
      this.onResult(e.data);
      if (this.pending) {
        const next = this.pending;
        this.pending = null;
        this.send(next);
      }
    };
  }

  load(d: SeriesData): void {
    this.worker.postMessage({ type: 'load', x: d.x, ys: d.ys }, [d.x.buffer, ...d.ys.map((y) => y.buffer)]);
  }

  request(x0: number, x1: number, threshold: number, viewX0 = x0, viewX1 = x1): void {
    const req = { x0, x1, threshold, viewX0, viewX1 };
    if (this.inFlight) this.pending = req;
    else this.send(req);
  }

  private send(req: Omit<DownsampleRequest, 'type' | 'id'>): void {
    const id = this.nextId++;
    this.inFlight = { id, sentAt: performance.now() };
    this.worker.postMessage({ type: 'downsample', id, ...req } satisfies DownsampleRequest);
  }

  terminate(): void {
    this.worker.terminate();
  }
}
