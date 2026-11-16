import { describe, expect, it } from 'vitest';
import { drawLines, sizeCanvas } from './drawCanvas';

/** Records the path calls a real CanvasRenderingContext2D would receive. */
function fakeCtx() {
  const calls: [string, number, number][] = [];
  const ctx = {
    strokes: 0,
    clearRect() {},
    beginPath() {},
    stroke() {
      ctx.strokes++;
    },
    moveTo: (x: number, y: number) => calls.push(['M', x, y]),
    lineTo: (x: number, y: number) => calls.push(['L', x, y]),
    setTransform() {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D & { strokes: number }, calls };
}

describe('drawLines', () => {
  const plot = { width: 200, height: 100, dpr: 2 };

  it('maps the view to the plot width and flips y so larger values are higher', () => {
    const { ctx, calls } = fakeCtx();
    drawLines(ctx, plot, [0, 5, 10], [[0, 5, 10]], ['#000'], { x0: 0, x1: 10 }, [0, 10]);
    expect(calls).toEqual([
      ['M', 0, 100],
      ['L', 100, 50],
      ['L', 200, 0],
    ]);
  });

  it('places points outside the view off-canvas rather than dropping them', () => {
    const { ctx, calls } = fakeCtx();
    drawLines(ctx, plot, [0, 10, 20], [[0, 0, 0]], ['#000'], { x0: 10, x1: 20 }, [0, 1]);
    expect(calls.map((c) => c[1])).toEqual([-200, 0, 200]);
  });

  it('skips hidden series', () => {
    const { ctx } = fakeCtx();
    drawLines(ctx, plot, [0, 1], [[0, 1], [1, 0]], ['#000', '#111'], { x0: 0, x1: 1 }, [0, 1], [true, false]);
    expect(ctx.strokes).toBe(1);
  });
});

describe('sizeCanvas', () => {
  it('sizes the backing store in device pixels and the element in CSS pixels', () => {
    const { ctx } = fakeCtx();
    const canvas = { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => ctx };
    sizeCanvas(canvas as unknown as HTMLCanvasElement, { width: 600, height: 420, dpr: 2 });
    expect([canvas.width, canvas.height]).toEqual([1200, 840]);
    expect(canvas.style).toEqual({ width: '600px', height: '420px' });
  });
});
