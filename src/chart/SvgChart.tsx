import { memo, useLayoutEffect, useMemo } from 'react';
import type { SeriesData } from '../data/generate';
import type { View } from './viewport';

/**
 * Baseline renderer: one <path> per series containing EVERY point.
 * Path coordinates are seconds since the first sample (x) and -value (y, since
 * SVG's y axis points down). Zoom and pan only change the viewBox, so the path
 * string is built once; the browser still has to re-rasterise every segment.
 */
export function buildSvgPath(x: Float64Array, y: Float64Array): string {
  const x0 = x[0];
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < x.length; i++) {
    chunk += (i === 0 ? 'M' : 'L') + ((x[i] - x0) / 1000).toFixed(2) + ' ' + (-y[i]).toFixed(3);
    if (chunk.length > 65_536) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

interface Props {
  data: SeriesData;
  colors: string[];
  view: View;
  yDomain: [number, number];
  width: number;
  height: number;
  onDrawn: () => void;
}

const Paths = memo(function Paths({ data, colors }: { data: SeriesData; colors: string[] }) {
  const ds = useMemo(() => data.ys.map((y) => buildSvgPath(data.x, y)), [data]);
  return (
    <>
      {ds.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colors[i]} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
});

export function SvgChart({ data, colors, view, yDomain, width, height, onDrawn }: Props) {
  useLayoutEffect(onDrawn, [data, onDrawn]);
  const t0 = data.x[0];
  const [lo, hi] = yDomain;
  const viewBox = `${(view.x0 - t0) / 1000} ${-hi} ${(view.x1 - view.x0) / 1000} ${hi - lo}`;
  return (
    <svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" style={{ display: 'block' }}>
      <Paths data={data} colors={colors} />
    </svg>
  );
}
