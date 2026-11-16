import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChartSummary } from '../a11y/ChartSummary';
import { rangeStats, type RangeStats } from '../a11y/summary';
import { nearestIndex, visibleRange } from '../lttb/search';
import { SAMPLE_INTERVAL_MS } from '../data/generate';
import type { Dataset } from '../data/dataset';
import { afterNextPaint, markPainted } from '../perf';
import { CanvasChart } from './CanvasChart';
import { Crosshair, formatTime } from './Crosshair';
import type { Line } from './drawCanvas';
import { KEY_HELP, keyAction, type Cursor } from './keyboard';
import { LttbChart } from './LttbChart';
import { SvgChart } from './SvgChart';
import { SERIES_COLORS } from './theme';
import type { RendererProps } from './types';
import { BUTTON_ZOOM, useViewport } from './useViewport';
import type { Bounds, View } from './viewport';

export type Renderer = 'svg' | 'canvas' | 'lttb';

const HEIGHT = 420;
/** URL updates are debounced: Chrome throttles history.replaceState if called every frame. */
const URL_DEBOUNCE_MS = 250;
/** Wait for key repeat to pause before speaking, so a held arrow key doesn't queue dozens of announcements. */
const ANNOUNCE_DEBOUNCE_MS = 150;

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
  const { view, dragging, zoomBy, reset, ensureVisible } = useViewport(plotRef, bounds, initialView);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [stats, setStats] = useState<(RangeStats | null)[] | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const announceZoom = useRef(false);
  const ids = useId();
  const helpId = `${ids}-help`;
  const summaryId = `${ids}-summary`;

  // Summary stats. The LTTB worker sends them with each result (onStats);
  // for the raw renderers compute them here once the view settles.
  useEffect(() => {
    if (!raw) return;
    const t = setTimeout(() => {
      const [s, e] = visibleRange(raw.x, view.x0, view.x1);
      setStats(raw.ys.map((y) => rangeStats(raw.x, y, s, e)));
    }, URL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [raw, view]);

  // What the aria-live region says about the keyboard cursor.
  useEffect(() => {
    if (!cursor) return;
    const t = setTimeout(() => {
      const line = linesRef.current[cursor.series];
      if (!line || line.x.length === 0) return;
      const i = nearestIndex(line.x, cursor.t);
      setAnnouncement(`${meta.names[cursor.series]}, ${formatTime(line.x[i])} UTC, value ${line.y[i].toFixed(3)}`);
    }, ANNOUNCE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cursor, meta.names]);

  // After a keyboard zoom, announce the new range once it settles.
  useEffect(() => {
    if (!announceZoom.current) return;
    const t = setTimeout(() => {
      announceZoom.current = false;
      setAnnouncement(`Showing ${formatTime(view.x0)} to ${formatTime(view.x1)} UTC`);
    }, URL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [view]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const a = keyAction(e.key, e.shiftKey, cursor, linesRef.current, visible, view);
    if (a.kind === 'none') return;
    e.preventDefault(); // stop arrows / space / Home / End from scrolling the page
    if (a.kind === 'move') {
      setCursor(a.cursor);
      ensureVisible(a.cursor.t);
    } else if (a.kind === 'zoom') {
      announceZoom.current = true;
      zoomBy(a.factor, cursor ? (cursor.t - view.x0) / (view.x1 - view.x0) : 0.5);
    } else {
      setCursor(null);
      setAnnouncement('Cursor cleared');
    }
  };

  // Write the permalink once the view has settled.
  useEffect(() => {
    if (!onStateChange) return;
    const t = setTimeout(() => onStateChange({ view, visible }), URL_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [view, visible, onStateChange]);

  // Renderers call this once they have put the current data on screen;
  // we then wait for that frame to be painted and record the render time.
  const onDrawn = useCallback(() => afterNextPaint(markPainted), []);

  const common: RendererProps = { colors: SERIES_COLORS, view, yDomain: meta.yDomain, width: width ?? 0, height: HEIGHT, visible, onDrawn, linesRef, onStats: setStats };
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
      <div
        ref={plotRef}
        className={dragging ? 'plot dragging' : 'plot'}
        data-testid="plot"
        style={{ height: HEIGHT }}
        tabIndex={0}
        // "application" tells screen readers to pass arrow keys to us instead of
        // using them to read the page. The trade-off: inside it they don't read
        // child content, so everything they need is in the label, description and live region.
        role="application"
        aria-roledescription="interactive chart"
        aria-label={`Time series chart of ${meta.names.join(', ')}`}
        aria-describedby={`${summaryId} ${helpId}`}
        onKeyDown={onKeyDown}
      >
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
          pinned={cursor && visible[cursor.series] ? cursor : null}
        />
      </div>
      <ChartSummary id={summaryId} names={meta.names} visible={visible} stats={stats} view={view} />
      <div className="sr-only" aria-live="polite" data-testid="announcer">
        {announcement}
      </div>
      <div className="legend" role="group" aria-label="Series">
        {meta.names.map((name, i) => (
          <button key={name} type="button" className="series-toggle" aria-pressed={visible[i]} onClick={() => toggle(i)}>
            <span className="swatch" style={{ background: visible[i] ? SERIES_COLORS[i] : 'transparent', borderColor: SERIES_COLORS[i] }} /> {name}
          </button>
        ))}
      </div>
      <p id={helpId} className="help">
        Keyboard (focus the chart): {KEY_HELP}
      </p>
    </div>
  );
}
