import { describe, expect, it } from 'vitest';
import { SERIES_COLORS } from '../chart/theme';
import { contrast } from './contrast';
import { rangeStats, trendWord } from './summary';

describe('rangeStats', () => {
  it('finds min, max and where they are', () => {
    const s = rangeStats([0, 1, 2, 3, 4], [3, -2, 8, 1, 0])!;
    expect(s).toMatchObject({ count: 5, min: -2, minAt: 1, max: 8, maxAt: 2 });
  });

  it('fits the trend: a straight line y = 2x over [0, 10] changes by 20', () => {
    const x = Array.from({ length: 11 }, (_, i) => i);
    const s = rangeStats(x, x.map((v) => 2 * v))!;
    expect(s.fittedChange).toBeCloseTo(20);
    expect(trendWord(s)).toBe('rising');
  });

  it('uses only [start, end) and handles empty and single-point ranges', () => {
    const s = rangeStats([0, 1, 2, 3], [9, 1, 2, 9], 1, 3)!;
    expect([s.min, s.max, s.count]).toEqual([1, 2, 2]);
    expect(rangeStats([0, 1], [1, 2], 1, 1)).toBeNull();
    expect(rangeStats([5], [7])!.fittedChange).toBe(0);
  });

  it('calls a noisy signal with no slope flat, and a sinking one falling', () => {
    const x = Array.from({ length: 1000 }, (_, i) => i);
    expect(trendWord(rangeStats(x, x.map((i) => Math.sin(i)))!)).toBe('roughly flat');
    expect(trendWord(rangeStats(x, x.map((i) => -i / 100 + Math.sin(i)))!)).toBe('falling');
  });
});

describe('WCAG 2.1 AA contrast of the palette (colours used in styles.css and the chart)', () => {
  const WHITE = '#ffffff';
  it('matches the reference values', () => {
    expect(contrast('#000000', WHITE)).toBeCloseTo(21);
    expect(contrast('#767676', WHITE)).toBeGreaterThan(4.5); // the classic "lightest AA grey"
  });

  it('text colours reach 4.5:1 on white', () => {
    for (const c of ['#1a1a1a', '#444444', '#555555', '#767676']) expect(contrast(c, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('series lines, plot border and focus ring reach 3:1 against white (non-text contrast, 1.4.11)', () => {
    for (const c of [...SERIES_COLORS, '#767676', '#555555']) expect(contrast(c, WHITE)).toBeGreaterThanOrEqual(3);
  });
});
