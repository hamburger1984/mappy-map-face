/**
 * Visual regression tests — compare canvas screenshots against stored baselines.
 *
 * Run `npm run test:update-snapshots` to create/update baselines.
 * Subsequent runs will fail if the rendering changes by more than 2% of pixels.
 */
import { test, expect } from '@playwright/test';
import { loadMap } from './helpers.js';

test.describe('Visual regression', () => {
  test('initial map view matches snapshot', async ({ page }) => {
    await loadMap(page);
    // Capture just the canvas element
    const canvas = page.locator('#mapCanvas');
    await expect(canvas).toHaveScreenshot('initial-view.png');
  });

  test('zoomed-in city view matches snapshot', async ({ page }) => {
    await loadMap(page);
    // Zoom in 3 times
    for (let i = 0; i < 3; i++) {
      await page.locator('#zoomInBtn').click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500); // let tiles load
    const canvas = page.locator('#mapCanvas');
    await expect(canvas).toHaveScreenshot('zoomed-in-view.png');
  });

  test('dark theme view matches snapshot', async ({ page }) => {
    await loadMap(page);
    const panel = page.locator('#panel');
    const isCollapsed = await panel.evaluate(el => el.classList.contains('collapsed'));
    if (isCollapsed) {
      await page.locator('#panelToggle').click();
      await page.waitForTimeout(300);
    }
    await page.locator('#toggleThemeBtn').click();
    await page.waitForTimeout(500);
    const canvas = page.locator('#mapCanvas');
    await expect(canvas).toHaveScreenshot('dark-theme-view.png');
  });
});
