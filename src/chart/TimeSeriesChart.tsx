import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_INTERVAL_MS, yExtent, type SeriesData } from '../data/generate';
import { afterNextPaint, markPainted } from '../perf';
import { CanvasChart } from './CanvasChart';
import { SvgChart } from './SvgChart';
import { BUTTON_ZOOM, useViewport } from './useViewport';
import type { Bounds } from './viewport';

export type Renderer = 'svg' | 'canvas';

export const SERIES_COLORS = ['#0b62a4', '#b4372a', '#2e7d32'];
const HEIGHT = 420;

interface Props {
  data: SeriesData;
  renderer: Renderer;
}

export function TimeSeriesChart({ data, renderer }: Props) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bounds = useMemo<Bounds>(
    () => ({ min: data.x[0], max: data.x[data.x.length - 1], minSpan: 50 * SAMPLE_INTERVAL_MS }),
    [data],
  );
  const yDomain = useMemo(() => yExtent(data.ys), [data]);
  const { view, zoomBy, reset } = useViewport(plotRef, bounds);

  // Renderers call this once they have put the current data on screen;
  // we then wait for that frame to be painted and record the render time.
  const onDrawn = useCallback(() => afterNextPaint(markPainted), []);

  const rendererProps = { data, colors: SERIES_COLORS, view, yDomain, width, height: HEIGHT, onDrawn };

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
        {renderer === 'svg' && <SvgChart {...rendererProps} />}
        {renderer === 'canvas' && <CanvasChart {...rendererProps} />}
      </div>
      <ul className="legend">
        {data.names.map((name, i) => (
          <li key={name}>
            <span className="swatch" style={{ background: SERIES_COLORS[i] }} /> {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
