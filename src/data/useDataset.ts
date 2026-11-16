import { useEffect, useState } from 'react';
import type { Renderer } from '../chart/TimeSeriesChart';
import type { View } from '../chart/viewport';
import { DownsampleClient } from '../lttb/client';
import { markDataReady, perf } from '../perf';
import { describe, type Dataset } from './dataset';
import { generateSeriesChunked } from './generate';

export interface Loaded {
  dataset: Dataset;
  initialView: View | null;
  initialVisible: boolean[] | null;
}

/**
 * Generate the demo data for (n, renderer) and hand it to the chart.
 * For the LTTB renderer the arrays are transferred to a new worker; the worker
 * is terminated when n or renderer changes or the component unmounts.
 * `getInitial` is read at generation time (e.g. from the URL). Generation is
 * chunked (see generateSeriesChunked); a newer load aborts an unfinished one.
 */
export function useDataset(
  n: number,
  renderer: Renderer,
  getInitial: () => { view: View | null; visible: boolean[] | null } = () => ({ view: null, visible: null }),
): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    setLoaded(null);
    let client: DownsampleClient | null = null;
    const abort = new AbortController();
    void (async () => {
      const initial = getInitial();
      const t0 = performance.now();
      // Chunked so generating 3M-15M points never blocks the page in one long task.
      const d = await generateSeriesChunked(n, 42, abort.signal);
      if (!d) return; // n/renderer changed or unmounted while generating
      perf.genMs = performance.now() - t0;
      perf.n = n;
      perf.renderer = renderer;
      const meta = describe(d); // must run before the arrays are transferred away
      markDataReady();
      let dataset: Dataset;
      if (renderer === 'lttb') {
        client = new DownsampleClient();
        client.load(d); // d.x and d.ys are detached after this line
        dataset = { meta, raw: null, client };
      } else {
        dataset = { meta, raw: d, client: null };
      }
      setLoaded({ dataset, initialView: initial.view, initialVisible: initial.visible });
    })();
    return () => {
      abort.abort();
      client?.terminate();
    };
    // getInitial is read once per load on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, renderer]);

  return loaded;
}
