import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG 2.0 / 2.1, levels A and AA. axe can't judge what's drawn inside a canvas;
// it checks the DOM around it (roles, names, contrast, focus, live regions).
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, state: string) {
  const r = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = r.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length} node(s)): ${v.help}`);
  console.log(`[axe] ${state}: ${r.violations.length} violation(s)${summary.length ? '\n  ' + summary.join('\n  ') : ''}`);
  return r.violations;
}

test('no WCAG 2.1 A/AA violations: loaded chart, hover tooltip, hidden series', async ({ page }) => {
  await page.goto('/?renderer=lttb&n=1000000');
  await expect(page.getByTestId('plot').locator('canvas')).toBeVisible();
  const loaded = await scan(page, 'loaded');

  const box = (await page.getByTestId('plot').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('tooltip')).toBeVisible();
  const hover = await scan(page, 'tooltip visible');

  await page.getByRole('button', { name: 'Stroke rate' }).click();
  const hidden = await scan(page, 'one series hidden');

  // Keyboard: focus the chart, move the cursor, so the live region and focus ring are in play.
  await page.mouse.move(0, 0);
  await page.getByTestId('plot').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('announcer')).toContainText('UTC, value');
  const keyboard = await scan(page, 'keyboard cursor active');

  expect([...loaded, ...hover, ...hidden, ...keyboard]).toEqual([]);
});
