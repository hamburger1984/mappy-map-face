/**
 * Tests for UI controls: theme toggle, hover info, tile edges, export.
 */
import { test, expect } from '@playwright/test';
import { loadMap } from './helpers.js';

async function openPanel(page) {
  const panel = page.locator('#panel');
  const isCollapsed = await panel.evaluate(el => el.classList.contains('collapsed'));
  if (isCollapsed) {
    await page.locator('#panelToggle').click();
    await page.waitForTimeout(300);
  }
}

test.describe('Theme toggle', () => {
  test('theme button toggles label between Light and Dark', async ({ page }) => {
    await loadMap(page);
    await openPanel(page);
    const btn = page.locator('#toggleThemeBtn');
    const before = await btn.innerText();
    await btn.click();
    await page.waitForTimeout(500);
    const after = await btn.innerText();
    expect(before).not.toEqual(after);
    expect(after).toMatch(/light|dark/i);
  });

  test('toggling theme twice returns to original label', async ({ page }) => {
    await loadMap(page);
    await openPanel(page);
    const btn = page.locator('#toggleThemeBtn');
    const original = await btn.innerText();
    await btn.click();
    await page.waitForTimeout(300);
    await btn.click();
    await page.waitForTimeout(300);
    const restored = await btn.innerText();
    expect(restored).toEqual(original);
  });
});

test.describe('Hover info toggle', () => {
  test('hover info button toggles ON/OFF label', async ({ page }) => {
    await loadMap(page);
    await openPanel(page);
    const btn = page.locator('#toggleHoverBtn');
    const before = await btn.innerText();
    await btn.click();
    await page.waitForTimeout(200);
    const after = await btn.innerText();
    expect(before).not.toEqual(after);
    expect(after).toMatch(/on|off/i);
  });
});

test.describe('Tile edges toggle', () => {
  test('tile edges button toggles ON/OFF label', async ({ page }) => {
    await loadMap(page);
    await openPanel(page);
    const btn = page.locator('#toggleTileEdgesBtn');
    const before = await btn.innerText();
    await btn.click();
    await page.waitForTimeout(300);
    const after = await btn.innerText();
    expect(before).not.toEqual(after);
    expect(after).toMatch(/on|off/i);
  });
});

test.describe('Panel', () => {
  test('panel toggle opens and closes the panel', async ({ page }) => {
    await loadMap(page);
    const panel = page.locator('#panel');
    const toggle = page.locator('#panelToggle');

    const startCollapsed = await panel.evaluate(el => el.classList.contains('collapsed'));
    await toggle.click();
    await page.waitForTimeout(300);
    const afterFirst = await panel.evaluate(el => el.classList.contains('collapsed'));
    expect(afterFirst).toBe(!startCollapsed);

    await toggle.click();
    await page.waitForTimeout(300);
    const afterSecond = await panel.evaluate(el => el.classList.contains('collapsed'));
    expect(afterSecond).toBe(startCollapsed);
  });
});
