import { useEffect, useState, type MutableRefObject, type RefObject } from 'react';
import { nearestIndex } from '../lttb/search';
import type { Line } from './drawCanvas';
import type { Cursor } from './keyboard';
import type { View } from './viewport';

interface Props {
  plotRef: RefObject<HTMLElement | null>;
  linesRef: MutableRefObject<Line[]>;
  view: View;
  yDomain: [number, number];
  width: number;
  height: number;
  names: string[];
  colors: string[];
  visible: boolean[];
  /** Hide while dragging: the tooltip would just chase the cursor. */
  suppressed: boolean;
  /** Keyboard cursor: shown when the mouse isn't over the plot. */
  pinned: Cursor | null;
}

export const formatTime = (ms: number) => new Date(ms).toISOString().slice(11, 23);

/**
 * Vertical crosshair under the mouse, plus a tooltip with each visible series'
 * nearest point. "Nearest" is found by binary search (O(log n)) over the points
 * currently on screen: the raw data for SVG/canvas, the LTTB output for the
 * worker renderer (the raw data lives in the worker).
 */
export function Crosshair({ plotRef, linesRef, view, yDomain, width, height, names, colors, visible, suppressed, pinned }: Props) {
  const [px, setPx] = useState<number | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => setPx(e.clientX - el.getBoundingClientRect().left - el.clientLeft);
    const onLeave = () => setPx(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [plotRef]);

  const span = view.x1 - view.x0;
  // The mouse wins over the keyboard cursor while it is over the plot.
  const at = px ?? (pinned ? ((pinned.t - view.x0) / span) * width : null);
  if (at === null || suppressed || width === 0) return null;
  const t = view.x0 + (at / width) * span;
  const [lo, hi] = yDomain;
  const points = linesRef.current.flatMap((line, s) => {
    if (!visible[s] || line.x.length === 0) return [];
    const i = nearestIndex(line.x, t);
    return [{ s, x: line.x[i], y: line.y[i] }];
  });
  if (points.length === 0) return null;
  const flip = at > width - 220;

  return (
    <div className="crosshair-layer" aria-hidden="true">
      <div className="crosshair" style={{ transform: `translateX(${at}px)`, height }} />
      {points.map((p) => (
        <div
          key={p.s}
          className={pinned && px === null && pinned.series === p.s ? 'dot active' : 'dot'}
          style={{
            background: colors[p.s],
            transform: `translate(${((p.x - view.x0) / span) * width - 4}px, ${((hi - p.y) / (hi - lo)) * height - 4}px)`,
          }}
        />
      ))}
      <div className="tooltip" data-testid="tooltip" style={{ transform: `translateX(${flip ? at - 212 : at + 12}px)` }}>
        <div className="tooltip-time">{formatTime(points[0].x)} UTC</div>
        {points.map((p) => (
          <div key={p.s}>
            <span className="swatch" style={{ background: colors[p.s] }} /> {names[p.s]}: <b>{p.y.toFixed(3)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
