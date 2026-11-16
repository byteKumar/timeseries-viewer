# Results

All numbers are measured, not estimated. Raw per-run JSON is in `bench/results/`.

## Results template (spec section 5)

```
MACHINE: chip=Apple M3 (8 cores) RAM=16 GB, Chrome version=157.0.8103.52

TESTS: 47 unit tests, 22 Playwright tests, all passing? yes
AXE: violations before a11y work=0, after=0

                     | 1M points                          | 5M points
step                 | render ms | fps  | INP ms | block ms | render ms | fps  | INP ms | block ms
SVG baseline         | 898       | 19.0 | 136    | 2564     | 4522      | 2.8  | 136    | 5194
canvas               | 136       | 39.8 | 120    | 123      | 382       | 13.5 | 224    | 3019
canvas + LTTB worker | 16        | 60.1 | 40     | 0        | 44        | 59.9 | 40     | 0

LIGHTHOUSE performance score (demo page): 100 (local production build, mobile preset, LHCI median of 3; was 91 with TBT 370 ms before chunking the demo's data generation)
DEMO URL: not deployed (Vercel deploy skipped for now)

ANYTHING THAT FAILED OR SURPRISED YOU:
- 1M/5M = points PER SERIES (3 series), so 5M draws 15M points. Each cell is the median of 3 runs, headed Chrome, 1280x800 @2x, 60 Hz display, nothing else benchmarking.
- SVG at 5M: 0 drag steps got through in 5 s. Yet its click INP equals 1M (136 ms): clicking a button skips hit-testing the giant <path>, wheel/drag don't (elementFromPoint over the SVG: up to 137 ms).
- Canvas made 5M INP worse than SVG (136 -> 224 ms): the full 15M-point redraw runs on the main thread inside the click's frame.
- LTTB hits the limits of the setup, not of the code: fps 60 = display refresh; INP 40 ms = harness floor (a click that does nothing also measures 40 ms).
- Lighthouse budget FAILED at first (TBT 370 ms > 200): the demo generated 3M points in one 420 ms main-thread task. Chunked generation (same data) -> score 100, TBT 0.
- Final re-run of all renderers on the finished code (second table in RESULTS.md): LTTB render 29 / 72 ms (was 16 / 44) because the worker now also computes exact min/max/trend for the screen-reader summary.
- Bugs hit and fixed: Math.max(...200k values) overflowed the stack (in a test); End key missed the last point (1.7e12 + 1e-9 === 1.7e12; caught by Playwright); permalinks lost 1 ms to rounding (Playwright); ?series=9 hid every series (manual check); a cancelled-rAF id never reset froze the canvas renderer in dev mode under React StrictMode (code review, confirmed against old code).
- One final benchmark run was discarded and re-run because it started at load average 6.66; the load < 4 rule was set beforehand (its summary had already been seen, but the rule decided, not the numbers).
- CI workflow (unit + Playwright + Lighthouse CI) is committed but has never run: GitHub Actions is locked on the account (billing). Everything was run locally.

REPO: commits pushed? yes
```

## How it was measured

`npm run build && npm run bench` (see `bench/run.ts`). Production build served by `vite preview`; **headed** Google Chrome 157.0.8103.52 driven by Playwright; desktop viewport 1280×800 at devicePixelRatio 2 on the built-in 60 Hz display; a fresh browser context per run; **median of 3 runs** per cell. The harness refuses to run while another benchmark, load test or training job is running, or when the 1-minute load average is 4 or more (8 cores).

- **render ms**: from "data ready" (after generation) to the first painted frame showing it (`performance.now()` after `requestAnimationFrame` plus a posted message). Data generation is excluded.
- **fps**: `requestAnimationFrame` callbacks per second during a scripted 5 s of wheel zoom and drag pan (300 px in 10 steps) over the plot.
- **INP ms**: web-vitals `onINP` after 10 clicks on the "Zoom in" button (fewer than 50 interactions, so INP equals the worst of the 10). Wheel events don't count toward INP, which is why a button is used.
- **block ms**: sum of (duration − 50 ms) over all `longtask` entries during the same 5 s window.
- "1M points" means **each of the 3 series has 1M points** (3M drawn); 5M means 15M drawn.

## Table 1: measured at each milestone (the spec's table)

Each row was measured right after its milestone, on that milestone's code.

| step | 1M render ms | 1M fps | 1M INP ms | 1M block ms | 5M render ms | 5M fps | 5M INP ms | 5M block ms |
|---|---|---|---|---|---|---|---|---|
| SVG baseline (milestone 1) | 898 | 19.0 | 136 | 2564 | 4522 | 2.8 | 136 | 5194 |
| canvas, all points (milestone 2) | 136 | 39.8 | 120 | 123 | 382 | 13.5 | 224 | 3019 |
| canvas + LTTB worker (milestone 3) | 16 | 60.1 | 40 | 0 | 44 | 59.9 | 40 | 0 |

## Table 2: all renderers on the finished code, one sitting (2026-11-16 12:39, load average 2.63)

Milestones 4–6 changed the shipped code: crosshair work on every mouse move, exact stats in the worker, debounced and overscanned detail requests, chunked data generation. So all three renderers were measured again, back to back, on the final build. File: `bench/results/final-all-2026-11-16T17-42-08-699Z.json`.

| renderer | 1M render ms | 1M fps | 1M INP ms | 1M block ms | 5M render ms | 5M fps | 5M INP ms | 5M block ms |
|---|---|---|---|---|---|---|---|---|
| SVG | 930 | 18.8 | 176 | 2589 | 4393 | 2.9 | 168 | 4095 |
| canvas | 146 | 40.9 | 144 | 44 | 351 | 13.8 | 224 | 2965 |
| canvas + LTTB worker | 29 | 60.1 | 40 | 0 | 72 | 60.1 | 40 | 0 |

- **LTTB render is slower than at milestone 3** (16 → 29 ms at 1M, 44 → 72 ms at 5M). For the screen-reader summary, the worker now also makes a pass for exact min, max and trend over the visible raw data. Median worker time per request at 5M: 32–52 ms here, against 11.5 ms at milestone 3. The debounce also cut requests per run from ~200 to 3–6, so the median now comes mostly from the large initial full-range request.
- SVG and canvas INP at 1M rose (136 → 176, 120 → 144 ms). The likely cause is the crosshair's React re-render on every pointer move; this wasn't checked with a trace.
- A first attempt at this table (`…T17-09-10…-INVALID-load-6.66-at-start.json`) started at load average 6.66, right after Lighthouse. It broke the load < 4 rule set before measuring, so it was discarded and re-run. Its numbers aren't used.

## Lighthouse (`npm run lighthouse`, local production build)

LHCI 0.16.1 / Lighthouse 13.6.0, default mobile preset (simulated throttling, 4× CPU slowdown), headless Chrome 157, URL `/?n=1000000&renderer=lttb`, 3 runs; LHCI's representative (median) run is reported. Budget in `lighthouserc.json`, set **before** the first run from the published "good" thresholds: performance ≥ 0.9, LCP ≤ 2.5 s, TBT ≤ 200 ms, CLS ≤ 0.1, accessibility ≥ 0.9.

| run set | performance | accessibility | LCP | TBT | CLS | budget |
|---|---|---|---|---|---|---|
| before (data generated in one task) — runs 0.81 / 0.92 / 0.91 | 0.91 | 1.00 | 1202 ms | 370 ms | 0 | **failed** (TBT) |
| after chunked generation — runs 1.00 / 1.00 / 1.00 | 1.00 | 1.00 | 1202 ms | 0 ms | 0 | passed |

The failure came from one ~420 ms long task (simulated) in the main bundle at ~1.2 s into the load: the demo generating 3M points on the main thread. The fix generates the same data in 65,536-sample chunks with `scheduler.yield()` between them; a unit test checks it's identical to the one-shot version. The GitHub Actions workflow runs the same budget, but it has never run because Actions is locked on the account.

## Tests

- **47 unit tests** (Vitest): generator, viewport math, canvas mapping, LTTB (first/last point, extremes, output length, order, sub-ranges), binary search, permalinks, keyboard logic, range stats, WCAG contrast of the palette.
- **22 Playwright tests** (installed Chrome 157, production build): zoom/pan/tooltip for each of the 3 renderers, keyboard navigation, the hidden summary, permalink restore (shared URL, reload, broken URL), the 5M button, level-of-detail refresh after resizing and zooming, and the axe scan. They passed 34/34 across a 2× repeat run, before the last 5 tests were added; the final suite passed 22/22.

## Notes per milestone

### Milestone 1: SVG baseline (2026-11-16, load average 2.38 at start)
- At 5M the scripted interaction got through only 5 wheel events and **0 drag steps** in 5 s; each input waited about 1 s for the main thread.
- INP from button clicks (136 ms) is the same at 1M and 5M, even though wheel and drag at 5M are far worse. A click on a button doesn't hit-test the plot, but wheel and pointer events do. A one-off check: `document.elementFromPoint` over the SVG took 9–137 ms (1M) and 45–137 ms (5M), against 0 ms over a button. Hit testing explains only part of the ~1 s per wheel event; the rest is presumably re-rasterizing the path, which wasn't measured separately. **INP from clicks understates the cost of wheel/drag for the SVG baseline; the fps and block columns show it.**

### Milestone 2: canvas, every point redrawn (2026-11-16, load average 3.29 at start)
- Render time dropped 6.6× at 1M (898 → 136 ms) and 11.8× at 5M (4522 → 382 ms). Building a 70 MB path string and parsing it into SVG geometry is gone; canvas just strokes the arrays.
- fps doubled at 1M (19.0 → 39.8) and went from 2.8 to 13.5 at 5M. The scripted interaction got through 30 wheel events and ~55 drag steps at 1M (SVG: 15 and ~27).
- **INP got worse at 5M (136 → 224 ms).** Each zoom click now runs a full redraw of 15M `lineTo` calls on the main thread before the next frame, and INP includes that. With SVG, the click only changed the `viewBox` attribute on the main thread. Its heavy work (hit testing on wheel/pointer events, rasterizing) didn't land inside a button click's interaction the same way. Not verified with a trace.
- The first 1M run's render (338 ms) was much slower than runs 2 and 3 (134, 136 ms); the median hides that cold-start run, and the raw value is in the JSON.
- Conditions: a Chrome 156 helper (the Claude desktop app's built-in browser) was using ~27% of one core when the run started. Below the harness's "busy" threshold, but not zero.

### Milestone 3: LTTB in a Web Worker (2026-11-16, load average 3.25 at start)
- The worker gets the raw arrays once (transferred, not copied) and returns ~2 × plot width points per series (2,396 for this 1,198 px plot). The main thread draws ~7,200 points instead of 3M or 15M.
- **Both interaction metrics are now at the limits of the measurement setup, not of the code:**
  - **fps 60 is the display's refresh rate.** The page gets 62 rAF callbacks per second when idle on this 60 Hz built-in display, so fps can't go higher and doesn't separate further improvements.
  - **INP 40 ms is the floor of this harness.** A one-off check: 10 clicks on a button that only re-renders (re-clicking the already-selected "1M points") also gave INP = 40 ms. Event Timing durations are rounded to 8 ms. This check ran at load average 5.38, above the harness threshold, so only the 40 ms floor is taken from it, and its other numbers aren't reported.
- Long tasks: none at all during the 5 s scripted interaction at either size (block ms = 0, 0 long tasks in all 6 runs).
- The scripted interaction got through 73–74 wheel events and 140 drag steps at both sizes (canvas at 5M: 10 and ~20).
- Worker timings (median of per-run medians; all requests in a run: initial, INP clicks, scripted interaction):
  - 1M: worker downsample 5.3 ms, request→result on the main thread 6.6 ms (max 39 ms), ~226 requests per run.
  - 5M: worker downsample 11.5 ms, request→result 14.9 ms (max 38 ms), ~204 requests per run.
  - While a request is in flight, the chart redraws the previous points stretched to the new view, so the frame after an input is fast; full detail arrives 1–2 frames later. INP measures the first of those, not the full-detail one.
- The first 1M run's render (62 ms) was slower than runs 2 and 3 (16, 15 ms): worker startup and code compilation on a cold browser.
- Bug found while writing tests: `Math.max(...y)` over 200,000 values throws "Maximum call stack size exceeded" (spread passes every element as an argument). The test now uses a loop. LTTB itself kept all 6 global extremes of the generated data.

### Milestone 4: pan, zoom, tooltip, permalinks (2026-11-16)
- Not benchmarked at the milestone (the spec doesn't ask); covered by Table 2.
- Checked in the browser: 20 wheel events in a burst sent 0 worker requests while arriving and exactly 1 about 100 ms after they stopped (debounce).
- Bug found: `?series=9` (an id that doesn't exist) hid every series. A list with no valid ids is now ignored; an explicitly empty `series=` still means "all hidden".

### Milestone 5: keyboard and screen-reader support (2026-11-16)
- **axe (WCAG 2.0/2.1 A + AA rules, `@axe-core/playwright` 4.14 / axe-core 4.14.1): 0 violations before, 0 after.** The "before" scan ran on the milestone 4 code (states: loaded, tooltip visible, one series hidden), with axe's best-practice rules also at 0.
- **Why 0 before isn't the same as "accessible":** before this milestone the chart wasn't focusable at all and had no text alternative. The canvas was `aria-hidden` and the buttons were already real `<button>`s with sufficient contrast, so axe had nothing to flag. axe checks the DOM; it can't tell that a chart has no keyboard access or no description. The real gaps were found by reviewing against the spec's checklist, not by axe.
- Added: focusable plot (`tabindex=0`, `role="application"`, `aria-roledescription="interactive chart"`, label and `aria-describedby`); arrow, Shift+arrow, Page, Home/End, ↑/↓ and +/− keys; an `aria-live="polite"` announcer (debounced 150 ms so a held key doesn't queue dozens of messages); a visually hidden summary of the visible range with exact min, max and trend per series (computed on the raw data in the worker for the LTTB renderer); series toggles already real buttons with `aria-pressed`; visible key help; a 3 px focus ring.
- Contrast is unit-tested with the WCAG formula: text colours 4.54–17.4 : 1, series colours 5.13–6.37 : 1 against white.
- **Not verified:** no manual test with VoiceOver or NVDA. `role="application"` is meant to make screen readers pass arrow keys through, but that wasn't checked by ear.

### Milestone 6: tests, Lighthouse CI, Storybook, demo (2026-11-16)
- Bugs the new Playwright tests caught:
  - **End key** landed on the second-to-last point: the code used `lowerBound(x, x1 + 1e-9) - 1`, and for epoch-ms timestamps (~1.7×10¹²) adding `1e-9` changes nothing in floating point. Fixed with `upperBound`; a unit test with real timestamps fails on the old code.
  - **Permalinks** came back 1 ms off after a reload because the URL rounded to whole ms. They now store the exact number (`String(number)` round-trips exactly).
- Bug found while checking Storybook: the canvas renderers' unmount cleanup cancelled the queued animation frame but didn't reset its id. In dev mode, React StrictMode mounts twice, so `scheduleDraw()` then believed a frame was always queued and the **canvas renderer never redrew after zooming**. Confirmed against the old code in `npm run dev`, then fixed. Production builds (benchmarks, tests) weren't affected, which is why nothing caught it earlier.
- Seen once, **not reproduced**: in the Storybook manager, the "zoomed in" story once showed very coarse lines (about 14 points per minute). Five targeted Playwright tests (narrow-then-wide viewport at 0/30/100/400 ms, zoom refresh) all pass, and later loads looked right.
- Storybook 10.6 stories: LTTB 1M and 5M, canvas, SVG, zoomed-in initial view, hidden series. `npm run build-storybook` builds them.
- Demo deploy to Vercel: skipped for now (needs your account and `npx vercel login`). The demo page with 1M and 5M buttons runs locally with `npm run build && npm run preview`.

## Not done or not verified
- No hosted demo yet (Vercel deploy skipped).
- CI has never run on GitHub (Actions locked by billing); unit tests, Playwright and Lighthouse were run locally only.
- No manual screen-reader check (VoiceOver/NVDA).
- fps is capped by the 60 Hz display and INP by a 40 ms harness floor, so neither can separate the LTTB renderer from anything faster.
- The causes of SVG's click-vs-wheel gap, canvas's worse 5M INP and the final-code INP rise are inferred from the numbers, not confirmed with a Chrome performance trace.
- Each table cell is one median of 3 runs in one sitting; Lighthouse was 3 runs. No repeat sittings.
- The coarse-lines Storybook glitch above was seen once and not reproduced.
