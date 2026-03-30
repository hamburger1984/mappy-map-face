/**
 * Performance benchmark for the OSM map renderer.
 *
 * Runs a fixed sequence of operations, records timing per step, and compares
 * against a committed baseline to detect regressions.
 *
 * Usage:
 *   npm run benchmark
 *
 * To promote results to baseline after a known-good run:
 *   cp tests/benchmark-results.json tests/benchmark-baseline.json
 */
import { test } from '@playwright/test';
import { loadMap } from './helpers.js';
import {
  setView,
  panTo,
  waitForSettled,
  measureStep,
  getStats,
  loadBaseline,
  saveResults,
  compareToBaseline,
  formatTable,
} from './benchmark-helpers.js';

// Geographic conversion constants (Hamburg at ~53.55°N)
const KM_PER_DEG_LAT = 111.0;
const COS_LAT = Math.cos(53.55 * Math.PI / 180); // ≈ 0.5948
const kmToLatDeg = (km) => -(km / KM_PER_DEG_LAT);
const kmToLonDeg = (km) =>   km / (KM_PER_DEG_LAT * COS_LAT);

test.use({ viewport: { width: 1200, height: 800 } });

test.describe('Renderer benchmark', () => {
  test.setTimeout(120_000);

  test('full benchmark sequence', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chrome',
      'Benchmark runs on desktop-chrome only for comparability'
    );

    const steps = [];

    // ── Step 1: Open default view ─────────────────────────────────────────────
    const loadStart = Date.now();
    await loadMap(page);
    await waitForSettled(page);
    const wallElapsedMs = Date.now() - loadStart;
    steps.push({ step: 'open_default_view', wallElapsedMs, ...(await getStats(page)) });

    // ── Step 2: Zoom out to 150km ─────────────────────────────────────────────
    steps.push(await measureStep(page, 'zoom_out_150km', () => setView(page, 150_000)));

    // ── Step 3: Pan south 200km ───────────────────────────────────────────────
    steps.push(await measureStep(page, 'pan_south_200km', () => panTo(page, kmToLatDeg(200), 0)));

    // ── Step 4: Pan east 100km ────────────────────────────────────────────────
    steps.push(await measureStep(page, 'pan_east_100km', () => panTo(page, 0, kmToLonDeg(100))));

    // ── Step 5: Zoom in to 20km ───────────────────────────────────────────────
    steps.push(await measureStep(page, 'zoom_in_20km', () => setView(page, 20_000)));

    // ── Step 6: Pan back to Hamburg origin ───────────────────────────────────
    steps.push(await measureStep(page, 'pan_to_origin', () =>
      page.evaluate(() => {
        window.renderer.centerLat = 53.55;
        window.renderer.centerLon = 9.99;
        window.renderer.offsetX = 0;
        window.renderer.offsetY = 0;
      })
    ));

    // ── Save and report ───────────────────────────────────────────────────────
    const results = {
      meta: {
        timestamp: new Date().toISOString(),
        project:   testInfo.project.name,
        viewport:  page.viewportSize(),
      },
      steps,
    };

    saveResults(results);
    console.log('\nBenchmark results saved to tests/benchmark-results.json');
    console.log('\n' + formatTable(steps));

    // ── Regression check ──────────────────────────────────────────────────────
    const baseline = loadBaseline();
    if (baseline) {
      const regressions = compareToBaseline(results, baseline);
      if (regressions.length > 0) {
        const msg = regressions
          .map(r => `  [${r.step}] ${r.metric}: ${r.baseline.toFixed(1)} → ${r.current.toFixed(1)}ms (+${r.degradationPct}%)`)
          .join('\n');
        throw new Error(`${regressions.length} performance regression(s) detected:\n${msg}`);
      }
      console.log('\nNo regressions vs baseline.');
    } else {
      console.log('\nNo baseline found. To create one:');
      console.log('  cp tests/benchmark-results.json tests/benchmark-baseline.json');
    }
  });
});
