// URL state: ?n=1000000&renderer=lttb&x0=...&x1=...&series=0,2
// x0/x1 are absolute timestamps in ms; `series` lists the visible series
// (absent = all visible). Everything is validated, since URLs are user input.

import type { View } from './chart/viewport';

export interface UrlState {
  n: number | null;
  renderer: string | null;
  view: View | null;
  visible: boolean[] | null;
}

export function parseUrl(search: string, seriesCount = 3): UrlState {
  const p = new URLSearchParams(search);
  const num = (k: string) => {
    const raw = p.get(k);
    if (raw === null || raw.trim() === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const x0 = num('x0');
  const x1 = num('x1');
  let visible: boolean[] | null = null;
  const s = p.get('series');
  if (s !== null) {
    const tokens = s.split(',').filter((t) => t !== '');
    const ids = new Set(tokens.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < seriesCount));
    // "series=" (empty) is a real state: the user hid everything. But a list with
    // no valid ids is a broken link, so ignore it rather than show an empty chart.
    if (tokens.length === 0 || ids.size > 0) visible = Array.from({ length: seriesCount }, (_, i) => ids.has(i));
  }
  return {
    n: num('n'),
    renderer: p.get('renderer'),
    view: x0 !== null && x1 !== null && x1 > x0 ? { x0, x1 } : null,
    visible,
  };
}

/** Merge `patch` into the current query string. `null` removes a key. */
export function serializeUrl(search: string, patch: Partial<UrlState>): string {
  const p = new URLSearchParams(search);
  if (patch.n !== undefined) setOrDelete(p, 'n', patch.n === null ? null : String(patch.n));
  if (patch.renderer !== undefined) setOrDelete(p, 'renderer', patch.renderer);
  if (patch.view !== undefined) {
    setOrDelete(p, 'x0', patch.view ? String(Math.round(patch.view.x0)) : null);
    setOrDelete(p, 'x1', patch.view ? String(Math.round(patch.view.x1)) : null);
  }
  if (patch.visible !== undefined) {
    const v = patch.visible;
    setOrDelete(p, 'series', v === null || v.every(Boolean) ? null : v.flatMap((on, i) => (on ? [i] : [])).join(','));
  }
  const out = p.toString();
  return out ? `?${out}` : '';
}

function setOrDelete(p: URLSearchParams, key: string, value: string | null) {
  if (value === null) p.delete(key);
  else p.set(key, value);
}
