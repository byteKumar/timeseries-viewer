import { describe, expect, it } from 'vitest';
import { nearestIndex } from './lttb/search';
import { parseUrl, serializeUrl } from './permalink';

describe('permalink', () => {
  it('round-trips view, series, size and renderer', () => {
    const search = serializeUrl('', {
      n: 5_000_000,
      renderer: 'lttb',
      view: { x0: 1_767_225_600_000.4, x1: 1_767_225_660_000 },
      visible: [true, false, true],
    });
    expect(search).toBe('?n=5000000&renderer=lttb&x0=1767225600000&x1=1767225660000&series=0%2C2');
    expect(parseUrl(search)).toEqual({
      n: 5_000_000,
      renderer: 'lttb',
      view: { x0: 1_767_225_600_000, x1: 1_767_225_660_000 },
      visible: [true, false, true],
    });
  });

  it('omits series when all are visible and removes keys set to null', () => {
    expect(serializeUrl('?n=1000000&x0=1&x1=2&series=1', { view: null, visible: [true, true, true] })).toBe('?n=1000000');
  });

  it('ignores invalid or reversed ranges', () => {
    expect(parseUrl('?x0=abc&x1=5').view).toBeNull();
    expect(parseUrl('?x0=10&x1=5').view).toBeNull();
    expect(parseUrl('?x0=&x1=5').view).toBeNull();
    expect(parseUrl('?x0=5').view).toBeNull();
  });

  it('an empty series list means every series is hidden; unknown ids are ignored', () => {
    expect(parseUrl('?series=').visible).toEqual([false, false, false]);
    expect(parseUrl('?series=1,7').visible).toEqual([false, true, false]);
    expect(parseUrl('').visible).toBeNull();
  });

  it('a series list with no valid ids is ignored (all visible), not "hide everything"', () => {
    expect(parseUrl('?series=9').visible).toBeNull();
    expect(parseUrl('?series=a,-1,1.5').visible).toBeNull();
  });
});

describe('nearestIndex', () => {
  const x = Float64Array.from([0, 10, 20, 30]);
  it('picks the closer neighbour and clamps at the ends', () => {
    expect(nearestIndex(x, 4)).toBe(0);
    expect(nearestIndex(x, 6)).toBe(1);
    expect(nearestIndex(x, 25)).toBe(2); // ties go left
    expect(nearestIndex(x, -100)).toBe(0);
    expect(nearestIndex(x, 999)).toBe(3);
    expect(nearestIndex(new Float64Array(0), 1)).toBe(-1);
  });
});
