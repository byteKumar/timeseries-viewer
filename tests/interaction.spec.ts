import { expect, test } from '@playwright/test';
import { span, urlParam, visibleRange, waitForChart } from './helpers.ts';

for (const renderer of ['lttb', 'canvas', 'svg']) {
  test.describe(`${renderer} renderer, 1M points`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?renderer=${renderer}&n=1000000`);
      await waitForChart(page);
    });

    test('wheel zooms in around the cursor and back out', async ({ page }) => {
      const full = await visibleRange(page);
      const box = (await page.getByTestId('plot').boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
      // Wheel deltas reach the page scaled (here about half under 2x emulation), so scroll
      // until the view is at most 60% of the data rather than assuming one exact factor.
      for (let i = 0; i < 10 && span(await visibleRange(page)) > span(full) * 0.6; i++) await page.mouse.wheel(0, -200);
      expect(span(await visibleRange(page))).toBeLessThan(span(full) * 0.6);
      const zoomed = await visibleRange(page);
      // The time under the cursor (25% across) stays put, within 1% of the old span.
      const at = (r: [number, number]) => r[0] + span(r) * 0.25;
      expect(Math.abs(at(zoomed) - at(full))).toBeLessThan(span(full) * 0.01);
      await page.mouse.wheel(0, 3000);
      await expect.poll(async () => visibleRange(page)).toEqual(full);
    });

    test('Zoom in button halves the span; drag pans; Reset restores', async ({ page }) => {
      const full = await visibleRange(page);
      await page.getByRole('button', { name: 'Zoom in' }).click();
      const zoomed = await visibleRange(page);
      expect(span(zoomed)).toBeCloseTo(span(full) / 2, -1);

      // Drag right by 20% of the plot: the view moves 20% of its span earlier.
      const box = (await page.getByTestId('plot').boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.5, box.y + 100);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + 100, { steps: 5 });
      await page.mouse.up();
      const panned = await visibleRange(page);
      expect(span(panned)).toBeCloseTo(span(zoomed), -1);
      expect((zoomed[0] - panned[0]) / span(zoomed)).toBeCloseTo(0.2, 1);

      await page.getByRole('button', { name: 'Reset' }).click();
      expect(await visibleRange(page)).toEqual(full);
    });

    test('hovering shows a tooltip with the nearest value of each series', async ({ page }) => {
      const box = (await page.getByTestId('plot').boundingBox())!;
      await page.mouse.move(box.x + box.width / 3, box.y + 50);
      const tip = page.getByTestId('tooltip');
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('UTC');
      for (const name of ['Power (W)', 'Stroke rate', 'Heart rate']) await expect(tip).toContainText(name);
      await page.mouse.move(box.x - 20, box.y - 20);
      await expect(tip).toBeHidden();
    });
  });
}

test.describe('keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?renderer=lttb&n=1000000');
    await waitForChart(page);
  });

  test('Tab reaches the chart, arrows move between points, Up/Down switch series', async ({ page }) => {
    const plot = page.getByTestId('plot');
    for (let i = 0; i < 12 && !(await plot.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(plot).toBeFocused();

    const announcer = page.getByTestId('announcer');
    await page.keyboard.press('ArrowRight');
    await expect(announcer).toContainText(/^Power \(W\), \d\d:\d\d:\d\d\.\d{3} UTC, value -?\d+\.\d{3}$/);
    const first = await announcer.textContent();
    await page.keyboard.press('ArrowRight');
    await expect(announcer).not.toHaveText(first!);
    await page.keyboard.press('ArrowDown');
    await expect(announcer).toContainText('Stroke rate,');
    await page.keyboard.press('ArrowUp');
    await expect(announcer).toContainText('Power (W),');
    expect(await page.evaluate(() => scrollY)).toBe(0); // arrows didn't scroll the page
  });

  test('Home/End jump to the edges of the view; +/- zoom; Escape clears', async ({ page }) => {
    const plot = page.getByTestId('plot');
    await plot.focus();
    const announcer = page.getByTestId('announcer');
    const full = await visibleRange(page);
    const fmt = (ms: number) => new Date(ms).toISOString().slice(11, 23);

    await page.keyboard.press('Home');
    await expect(announcer).toContainText(`${fmt(full[0])} UTC`);
    await page.keyboard.press('End');
    await expect(announcer).toContainText(`${fmt(full[1])} UTC`);

    await page.keyboard.press('+');
    await expect.poll(async () => span(await visibleRange(page))).toBeLessThan(span(full) * 0.6);
    await expect(announcer).toContainText('Showing');
    await page.keyboard.press('-');
    await expect.poll(async () => visibleRange(page)).toEqual(full);

    await page.keyboard.press('Escape');
    await expect(announcer).toHaveText('Cursor cleared');
  });

  test('the hidden summary describes the visible range', async ({ page }) => {
    const summary = page.getByTestId('summary');
    await expect(summary).toContainText('1,000,000 points per series');
    for (const name of ['Power (W)', 'Stroke rate', 'Heart rate']) await expect(summary).toContainText(`${name}: minimum`);
    await page.getByRole('button', { name: 'Heart rate' }).click();
    await expect(summary).toContainText('Heart rate: hidden.');
    await expect(page.getByTestId('plot')).toHaveAttribute('aria-describedby', /summary/);
  });
});

test.describe('permalinks', () => {
  test('a shared URL restores the range and the hidden series', async ({ page }) => {
    await page.goto('/?renderer=lttb&n=1000000&x0=1767229974996&x1=1767231224994&series=0,2');
    await waitForChart(page);
    await expect(page.getByTestId('range')).toHaveText('01:12:54.996 – 01:33:44.994 UTC');
    await expect(page.getByRole('button', { name: 'Power (W)' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Stroke rate' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'Heart rate' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('zooming and toggling update the URL, and a reload restores them', async ({ page }) => {
    await page.goto('/?renderer=canvas&n=1000000');
    await waitForChart(page);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Heart rate' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('series')).toBe('0,1');
    await urlParam(page, 'x0');
    const before = await page.getByTestId('range').textContent();

    await page.reload();
    await waitForChart(page);
    await expect(page.getByTestId('range')).toHaveText(before!);
    await expect(page.getByRole('button', { name: 'Heart rate' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a broken URL falls back to the full view with all series', async ({ page }) => {
    await page.goto('/?renderer=lttb&n=1000000&x0=nope&x1=5&series=9');
    await waitForChart(page);
    await expect(page.getByTestId('range')).toHaveText('00:00:00.000 – 02:46:39.990 UTC');
    for (const name of ['Power (W)', 'Stroke rate', 'Heart rate'])
      await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
  });
});

test('the 5M button loads 5 million points per series', async ({ page }) => {
  await page.goto('/?renderer=lttb&n=1000000');
  await waitForChart(page);
  await page.getByRole('button', { name: '5M points' }).click();
  await expect(page.getByTestId('summary')).toContainText('5,000,000 points per series', { timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get('n')).toBe('5000000');
});
