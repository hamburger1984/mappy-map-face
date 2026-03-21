/**
 * Shared helpers for map tests.
 */

/**
 * Navigate to the map and wait until the loading overlay disappears
 * and the canvas is visible.
 */
export async function loadMap(page) {
  await page.goto('/');
  // Wait for loading overlay to hide
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 20_000 });
  // Canvas should now be visible
  await page.locator('#mapCanvas').waitFor({ state: 'visible' });
  // Give the first render a moment to paint
  await page.waitForTimeout(500);
}

/**
 * Read the current zoom level text shown in the UI (e.g. "10.0\nkm").
 * Returns the numeric km value.
 */
export async function getZoomKm(page) {
  const text = await page.locator('#zoomLevel').innerText();
  return parseFloat(text);
}

/**
 * Get canvas pixel color at (x, y) in CSS pixels.
 * Returns { r, g, b, a }.
 */
export async function canvasPixelAt(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    return { r, g, b, a };
  }, { x, y });
}

/**
 * Simulate a mouse drag (pan) on the canvas.
 */
export async function mousePan(page, dx, dy) {
  const canvas = page.locator('#mapCanvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 });
  await page.mouse.up();
}
