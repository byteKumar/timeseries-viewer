// Instrumentation read by bench/run.ts through window.__tsv.
// "Render time" = from data ready to the first paint that shows it.

export interface TsvPerf {
  n?: number;
  renderer?: string;
  genMs?: number;
  dataReadyAt?: number;
  renderMs?: number;
  /** INP from the web-vitals library (worst interaction while < 50 interactions). */
  inp?: number;
  /** Cross-check: longest Event Timing entry that belongs to an interaction. */
  maxInteractionMs?: number;
  /** Interactions seen by that observer (only ones lasting >= 16 ms are reported). */
  interactions?: number;
  /** LTTB renderer: request -> result received on the main thread, per request. */
  lodRoundTripMs?: number[];
  /** LTTB renderer: time spent downsampling inside the worker, per request. */
  workerMs?: number[];
  /** LTTB renderer: points per series (incl. overscan) and plot width of the last draw. */
  drawn?: { points: number; width: number; x0: number; x1: number };
}

declare global {
  interface Window {
    __tsv: TsvPerf;
  }
}

export const perf: TsvPerf = (window.__tsv = {});

/** Call `cb` right after the browser has painted the next frame. */
export function afterNextPaint(cb: () => void): void {
  requestAnimationFrame(() => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => cb();
    ch.port2.postMessage(null);
  });
}

export function markDataReady(): void {
  perf.dataReadyAt = performance.now();
  perf.renderMs = undefined;
}

export function markPainted(): void {
  if (perf.dataReadyAt !== undefined && perf.renderMs === undefined) {
    perf.renderMs = performance.now() - perf.dataReadyAt;
  }
}

/** Only loaded in bench mode (?bench=1) so the demo doesn't ship web-vitals. */
export async function trackInp(): Promise<void> {
  const { onINP } = await import('web-vitals');
  onINP((m) => (perf.inp = m.value), { reportAllChanges: true, durationThreshold: 16 });

  const seen = new Set<number>();
  perf.interactions = 0;
  perf.maxInteractionMs = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as PerformanceEventTiming[]) {
      if (!e.interactionId) continue;
      if (!seen.has(e.interactionId)) {
        seen.add(e.interactionId);
        perf.interactions = seen.size;
      }
      perf.maxInteractionMs = Math.max(perf.maxInteractionMs ?? 0, e.duration);
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
}
