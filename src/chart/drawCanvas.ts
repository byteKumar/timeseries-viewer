import type { View } from './viewport';

export interface Plot {
  /** CSS pixels. */
  width: number;
  height: number;
  dpr: number;
}

/**
 * Resize the canvas backing store to CSS size x devicePixelRatio so lines are
 * sharp on retina screens. Setting canvas.width clears it, so only do it on change.
 */
export function sizeCanvas(canvas: HTMLCanvasElement, p: Plot): CanvasRenderingContext2D {
  const w = Math.round(p.width * p.dpr);
  const h = Math.round(p.height * p.dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${p.width}px`;
    canvas.style.height = `${p.height}px`;
  }
  const ctx = canvas.getContext('2d')!;
  // Draw in CSS pixels; the transform scales to device pixels.
  ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
  return ctx;
}

export interface Line {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
}

/**
 * Stroke each line as one path. Each line has its own x array because LTTB
 * keeps different points for different series. Cost is proportional to the
 * number of points passed in.
 */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  p: Plot,
  lines: Line[],
  colors: string[],
  view: View,
  yDomain: [number, number],
  visible: boolean[] = lines.map(() => true),
): void {
  ctx.clearRect(0, 0, p.width, p.height);
  const sx = p.width / (view.x1 - view.x0);
  const [lo, hi] = yDomain;
  const sy = p.height / (hi - lo);
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  for (let s = 0; s < lines.length; s++) {
    if (!visible[s]) continue;
    const { x, y } = lines[s];
    if (x.length === 0) continue;
    ctx.strokeStyle = colors[s];
    ctx.beginPath();
    ctx.moveTo((x[0] - view.x0) * sx, (hi - y[0]) * sy);
    for (let i = 1; i < x.length; i++) ctx.lineTo((x[i] - view.x0) * sx, (hi - y[i]) * sy);
    ctx.stroke();
  }
}
