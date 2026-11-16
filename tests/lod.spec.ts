import { expect, test } from '@playwright/test';
import { waitForChart } from './helpers.ts';

// Regression check: the level of detail must follow the plot width, even when the
// page starts narrow (e.g. inside a Storybook iframe that is still being laid out).
for (const delay of [0, 30, 100, 400]) {
  test(`LOD catches up after the plot widens ${delay} ms into loading`, async ({ page }) => {
    await page.setViewportSize({ width: 120, height: 800 });
    await page.goto('/?renderer=lttb&n=1000000');
    if (delay) await page.waitForTimeout(delay);
    await page.setViewportSize({ width: 1280, height: 800 });
    await waitForChart(page);
    // Full view: no overscan possible, so expect 2 points per CSS pixel of plot width.
    await expect
      .poll(() => page.evaluate(() => window.__tsv.drawn), { timeout: 5000 })
      .toMatchObject({ width: 1198, points: 2396 });
  });
}

test('LOD refreshes after zooming in (no stale stretched points left on screen)', async ({ page }) => {
  await page.goto('/?renderer=lttb&n=1000000');
  await waitForChart(page);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  // 1/64 of the data, with one view-width of overscan on each side: 3 x 2396 points.
  await expect.poll(() => page.evaluate(() => window.__tsv.drawn?.points), { timeout: 5000 }).toBe(3 * 2396);
});
