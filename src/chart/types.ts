import type { MutableRefObject } from 'react';
import type { RangeStats } from '../a11y/summary';
import type { Line } from './drawCanvas';
import type { View } from './viewport';

/** Props every renderer gets from TimeSeriesChart. */
export interface RendererProps {
  colors: string[];
  view: View;
  yDomain: [number, number];
  width: number;
  height: number;
  visible: boolean[];
  /** Called once the current data set is on screen (for the render-time mark). */
  onDrawn: () => void;
  /** Renderers keep this pointing at the points currently on screen, for the crosshair. */
  linesRef: MutableRefObject<Line[]>;
  /** LTTB renderer: exact stats of the visible range, computed in the worker. */
  onStats?: (stats: (RangeStats | null)[]) => void;
}
