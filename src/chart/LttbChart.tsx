import { useEffect, useRef } from 'react';
import type { DownsampleClient } from '../lttb/client';
import type { DownsampleResult } from '../lttb/protocol';
import { drawLines, sizeCanvas, type Line } from './drawCanvas';
import type { View } from './viewport';

interface Props {
  client: DownsampleClient;
  colors: string[];
  view: View;
  yDomain: [number, number];
  width: number;
  height: number;
  onDrawn: () => void;
}

/** Points kept per series, relative to the plot width in CSS pixels. */
export const POINTS_PER_PIXEL = 2;

/**
 * Milestone 3: the worker downsamples the visible range with LTTB; the main
 * thread only draws ~2 x width points per series. On a view change we redraw
 * the points we already have right away (stretched or shifted to the new view)
 * and ask the worker for fresh ones, which replace them when they arrive.
 */
export function LttbChart({ client, colors, view, yDomain, width, height, onDrawn }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lines = useRef<Line[]>([]);
  const latest = useRef({ view, yDomain, width, height });
  latest.current = { view, yDomain, width, height };
  const frame = useRef(0);
  const firstDrawn = useRef(false);

  const draw = () => {
    const { view, yDomain, width, height } = latest.current;
    const plot = { width, height, dpr: window.devicePixelRatio || 1 };
    drawLines(sizeCanvas(canvasRef.current!, plot), plot, lines.current, colors, view, yDomain);
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
      lines.current = r.lines;
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
    client.request(view.x0, view.x1, Math.round(width * POINTS_PER_PIXEL));
    if (firstDrawn.current) scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, view, width, height]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
