import { useCallback, useEffect, useState, type RefObject } from 'react';
import { panView, zoomView, type Bounds, type View } from './viewport';

/** Zoom factor per wheel "notch" (deltaY = 100 -> about 1.22x). */
const WHEEL_SENSITIVITY = 0.002;
export const BUTTON_ZOOM = 0.5;

/**
 * Owns the visible range and wires wheel-zoom and drag-pan onto `plotRef`.
 * Wheel uses a native non-passive listener because React's onWheel is passive
 * and can't call preventDefault (which stops the page from scrolling).
 */
export function useViewport(plotRef: RefObject<HTMLElement | null>, bounds: Bounds) {
  const [view, setView] = useState<View>({ x0: bounds.min, x1: bounds.max });

  // New data -> show all of it.
  useEffect(() => setView({ x0: bounds.min, x1: bounds.max }), [bounds.min, bounds.max]);

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

  const zoomBy = useCallback((factor: number) => setView((v) => zoomView(v, factor, 0.5, bounds)), [bounds]);
  const reset = useCallback(() => setView({ x0: bounds.min, x1: bounds.max }), [bounds]);

  return { view, zoomBy, reset };
}
