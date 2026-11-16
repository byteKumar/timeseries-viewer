import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_INTERVAL_MS } from '../data/generate';
import type { Dataset } from '../data/dataset';
import { afterNextPaint, markPainted } from '../perf';
import { CanvasChart } from './CanvasChart';
import { LttbChart } from './LttbChart';
import { SvgChart } from './SvgChart';
import { BUTTON_ZOOM, useViewport } from './useViewport';
import type { Bounds } from './viewport';

export type Renderer = 'svg' | 'canvas' | 'lttb';

export const SERIES_COLORS = ['#0b62a4', '#b4372a', '#2e7d32'];
const HEIGHT = 420;

interface Props {
  dataset: Dataset;
  renderer: Renderer;
}

export function TimeSeriesChart({ dataset, renderer }: Props) {
  const { meta, raw, client } = dataset;
  const plotRef = useRef<HTMLDivElement>(null);
  // Measured before any renderer mounts, so no renderer draws at a guessed width first.
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo<Bounds>(
    () => ({ min: meta.xMin, max: meta.xMax, minSpan: 50 * SAMPLE_INTERVAL_MS }),
    [meta],
  );
  const { view, zoomBy, reset } = useViewport(plotRef, bounds);

  // Renderers call this once they have put the current data on screen;
  // we then wait for that frame to be painted and record the render time.
  const onDrawn = useCallback(() => afterNextPaint(markPainted), []);

  const common = { colors: SERIES_COLORS, view, yDomain: meta.yDomain, width: width ?? 0, height: HEIGHT, onDrawn };

  return (
    <div className="chart">
      <div className="toolbar">
        <button id="zoom-in" type="button" onClick={() => zoomBy(BUTTON_ZOOM)}>
          Zoom in
        </button>
        <button id="zoom-out" type="button" onClick={() => zoomBy(1 / BUTTON_ZOOM)}>
          Zoom out
        </button>
        <button id="reset" type="button" onClick={reset}>
          Reset
        </button>
        <span className="range">
          {new Date(view.x0).toISOString().slice(11, 23)} – {new Date(view.x1).toISOString().slice(11, 23)} UTC
        </span>
      </div>
      <div ref={plotRef} className="plot" data-testid="plot" style={{ height: HEIGHT }}>
        {width !== null && raw && renderer === 'svg' && <SvgChart data={raw} {...common} />}
        {width !== null && raw && renderer === 'canvas' && <CanvasChart data={raw} {...common} />}
        {width !== null && client && renderer === 'lttb' && <LttbChart client={client} {...common} />}
      </div>
      <ul className="legend">
        {meta.names.map((name, i) => (
          <li key={name}>
            <span className="swatch" style={{ background: SERIES_COLORS[i] }} /> {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
