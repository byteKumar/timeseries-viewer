# timeseries-viewer

A React and TypeScript component for exploring very large time-series datasets (1M+ points) smoothly in the browser.

> **Status: in progress.** This README is the design. Performance numbers are added only after they're measured.

## Why

Dashboards slow down when charts plot every raw point. At Hydrow, an hour-long workout log meant hundreds of thousands of points per chart. This project takes that problem further: render millions of points at interactive frame rates without dropping visual detail, and stay accessible.

## Design

- **Rendering:** canvas (WebGL later if needed) instead of SVG, so cost scales with pixels, not points.
- **Downsampling:** LTTB (Largest-Triangle-Three-Buckets) runs in a **Web Worker**, so the main thread stays free; level-of-detail recomputed on zoom.
- **Interaction:** pan, zoom, crosshair and tooltip; URL-state permalinks for the current view.
- **Accessibility:** keyboard navigation between points and series; a screen-reader summary of the visible range (min, max, trend); WCAG 2.1 AA contrast.
- **Quality gates:** Lighthouse CI performance budget in GitHub Actions; Vitest unit tests for LTTB; Playwright tests for interaction.
- **Demo:** Storybook plus a hosted demo with generated 1M and 5M point datasets.

## Build plan

- [ ] Data generator and naive SVG baseline (measure fps and INP as the "before").
- [ ] Canvas renderer, then LTTB in a Web Worker (measure again).
- [ ] Pan, zoom and level-of-detail; permalinks.
- [ ] Keyboard and screen-reader support.
- [ ] Lighthouse CI budget and Playwright tests; Storybook and hosted demo.

## Results

_Not measured yet._ This section gets fps, INP and main-thread time before and after each step.
