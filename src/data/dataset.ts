import type { DownsampleClient } from '../lttb/client';
import { yExtent, type SeriesData } from './generate';

/** What the chart needs to know about a data set without touching the raw arrays. */
export interface DatasetMeta {
  names: string[];
  n: number;
  xMin: number;
  xMax: number;
  yDomain: [number, number];
}

/**
 * `raw` is set for the SVG and canvas renderers. For the LTTB renderer the raw
 * arrays live in the worker (transferred, so detached here) and `client` is set.
 */
export interface Dataset {
  meta: DatasetMeta;
  raw: SeriesData | null;
  client: DownsampleClient | null;
}

export function describe(d: SeriesData): DatasetMeta {
  return { names: d.names, n: d.x.length, xMin: d.x[0], xMax: d.x[d.x.length - 1], yDomain: yExtent(d.ys) };
}
