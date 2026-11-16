import { describe, expect, it } from 'vitest';
import { clampView, panView, zoomView, type Bounds } from './viewport';

const b: Bounds = { min: 0, max: 1000, minSpan: 10 };

describe('viewport math', () => {
  it('zooming in around the centre keeps the centre fixed', () => {
    const v = zoomView({ x0: 0, x1: 1000 }, 0.5, 0.5, b);
    expect(v).toEqual({ x0: 250, x1: 750 });
  });

  it('zooming around an anchor keeps the anchored point under the cursor', () => {
    const v = zoomView({ x0: 0, x1: 1000 }, 0.5, 0.2, b);
    // The point at 20% (x = 200) stays at 20% of the new span.
    expect(v.x0 + (v.x1 - v.x0) * 0.2).toBeCloseTo(200);
  });

  it('never zooms out past the data or in past minSpan', () => {
    expect(zoomView({ x0: 100, x1: 900 }, 10, 0.5, b)).toEqual({ x0: 0, x1: 1000 });
    const tiny = zoomView({ x0: 0, x1: 20 }, 0.01, 0.5, b);
    expect(tiny.x1 - tiny.x0).toBe(10);
  });

  it('panning stops at the edges without shrinking the view', () => {
    expect(panView({ x0: 800, x1: 900 }, 5, b)).toEqual({ x0: 900, x1: 1000 });
    expect(panView({ x0: 100, x1: 200 }, -5, b)).toEqual({ x0: 0, x1: 100 });
  });

  it('clampView fixes a view that hangs off the left edge', () => {
    expect(clampView({ x0: -50, x1: 50 }, b)).toEqual({ x0: 0, x1: 100 });
  });
});
