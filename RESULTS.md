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

## Notes per milestone

### Milestone 1: SVG baseline (2026-11-16, load average 2.38 at start)
- At 5M the scripted interaction got through only 5 wheel events and **0 drag steps** in 5 s; each input waited about 1 s for the main thread.
- INP from button clicks (136 ms) is the same at 1M and 5M, even though wheel and drag at 5M are far worse. A click on a button doesn't hit-test the plot, but wheel and pointer events do. A one-off check: `document.elementFromPoint` over the SVG took 9–137 ms (1M) and 45–137 ms (5M), against 0 ms over a button. Hit testing explains only part of the ~1 s per wheel event; the rest is presumably re-rasterizing the path, which wasn't measured separately. **INP from clicks understates the cost of wheel/drag for the SVG baseline; the fps and block columns show it.**
