import { useEffect, useLayoutEffect, useRef } from 'react';
import type { SeriesData } from '../data/generate';
import { drawLines, sizeCanvas, type Plot } from './drawCanvas';
import type { View } from './viewport';

interface Props {
  data: SeriesData;
  colors: string[];
  view: View;
  yDomain: [number, number];
  width: number;
  height: number;
  onDrawn: () => void;
}

/**
 * Milestone 2: same work as the SVG baseline (every point, every redraw),
 * but drawn to one <canvas>, so there is no DOM geometry to lay out, keep or
 * hit-test. Redraws after view changes are coalesced to one per animation frame.
 */
export function CanvasChart({ data, colors, view, yDomain, width, height, onDrawn }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ data, view, yDomain, width, height });
  latest.current = { data, view, yDomain, width, height };
  const frame = useRef(0);

  const draw = () => {
    const { data, view, yDomain, width, height } = latest.current;
    const plot: Plot = { width, height, dpr: window.devicePixelRatio || 1 };
    const ctx = sizeCanvas(canvasRef.current!, plot);
    drawLines(ctx, plot, data.x, data.ys, colors, view, yDomain);
  };

  // New data: draw synchronously so the first paint already shows it.
  useLayoutEffect(() => {
    draw();
    onDrawn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // View or size change: at most one redraw per frame, however many events arrived.
  useEffect(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, width, height]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
}
