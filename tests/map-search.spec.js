/**
 * Tests for the in-map search feature.
 */
import { test, expect } from '@playwright/test';
import { loadMap } from './helpers.js';

test.describe('Search', () => {
  test('search box is visible after load', async ({ page }) => {
    await loadMap(page);
    await expect(page.locator('#searchBox')).toBeVisible();
    await expect(page.locator('#searchInput')).toBeVisible();
  });

  test('typing in search shows results', async ({ page }) => {
    await loadMap(page);
    const input = page.locator('#searchInput');
    await input.click();
    await input.fill('Hamburg');
    // Results div should become visible
    await expect(page.locator('#searchResults')).toBeVisible({ timeout: 5_000 });
  });

  test('search results contain clickable items', async ({ page }) => {
    await loadMap(page);
    const input = page.locator('#searchInput');
    await input.fill('Hamburg');
    const results = page.locator('#searchResults');
    await expect(results).not.toBeEmpty({ timeout: 5_000 });
    const items = results.locator('li, .result, [role="option"], div');
    await expect(items.first()).toBeVisible();
  });

  test('clearing search hides results', async ({ page }) => {
    await loadMap(page);
    const input = page.locator('#searchInput');
    await input.fill('Hamburg');
    await expect(page.locator('#searchResults')).toBeVisible({ timeout: 5_000 });
    await input.fill('a'); // < 2 chars triggers hide
    await input.fill('');
    // Results div should be hidden (display:none), not necessarily emptied
    await expect(page.locator('#searchResults')).toBeHidden({ timeout: 3_000 });
  });

  test('pressing Escape clears search', async ({ page }) => {
    await loadMap(page);
    const input = page.locator('#searchInput');
    await input.fill('Hamburg');
    await expect(page.locator('#searchResults')).toBeVisible({ timeout: 5_000 });
    await input.press('Escape');
    // After Escape, input is cleared and results are hidden
    await expect(page.locator('#searchResults')).toBeHidden({ timeout: 3_000 });
    await expect(input).toHaveValue('');
  });
});
