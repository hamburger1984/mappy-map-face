/**
 * Tests for zoom in/out behavior.
 */
import { test, expect } from '@playwright/test';
import { loadMap, getZoomKm } from './helpers.js';

test.describe('Zoom controls', () => {
  test('zoom in button reduces view width', async ({ page }) => {
    await loadMap(page);
    const before = await getZoomKm(page);
    await page.locator('#zoomInBtn').click();
    // Wait for re-render
    await page.waitForTimeout(300);
    const after = await getZoomKm(page);
    expect(after).toBeLessThan(before);
  });

  test('zoom out button increases view width', async ({ page }) => {
    await loadMap(page);
    // Zoom in first so we have room to zoom out
    await page.locator('#zoomInBtn').click();
    await page.waitForTimeout(300);
    const before = await getZoomKm(page);
    await page.locator('#zoomOutBtn').click();
    await page.waitForTimeout(300);
    const after = await getZoomKm(page);
    expect(after).toBeGreaterThan(before);
  });

  test('multiple zoom in steps reduce view width monotonically', async ({ page }) => {
    await loadMap(page);
    const levels = [await getZoomKm(page)];
    for (let i = 0; i < 3; i++) {
      await page.locator('#zoomInBtn').click();
      await page.waitForTimeout(200);
      levels.push(await getZoomKm(page));
    }
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    }
    // At least one step should have actually changed
    expect(levels[levels.length - 1]).toBeLessThan(levels[0]);
  });

  test('zoom slider is present and has a value', async ({ page }) => {
    await loadMap(page);
    const slider = page.locator('#zoomSlider');
    await expect(slider).toBeVisible();
    const value = await slider.inputValue();
    expect(parseFloat(value)).toBeGreaterThan(0);
  });

  test('scroll wheel zooms in', async ({ page }) => {
    // Desktop only — skip on mobile devices
    test.skip(page.viewportSize()?.width < 500, 'desktop only');
    await loadMap(page);
    const before = await getZoomKm(page);
    const canvas = page.locator('#mapCanvas');
    const box = await canvas.boundingBox();
    // Scroll up (negative deltaY) = zoom in
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);
    const after = await getZoomKm(page);
    expect(after).toBeLessThan(before);
  });
});
