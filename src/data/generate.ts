// Synthetic time-series generator: 3 series of sine + noise + spikes.
// Seeded so every run (tests, benchmarks, demo) sees exactly the same data.

export interface SeriesData {
  /** Timestamps in ms since epoch, strictly increasing, shared by all series. */
  x: Float64Array;
  /** One value array per series, each the same length as `x`. */
  ys: Float64Array[];
  names: string[];
}

export const SAMPLE_INTERVAL_MS = 10;
export const START_MS = Date.UTC(2026, 0, 1);

/** mulberry32: tiny, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeriesShape {
  name: string;
  slowPeriod: number; // in samples
  slowAmp: number;
  fastPeriod: number;
  fastAmp: number;
  noise: number; // roughly the noise standard deviation
  offset: number;
}

const SHAPES: SeriesShape[] = [
  { name: 'Power (W)', slowPeriod: 400_000, slowAmp: 2.0, fastPeriod: 6_000, fastAmp: 0.4, noise: 0.15, offset: 0 },
  { name: 'Stroke rate', slowPeriod: 250_000, slowAmp: 1.2, fastPeriod: 2_500, fastAmp: 0.3, noise: 0.25, offset: 4 },
  { name: 'Heart rate', slowPeriod: 900_000, slowAmp: 1.5, fastPeriod: 15_000, fastAmp: 0.2, noise: 0.08, offset: -4 },
];

/** One spike every ~20k samples on average, so 1M points get ~50 spikes per series. */
export const SPIKE_PROBABILITY = 1 / 20_000;

/** Samples generated between yields in the chunked version (~1-2 ms of work on an M3). */
export const GENERATE_CHUNK = 65_536;

/**
 * The one implementation: fills the arrays and pauses (yields) after every
 * `chunk` samples. generateSeries() runs it to the end in one go;
 * generateSeriesChunked() gives the browser a turn at each pause. Same PRNG
 * calls in the same order, so both produce identical data.
 */
function* fill(n: number, seed: number, chunk: number): Generator<void, SeriesData> {
  if (!Number.isInteger(n) || n < 2) throw new Error(`n must be an integer >= 2, got ${n}`);
  const rand = mulberry32(seed);

  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = START_MS + i * SAMPLE_INTERVAL_MS;

  const ys: Float64Array[] = [];
  for (const s of SHAPES) {
    const y = new Float64Array(n);
    const phase = rand() * Math.PI * 2;
    const slowW = (Math.PI * 2) / s.slowPeriod;
    const fastW = (Math.PI * 2) / s.fastPeriod;
    for (let start = 0; start < n; start += chunk) {
      const end = Math.min(n, start + chunk);
      for (let i = start; i < end; i++) {
        // Sum of 3 uniforms minus 1.5 is a cheap bell-shaped noise with sd 0.5.
        const noise = (rand() + rand() + rand() - 1.5) * 2 * s.noise;
        let v = s.offset + s.slowAmp * Math.sin(slowW * i + phase) + s.fastAmp * Math.sin(fastW * i) + noise;
        if (rand() < SPIKE_PROBABILITY) v += (rand() < 0.5 ? -1 : 1) * (3 + rand() * 2);
        y[i] = v;
      }
      yield;
    }
    ys.push(y);
  }

  return { x, ys, names: SHAPES.map((s) => s.name) };
}

export function generateSeries(n: number, seed = 42): SeriesData {
  const it = fill(n, seed, n);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

/** Let the browser handle input and paint. scheduler.yield() where available (Chrome 129+), else a posted message (no 4 ms setTimeout clamp). */
function yieldToBrowser(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}

/**
 * Same data as generateSeries(), generated in chunks so the main thread is never
 * blocked for long (no single long task at page load). Returns null if `signal`
 * is aborted part-way (e.g. the user switched to 5M while 1M was generating).
 */
export async function generateSeriesChunked(n: number, seed = 42, signal?: AbortSignal, chunk = GENERATE_CHUNK): Promise<SeriesData | null> {
  const it = fill(n, seed, chunk);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
    await yieldToBrowser();
    if (signal?.aborted) return null;
  }
}

/** Min and max over all series, padded by 5% so lines don't touch the edges. */
export function yExtent(ys: Float64Array[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const y of ys) {
    for (let i = 0; i < y.length; i++) {
      const v = y[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const pad = (hi - lo) * 0.05 || 1;
  return [lo - pad, hi + pad];
}
