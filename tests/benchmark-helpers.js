/**
 * Helpers for the map renderer benchmark.
 */
import fs from 'fs';
import path from 'path';

const BASELINE_PATH = path.resolve('tests/benchmark-baseline.json');
const RESULTS_PATH  = path.resolve('tests/benchmark-results.json');
const REGRESSION_THRESHOLD = 0.20; // 20%
const SETTLE_TIMEOUT_MS = 15_000;

/**
 * Set zoom level by driving the slider's input event.
 * The slider uses an inverted log2 scale; we reverse-engineer the correct value.
 */
export async function setView(page, meters) {
  await page.evaluate((meters) => {
    const logMin = Math.log2(window.renderer.minViewWidthMeters);
    const logMax = Math.log2(window.renderer.maxViewWidthMeters);
    const sliderValue = logMax + logMin - Math.log2(meters);
    const slider = document.getElementById('zoomSlider');
    slider.value = sliderValue;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  }, meters);
}

/**
 * Pan by setting centerLat/Lon directly and clearing pixel offsets.
 */
export async function panTo(page, deltaLat, deltaLon) {
  await page.evaluate(({ deltaLat, deltaLon }) => {
    window.renderer.centerLat += deltaLat;
    window.renderer.centerLon += deltaLon;
    window.renderer.offsetX = 0;
    window.renderer.offsetY = 0;
  }, { deltaLat, deltaLon });
}

/**
 * Wait until tiles are fully loaded and a final render completes.
 * 1. Trigger a render and await it.
 * 2. Poll until _tileWorkerCallbacks (a Map) is empty.
 * 3. Trigger a second render to capture the complete state.
 * 4. Brief wait for DOM stats to update.
 */
export async function waitForSettled(page) {
  await page.evaluate(() => window.renderer.renderMap());
  await page.waitForFunction(
    () => (window.renderer._tileWorkerCallbacks?.size ?? 0) === 0,
    { timeout: SETTLE_TIMEOUT_MS, polling: 100 }
  );
  await page.evaluate(() => window.renderer.renderMap());
  await page.waitForTimeout(50);
}

/**
 * Read current performance stats from DOM elements and the renderer state.
 */
export async function getStats(page) {
  return page.evaluate(() => ({
    renderTimeMs:    parseFloat(document.getElementById('renderTime')?.textContent)    || 0,
    featureCount:    parseInt(document.getElementById('featureCount')?.textContent)    || 0,
    tileCount:       parseInt(document.getElementById('tileCount')?.textContent)       || 0,
    tileLoadTimeMs:  parseFloat(document.getElementById('tileLoadTime')?.textContent)  || 0,
    viewWidthMeters: window.renderer.viewWidthMeters,
    centerLat:       window.renderer.centerLat,
    centerLon:       window.renderer.centerLon,
  }));
}

/**
 * Run a benchmark step: execute action, wait for settled state, collect stats.
 */
export async function measureStep(page, name, action) {
  const wallStart = Date.now();
  await action();
  await waitForSettled(page);
  const wallElapsedMs = Date.now() - wallStart;
  const stats = await getStats(page);
  return { step: name, wallElapsedMs, ...stats };
}

export function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

export function saveResults(results) {
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
}

/**
 * Compare results against baseline, returning regressions that exceed the threshold.
 * Only timing metrics are compared (not feature/tile counts, which vary by location).
 */
export function compareToBaseline(results, baseline) {
  const metricsToCheck = ['renderTimeMs', 'wallElapsedMs', 'tileLoadTimeMs'];
  const regressions = [];

  for (const curr of results.steps) {
    const base = baseline.steps.find(s => s.step === curr.step);
    if (!base) continue;

    for (const metric of metricsToCheck) {
      const baseVal = base[metric];
      const currVal = curr[metric];
      if (!baseVal || baseVal === 0) continue;
      const ratio = (currVal - baseVal) / baseVal;
      if (ratio > REGRESSION_THRESHOLD) {
        regressions.push({
          step: curr.step,
          metric,
          baseline: baseVal,
          current: currVal,
          degradationPct: (ratio * 100).toFixed(1),
        });
      }
    }
  }
  return regressions;
}

/**
 * Format steps as an ASCII table for console output.
 */
export function formatTable(steps) {
  const cols = ['step', 'wallElapsedMs', 'renderTimeMs', 'featureCount', 'tileCount', 'tileLoadTimeMs'];
  const widths = cols.map(c => Math.max(c.length, ...steps.map(s => String(s[c] ?? '').length)));
  const row = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' | ');
  const sep = widths.map(w => '-'.repeat(w)).join('-+-');
  return [sep, row(cols), sep, ...steps.map(s => row(cols.map(c => s[c] ?? ''))), sep].join('\n');
}
