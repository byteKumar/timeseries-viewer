import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { clampView, panView, zoomView, type Bounds, type View } from './viewport';

/** Zoom factor per wheel "notch" (deltaY = 100 -> about 1.22x). */
const WHEEL_SENSITIVITY = 0.002;
export const BUTTON_ZOOM = 0.5;

/**
 * Owns the visible range and wires wheel-zoom and drag-pan onto `plotRef`.
 * Wheel uses a native non-passive listener because React's onWheel is passive
 * and can't call preventDefault (which stops the page from scrolling).
 */
export function useViewport(plotRef: RefObject<HTMLElement | null>, bounds: Bounds, initial: View | null = null) {
  // Start from the permalink's range if there is one (clamped: URLs are user input).
  const [view, setView] = useState<View>(() => (initial ? clampView(initial, bounds) : { x0: bounds.min, x1: bounds.max }));
  const [dragging, setDragging] = useState(false);

  // Different data later on -> show all of it. Skipped on mount, so the initial view survives.
  const lastBounds = useRef(bounds);
  useEffect(() => {
    if (lastBounds.current === bounds) return;
    lastBounds.current = bounds;
    setView({ x0: bounds.min, x1: bounds.max });
  }, [bounds]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = (e.clientX - rect.left) / rect.width;
      setView((v) => zoomView(v, Math.exp(e.deltaY * WHEEL_SENSITIVITY), anchor, bounds));
    };

    let dragX: number | null = null;
    const onDown = (e: PointerEvent) => {
      dragX = e.clientX;
      el.setPointerCapture(e.pointerId);
      setDragging(true);
    };
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return;
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      // Dragging right moves the content right, i.e. the view moves left.
      setView((v) => panView(v, -dx / el.clientWidth, bounds));
    };
    const onUp = () => {
      dragX = null;
      setDragging(false);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [plotRef, bounds]);

  /** Zoom around `anchor` (fraction across the plot; default the centre). */
  const zoomBy = useCallback(
    (factor: number, anchor = 0.5) => setView((v) => zoomView(v, factor, Math.min(1, Math.max(0, anchor)), bounds)),
    [bounds],
  );
  /** Pan just enough that time `t` is inside the view (with a 5% margin). */
  const ensureVisible = useCallback(
    (t: number) =>
      setView((v) => {
        const margin = (v.x1 - v.x0) * 0.05;
        if (t < v.x0 + margin) return panView(v, (t - margin - v.x0) / (v.x1 - v.x0), bounds);
        if (t > v.x1 - margin) return panView(v, (t + margin - v.x1) / (v.x1 - v.x0), bounds);
        return v;
      }),
    [bounds],
  );
  const reset = useCallback(() => setView({ x0: bounds.min, x1: bounds.max }), [bounds]);

  return { view, dragging, zoomBy, reset, ensureVisible };
}
