import { useEffect, useState } from 'react';
import { generateSeries, type SeriesData } from './data/generate';
import { TimeSeriesChart, type Renderer } from './chart/TimeSeriesChart';
import { markDataReady, perf } from './perf';

const RENDERERS: Renderer[] = ['svg'];
const SIZES = [1_000_000, 5_000_000];

function readParams() {
  const p = new URLSearchParams(location.search);
  const r = p.get('renderer') as Renderer | null;
  const n = Number(p.get('n'));
  return {
    renderer: r && RENDERERS.includes(r) ? r : RENDERERS[0],
    n: SIZES.includes(n) ? n : SIZES[0],
  };
}

export function App() {
  const [{ renderer, n }, setParams] = useState(readParams);
  const [data, setData] = useState<SeriesData | null>(null);

  useEffect(() => {
    setData(null);
    // Yield one tick so "Generating…" paints before the main thread is busy.
    const t = setTimeout(() => {
      const t0 = performance.now();
      const d = generateSeries(n);
      perf.genMs = performance.now() - t0;
      perf.n = n;
      perf.renderer = renderer;
      markDataReady();
      setData(d);
    }, 0);
    return () => clearTimeout(t);
  }, [n, renderer]);

  const update = (next: { renderer?: Renderer; n?: number }) => {
    const p = new URLSearchParams(location.search);
    if (next.renderer) p.set('renderer', next.renderer);
    if (next.n) p.set('n', String(next.n));
    history.replaceState(null, '', `?${p}`);
    setParams(readParams());
  };

  return (
    <main>
      <h1>Time-series viewer</h1>
      <p className="controls">
        {SIZES.map((s) => (
          <button key={s} type="button" aria-pressed={n === s} onClick={() => update({ n: s })}>
            {s / 1_000_000}M points
          </button>
        ))}
        <label>
          Renderer{' '}
          <select value={renderer} onChange={(e) => update({ renderer: e.target.value as Renderer })}>
            {RENDERERS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <span>3 series × {n.toLocaleString('en-US')} points each</span>
      </p>
      {data ? <TimeSeriesChart data={data} renderer={renderer} /> : <p role="status">Generating data…</p>}
    </main>
  );
}
