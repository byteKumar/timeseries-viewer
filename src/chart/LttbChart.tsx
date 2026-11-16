import { useEffect, useRef } from 'react';
import type { DownsampleClient } from '../lttb/client';
import type { DownsampleResult } from '../lttb/protocol';
import { drawLines, sizeCanvas } from './drawCanvas';
import type { RendererProps } from './types';

/** Points kept per series, relative to the plot width in CSS pixels. */
export const POINTS_PER_PIXEL = 2;
/** Wait this long after the last zoom/pan before asking the worker for new detail. */
export const LOD_DEBOUNCE_MS = 100;
/** Also fetch this many view-widths on each side, so short pans show real data at once. */
export const OVERSCAN = 1;

/**
 * Milestone 3/4: the worker downsamples with LTTB; the main thread only draws
 * ~2 x width points per series (x 3 with overscan). On a view change we redraw
 * the points we already have right away (stretched or shifted), and ask for
 * fresh detail once the view has been still for LOD_DEBOUNCE_MS.
 */
export function LttbChart(props: RendererProps & { client: DownsampleClient; dataMin: number; dataMax: number }) {
  const { client, view, width, height, visible, onDrawn, linesRef, dataMin, dataMax } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const frame = useRef(0);
  const firstDrawn = useRef(false);

  const draw = () => {
    const { view, yDomain, width, height, colors, visible } = latest.current;
    const plot = { width, height, dpr: window.devicePixelRatio || 1 };
    drawLines(sizeCanvas(canvasRef.current!, plot), plot, linesRef.current, colors, view, yDomain, visible);
  };

  const scheduleDraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
  };

  useEffect(() => {
    client.onResult = (r: DownsampleResult) => {
      linesRef.current = r.lines;
      if (!firstDrawn.current) {
        // First result for this data set: draw now and report the render time.
        firstDrawn.current = true;
        draw();
        onDrawn();
      } else {
        scheduleDraw();
      }
    };
    return () => {
      client.onResult = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, onDrawn]);

  useEffect(() => {
    const send = () => {
      const span = view.x1 - view.x0;
      const x0 = Math.max(dataMin, view.x0 - span * OVERSCAN);
      const x1 = Math.min(dataMax, view.x1 + span * OVERSCAN);
      // Keep POINTS_PER_PIXEL on screen: scale the budget by how much wider than the view we fetch.
      client.request(x0, x1, Math.round(width * POINTS_PER_PIXEL * ((x1 - x0) / span)));
    };
    if (!firstDrawn.current) {
      send(); // nothing on screen yet: don't wait
      return;
    }
    scheduleDraw(); // show the old points in the new view right away
    const t = setTimeout(send, LOD_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, view, width, height]);

  useEffect(() => {
    if (firstDrawn.current) scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} aria-hidden="true" />;
}
