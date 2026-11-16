import { formatTime } from '../chart/Crosshair';
import type { View } from '../chart/viewport';
import { trendWord, type RangeStats } from './summary';

interface Props {
  id: string;
  names: string[];
  visible: boolean[];
  stats: (RangeStats | null)[] | null;
  view: View;
}

const num = (v: number) => v.toFixed(2);

/**
 * Text alternative for the canvas: what the visible range contains. Visually
 * hidden and referenced by the plot's aria-describedby, so a screen reader
 * reads it when the chart gets focus. Not a live region (it would chatter on every pan).
 */
export function ChartSummary({ id, names, visible, stats, view }: Props) {
  const parts = names.map((name, i) => {
    if (!visible[i]) return `${name}: hidden.`;
    const s = stats?.[i];
    if (!s) return `${name}: calculating.`;
    return `${name}: minimum ${num(s.min)} at ${formatTime(s.minAt)}, maximum ${num(s.max)} at ${formatTime(s.maxAt)}, trend ${trendWord(s)}.`;
  });
  const count = stats?.find((s) => s)?.count;
  return (
    <div id={id} className="sr-only" data-testid="summary">
      Showing {formatTime(view.x0)} to {formatTime(view.x1)} UTC{count ? `, ${count.toLocaleString('en-US')} points per series` : ''}.{' '}
      {parts.join(' ')}
    </div>
  );
}
