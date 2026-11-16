# timeseries-viewer

A React and TypeScript chart that stays responsive with very large time series: 3 series of 1M or 5M points each (up to 15M points). You can pan, zoom, inspect points with a crosshair, and drive it from the keyboard or a screen reader. Every number below was measured; the method and raw runs are in [RESULTS.md](RESULTS.md) and `bench/results/`.

## Why

Dashboards slow down when charts plot every raw point. At Hydrow, an hour-long workout log meant hundreds of thousands of points per chart. This project takes that problem further: render millions of points at interactive frame rates without dropping visual detail, and stay accessible.

## Results

Apple M3 (8 cores, 16 GB), headed Chrome 157, 1280×800 at 2×, production build. Median of 3 runs per cell. "1M" = 1M points **per series**.

| step | 1M render | 1M fps | 1M INP | 1M blocking | 5M render | 5M fps | 5M INP | 5M blocking |
|---|---|---|---|---|---|---|---|---|
| SVG baseline (one `<path>` per series) | 898 ms | 19.0 | 136 ms | 2564 ms | 4522 ms | 2.8 | 136 ms | 5194 ms |
| canvas, every point | 136 ms | 39.8 | 120 ms | 123 ms | 382 ms | 13.5 | 224 ms | 3019 ms |
| canvas + LTTB in a Web Worker | 16 ms | 60.1 | 40 ms | 0 ms | 44 ms | 59.9 | 40 ms | 0 ms |

- At 5M points, render time fell from 4.5 s to 44 ms, and main-thread blocking during a 5 s pan/zoom fell from 5.2 s to 0.
- **Read the last row with its limits:** 60 fps is the display's refresh rate, and 40 ms is the lowest INP this harness can measure (a click that does nothing also gives 40 ms).
- On the finished code (after the accessibility work added exact min/max/trend in the worker), LTTB renders in 29 ms (1M) and 72 ms (5M). Both tables are in [RESULTS.md](RESULTS.md).
- **Lighthouse** (local, mobile preset): performance 100, accessibility 100, TBT 0 ms. The first run failed its TBT budget (370 ms, score 91); [RESULTS.md](RESULTS.md) explains the cause and the fix.
- **axe** (WCAG 2.1 A/AA): 0 violations before and after the accessibility work. That 0 before is explained in RESULTS.md; axe can't see a chart that has no keyboard access.
- **Tests:** 47 unit tests (Vitest) and 22 Playwright tests, all passing locally.

## How it works

- **Data:** a seeded generator (sine + noise + spikes) fills `Float64Array`s, in chunks that yield to the browser so page load has no long task.
- **Rendering:** three swappable renderers (`?renderer=svg|canvas|lttb`), so the baselines and the optimized version run under the same harness.
- **Downsampling:** the raw arrays are *transferred* (not copied) to a Web Worker once. On each view change the worker runs Largest-Triangle-Three-Buckets on the visible range and returns about 2 points per CSS pixel per series. The main thread only draws them, about 7,200 points instead of 3M–15M.
- **Interaction:** wheel zoom around the cursor and drag pan.
  - The chart redraws the points it already has immediately, then asks for fresh detail 100 ms after the view settles, fetching one extra view-width on each side so short pans show real data.
  - At most one worker request is in flight ("latest wins").
  - The crosshair tooltip finds the nearest point by binary search.
- **Permalinks:** the visible range and visible series are kept in the URL (`?x0=…&x1=…&series=0,2`). URL writes are debounced, and the values are validated on load.
- **Accessibility:**
  - The chart is focusable (`role="application"`, so arrow keys reach it), and the arrow, Home/End and +/− keys work.
  - An `aria-live` region announces the current point.
  - A hidden summary gives the exact min, max and trend of the visible range, computed on the raw data in the worker.
  - Series toggles are real buttons, and WCAG AA contrast is unit-tested.

## Run it

Requires Node 24 and Google Chrome (the tests and benchmarks drive your installed Chrome, so no Playwright browser download is needed).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. Use the 1M / 5M buttons and the renderer menu.

| command | what it does |
|---|---|
| `npm test` | unit tests (Vitest) |
| `npm run test:e2e` | Playwright tests + axe scan against the production build in Chrome |
| `npm run build && npm run preview` | production build at http://localhost:4173 |
| `npm run build && npm run bench` | the benchmark in spec section 4 (opens headed Chrome windows; refuses to run while the machine is busy) |
| `npm run lighthouse` | Lighthouse CI with the performance budget in `lighthouserc.json` |
| `npm run storybook` | Storybook at http://localhost:6006 |

Keyboard, once the chart has focus: ←/→ move between points, Shift+←/→ or Page Up/Down jump 10% of the view, ↑/↓ switch series, Home/End go to the first/last point in view, +/− zoom, Escape clears the cursor.

## Project layout

- `src/data/`: generator and data loading
- `src/lttb/`: LTTB, binary search, worker, worker client
- `src/chart/`: renderers, viewport math, crosshair, keyboard logic
- `src/a11y/`: summary statistics, contrast checks
- `src/permalink.ts`: URL state
- `bench/run.ts`: benchmark harness
- `tests/`: Playwright tests
- `.github/workflows/ci.yml`: unit, e2e and Lighthouse CI jobs

## Limitations

- **No hosted demo yet:** the Vercel deploy is pending.
- **CI has never run:** the GitHub Actions workflow is committed, but Actions is currently locked on this account, so every test and measurement above was run locally.
- **No manual screen-reader test** with VoiceOver or NVDA.
- **The renderer gaps aren't fully explained:** they're inferred from the numbers, not traced. This covers why SVG's click INP hides its wheel and drag cost, and why canvas made INP at 5M worse.
