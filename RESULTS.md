# Results

All numbers are measured with `npm run build && npm run bench` (see `bench/run.ts`). Raw runs are in `bench/results/`.

**Method (spec section 4):** production build served by `vite preview`; headed Google Chrome 157.0.8103.52 driven by Playwright; desktop viewport 1280×800 at devicePixelRatio 2; a fresh browser context per run; **median of 3 runs** per cell. The harness refuses to run while another benchmark, load test or training job is running on the machine.

- **render ms**: from "data ready" (after generation) to the first painted frame showing it (`performance.now()`, measured after `requestAnimationFrame` plus a posted message). Data generation is excluded.
- **fps**: `requestAnimationFrame` callbacks per second during a scripted 5 s of wheel zoom (±120 per notch) and drag pan (300 px in 10 steps) over the plot.
- **INP ms**: web-vitals `onINP` after 10 clicks on the "Zoom in" button (fewer than 50 interactions, so INP equals the worst of the 10). Wheel events don't count toward INP, which is why a button is used.
- **block ms**: sum of (duration − 50 ms) over all `longtask` entries during the same 5 s window.

Machine: Apple M3 (8 cores), 16 GB RAM, macOS. "1M points" means **each of the 3 series has 1M points** (3M drawn); 5M means 15M points drawn.

| step | 1M render ms | 1M fps | 1M INP ms | 1M block ms | 5M render ms | 5M fps | 5M INP ms | 5M block ms |
|---|---|---|---|---|---|---|---|---|
| SVG baseline (milestone 1) | 898 | 19.0 | 136 | 2564 | 4522 | 2.8 | 136 | 5194 |
| canvas, all points (milestone 2) | 136 | 39.8 | 120 | 123 | 382 | 13.5 | 224 | 3019 |
| canvas + LTTB worker (milestone 3) | 16 | 60.1 | 40 | 0 | 44 | 59.9 | 40 | 0 |

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

### Milestone 5: keyboard and screen-reader support (2026-11-16)
- **axe (WCAG 2.0/2.1 A + AA rules, `@axe-core/playwright` 4.14 / axe-core 4.14.1): 0 violations before, 0 after.** The "before" scan ran on the milestone 4 code (states: loaded, tooltip visible, one series hidden), with axe's best-practice rules also at 0.
- **Why 0 before isn't the same as "accessible":** before this milestone the chart wasn't focusable at all and had no text alternative. The canvas was `aria-hidden` and the buttons were already real `<button>`s with sufficient contrast, so axe had nothing to flag. axe checks the DOM; it can't tell that a chart has no keyboard access or no description. The real gaps were found by reviewing against the spec's checklist, not by axe.
- Added: focusable plot (`tabindex=0`, `role="application"`, `aria-roledescription="interactive chart"`, label and `aria-describedby`); arrow, Shift+arrow, Page, Home/End, ↑/↓ and +/− keys; an `aria-live="polite"` announcer (debounced 150 ms so a held key doesn't queue dozens of messages); a visually hidden summary of the visible range with exact min, max and trend per series (computed on the raw data in the worker for the LTTB renderer); series toggles already real buttons with `aria-pressed`; visible key help; a 3 px focus ring.
- Contrast is unit-tested with the WCAG formula: text colours 4.54–17.4 : 1, series colours 5.13–6.37 : 1 against white.
- **Not verified:** no manual test with VoiceOver or NVDA. `role="application"` is meant to make screen readers pass arrow keys through, but that wasn't checked by ear.
