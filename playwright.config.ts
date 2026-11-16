import { defineConfig } from '@playwright/test';

// Functional and accessibility tests (not the benchmark: that's bench/run.ts).
// Runs against the production build in the installed Google Chrome.
//
// CI runs at devicePixelRatio 1. GitHub's runners have no GPU, so Chrome rasterises
// canvas in software, and the all-points canvas baseline at 2x (a 2396x840 backing
// store full of 3M-segment strokes) is very slow there: locally with --disable-gpu,
// first paint took 45 s and each zoom redraw 1.2-10.9 s, against 0.3 s / ~130 ms at 1x.
// That made 2 canvas tests time out on CI. The tests check behaviour (zoom, pan,
// keyboard, permalinks), not pixel density, which src/chart/drawCanvas.test.ts covers;
// local runs keep 2x. To reproduce CI locally: CI=1 PW_NO_GPU=1 npx playwright test
const onCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: onCI ? 1 : 2,
    launchOptions: { args: process.env.PW_NO_GPU ? ['--disable-gpu'] : [] },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
