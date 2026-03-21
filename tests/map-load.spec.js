/**
 * Tests that the map loads correctly and shows the initial state.
 */
import { test, expect } from '@playwright/test';
import { loadMap, getZoomKm, canvasPixelAt } from './helpers.js';

test.describe('Map load', () => {
  test('loading overlay disappears and canvas is visible', async ({ page }) => {
    await page.goto('/');
    // The loading overlay may disappear very quickly (tiles cached) — just wait for it to be gone
    await page.locator('#loading').waitFor({ state: 'hidden', timeout: 20_000 });
    await expect(page.locator('#mapCanvas')).toBeVisible();
  });

  test('zoom controls are visible after load', async ({ page }) => {
    await loadMap(page);
    await expect(page.locator('#zoomControls')).toBeVisible();
    await expect(page.locator('#zoomInBtn')).toBeVisible();
    await expect(page.locator('#zoomOutBtn')).toBeVisible();
  });

  test('stats show non-zero feature and tile counts', async ({ page }) => {
    await loadMap(page);
    // featureCount is set during renderMap(), which runs after the loading overlay hides
    // Poll until it's > 0 (gives time for first render + tile fetch)
    await expect.poll(async () => {
      const text = await page.locator('#featureCount').innerText();
      return parseInt(text);
    }, { timeout: 10_000, message: 'featureCount should be > 0' }).toBeGreaterThan(0);

    const tileText = await page.locator('#tileCount').innerText();
    expect(parseInt(tileText)).toBeGreaterThan(0);
  });

  test('canvas is not blank after load', async ({ page }) => {
    await loadMap(page);
    // Poll until the canvas contains more than one distinct color (map has rendered features)
    await expect.poll(async () => {
      return page.evaluate(() => {
        const canvas = document.getElementById('mapCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const seen = new Set();
        const steps = 8;
        for (let xi = 0; xi <= steps; xi++) {
          for (let yi = 0; yi <= steps; yi++) {
            const x = Math.floor(w * xi / steps);
            const y = Math.floor(h * yi / steps);
            const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
            seen.add(`${r},${g},${b}`);
          }
        }
        return seen.size;
      });
    }, { timeout: 10_000, message: 'canvas should render more than one color' }).toBeGreaterThan(1);
  });

  test('initial zoom level is displayed', async ({ page }) => {
    await loadMap(page);
    const km = await getZoomKm(page);
    expect(km).toBeGreaterThan(0);
  });
});
