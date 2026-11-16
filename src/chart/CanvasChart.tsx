import { useEffect, useLayoutEffect, useRef } from 'react';
import type { SeriesData } from '../data/generate';
import { drawLines, sizeCanvas, type Plot } from './drawCanvas';
import type { RendererProps } from './types';

/**
 * Milestone 2: same work as the SVG baseline (every point, every redraw),
 * but drawn to one <canvas>, so there is no DOM geometry to lay out, keep or
 * hit-test. Redraws after view changes are coalesced to one per animation frame.
 */
export function CanvasChart(props: RendererProps & { data: SeriesData }) {
  const { data, view, width, height, visible, onDrawn, linesRef } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const frame = useRef(0);

  const draw = () => {
    const { data, view, yDomain, width, height, colors, visible } = latest.current;
    const plot: Plot = { width, height, dpr: window.devicePixelRatio || 1 };
    const lines = data.ys.map((y) => ({ x: data.x, y }));
    linesRef.current = lines;
    drawLines(sizeCanvas(canvasRef.current!, plot), plot, lines, colors, view, yDomain, visible);
  };

  // New data: draw synchronously so the first paint already shows it.
  useLayoutEffect(() => {
    draw();
    onDrawn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // View, size or visibility change: at most one redraw per frame, however many events arrived.
  useEffect(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, width, height, visible]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0; // or a remount (e.g. React StrictMode) would think a frame is still queued and never draw
    },
    [],
  );

  return <canvas ref={canvasRef} style={{ display: 'block' }} aria-hidden="true" />;
}
