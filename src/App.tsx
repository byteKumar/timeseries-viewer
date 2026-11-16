import { useCallback, useState } from 'react';
import { TimeSeriesChart, type Renderer } from './chart/TimeSeriesChart';
import type { View } from './chart/viewport';
import { useDataset } from './data/useDataset';
import { parseUrl, serializeUrl } from './permalink';

const RENDERERS: Renderer[] = ['lttb', 'canvas', 'svg'];
const SIZES = [1_000_000, 5_000_000];

function readParams() {
  const u = parseUrl(location.search);
  return {
    renderer: RENDERERS.includes(u.renderer as Renderer) ? (u.renderer as Renderer) : RENDERERS[0],
    n: u.n !== null && SIZES.includes(u.n) ? u.n : SIZES[0],
  };
}

export function App() {
  const [{ renderer, n }, setParams] = useState(readParams);
  const loaded = useDataset(n, renderer, () => parseUrl(location.search));

  const update = (next: { renderer?: Renderer; n?: number }) => {
    // A new size has a different time range, so drop the old range from the URL.
    history.replaceState(null, '', serializeUrl(location.search, { ...next, ...(next.n ? { view: null } : {}) }) || location.pathname);
    setParams(readParams());
  };

  const onStateChange = useCallback((s: { view: View; visible: boolean[] }) => {
    history.replaceState(null, '', serializeUrl(location.search, { n, renderer, view: s.view, visible: s.visible }));
  }, [n, renderer]);

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
      {loaded ? (
        <TimeSeriesChart
          dataset={loaded.dataset}
          renderer={renderer}
          initialView={loaded.initialView}
          initialVisible={loaded.initialVisible}
          onStateChange={onStateChange}
        />
      ) : (
        <p role="status">Generating data…</p>
      )}
    </main>
  );
}
