import { expect, type Page } from '@playwright/test';

/** Wait until the chart has painted its first frame (render-time mark set in src/perf.ts). */
export async function waitForChart(page: Page) {
  await page.waitForFunction(() => window.__tsv?.renderMs !== undefined, null, { timeout: 60_000 });
}

/** The visible range as [startMs, endMs] since midnight, parsed from the "HH:MM:SS.mmm – HH:MM:SS.mmm UTC" label. */
export async function visibleRange(page: Page): Promise<[number, number]> {
  const text = (await page.getByTestId('range').textContent()) ?? '';
  const m = [...text.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d\d\d)/g)];
  expect(m).toHaveLength(2);
  const ms = (g: RegExpMatchArray) => ((+g[1] * 60 + +g[2]) * 60 + +g[3]) * 1000 + +g[4];
  return [ms(m[0]), ms(m[1])];
}

export const span = ([a, b]: [number, number]) => b - a;

/** The permalink is written 250 ms after the view settles. */
export async function urlParam(page: Page, key: string) {
  await expect.poll(() => new URL(page.url()).searchParams.get(key)).not.toBeNull();
  return new URL(page.url()).searchParams.get(key);
}
