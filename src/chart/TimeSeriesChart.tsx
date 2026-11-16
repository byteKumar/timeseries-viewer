import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SAMPLE_INTERVAL_MS } from '../data/generate';
import type { Dataset } from '../data/dataset';
import { afterNextPaint, markPainted } from '../perf';
import { CanvasChart } from './CanvasChart';
import { Crosshair, formatTime } from './Crosshair';
import type { Line } from './drawCanvas';
import { LttbChart } from './LttbChart';
import { SvgChart } from './SvgChart';
import type { RendererProps } from './types';
import { BUTTON_ZOOM, useViewport } from './useViewport';
import type { Bounds, View } from './viewport';

export type Renderer = 'svg' | 'canvas' | 'lttb';

export const SERIES_COLORS = ['#0b62a4', '#b4372a', '#2e7d32'];
const HEIGHT = 420;
/** URL updates are debounced: Chrome throttles history.replaceState if called every frame. */
const URL_DEBOUNCE_MS = 250;

interface Props {
  dataset: Dataset;
  renderer: Renderer;
  /** From the permalink, applied once on mount. */
  initialView?: View | null;
  initialVisible?: boolean[] | null;
  /** Called (debounced) when the visible range or the visible series change. */
  onStateChange?: (s: { view: View; visible: boolean[] }) => void;
}

export function TimeSeriesChart({ dataset, renderer, initialView = null, initialVisible = null, onStateChange }: Props) {
  const { meta, raw, client } = dataset;
  const plotRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>([]);
  // Measured before any renderer mounts, so no renderer draws at a guessed width first.
  const [width, setWidth] = useState<number | null>(null);
  const [visible, setVisible] = useState<boolean[]>(() => initialVisible ?? meta.names.map(() => true));

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
  const { view, dragging, zoomBy, reset } = useViewport(plotRef, bounds, initialView);

  // Write the permalink once the view has settled.
  useEffect(() => {
    if (!onStateChange) return;
    const t = setTimeout(() => onStateChange({ view, visible }), URL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [view, visible, onStateChange]);

  // Renderers call this once they have put the current data on screen;
  // we then wait for that frame to be painted and record the render time.
  const onDrawn = useCallback(() => afterNextPaint(markPainted), []);

  const common: RendererProps = { colors: SERIES_COLORS, view, yDomain: meta.yDomain, width: width ?? 0, height: HEIGHT, visible, onDrawn, linesRef };
  const toggle = (i: number) => setVisible((v) => v.map((on, j) => (j === i ? !on : on)));

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
        <span className="range" data-testid="range">
          {formatTime(view.x0)} – {formatTime(view.x1)} UTC
        </span>
      </div>
      <div ref={plotRef} className={dragging ? 'plot dragging' : 'plot'} data-testid="plot" style={{ height: HEIGHT }}>
        {width !== null && raw && renderer === 'svg' && <SvgChart data={raw} {...common} />}
        {width !== null && raw && renderer === 'canvas' && <CanvasChart data={raw} {...common} />}
        {width !== null && client && renderer === 'lttb' && (
          <LttbChart client={client} dataMin={meta.xMin} dataMax={meta.xMax} {...common} />
        )}
        <Crosshair
          plotRef={plotRef}
          linesRef={linesRef}
          view={view}
          yDomain={meta.yDomain}
          width={width ?? 0}
          height={HEIGHT}
          names={meta.names}
          colors={SERIES_COLORS}
          visible={visible}
          suppressed={dragging}
        />
      </div>
      <div className="legend">
        {meta.names.map((name, i) => (
          <button key={name} type="button" className="series-toggle" aria-pressed={visible[i]} onClick={() => toggle(i)}>
            <span className="swatch" style={{ background: visible[i] ? SERIES_COLORS[i] : 'transparent', borderColor: SERIES_COLORS[i] }} /> {name}
          </button>
        ))}
      </div>
    </div>
  );
}
