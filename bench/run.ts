// Benchmark harness (spec section 4). Run with: npm run build && npm run bench -- [options]
//   --renderers=svg,canvas,lttb   --sizes=1000000,5000000   --runs=3   --label=m1   --force
//
// For each renderer x size x run it opens a fresh browser context on the
// production build and records:
//   render ms : data ready -> first paint that shows it (performance.now marks in the app)
//   INP ms    : web-vitals INP after 10 clicks on "Zoom in" (< 50 interactions, so INP = worst of the 10)
//   fps       : requestAnimationFrame frames per second during a scripted 5 s pan + wheel zoom
//   block ms  : sum over long tasks of (duration - 50 ms) during those same 5 s
// Each cell reports the median of the runs; every raw run is saved to bench/results/.

import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const renderers = (args.renderers ?? 'svg').split(',');
const sizes = (args.sizes ?? '1000000,5000000').split(',').map(Number);
const runs = Number(args.runs ?? 3);
const label = args.label ?? 'run';
const RENDER_TIMEOUT_MS = Number(args.timeout ?? 300_000);
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

// ---------- 1. Refuse to measure while other heavy work is running ----------
function preflight(): string {
  // Anchored / bracketed regexes so they match the real processes, not shells
  // whose command line merely mentions them (e.g. another session's wait loop).
  const patterns = [
    '^k6 ',
    '[j]ava .*ledger',
    '^(ba|z)?sh [^ ]*bench/run-(load|concurrency)',
    '^[^ ]*[Pp]ython[^ ]* .*(train|torch)',
    '^node .*bench/',
    '^[^ ]*[l]ighthouse',
  ];
  const busy: string[] = [];
  for (const p of patterns) {
    let out = '';
    try {
      out = execSync(`pgrep -fl ${JSON.stringify(p)}`, { encoding: 'utf8' });
    } catch {
      continue; // pgrep exits 1 when nothing matches
    }
    for (const line of out.trim().split('\n')) {
      const pid = Number(line.split(' ')[0]);
      if (pid !== process.pid && pid !== process.ppid && !line.includes('pgrep')) busy.push(line.slice(0, 160));
    }
  }
  const load = execSync('sysctl -n vm.loadavg', { encoding: 'utf8' }).trim();
  console.log(`load average ${load}`);
  if (busy.length) {
    console.log('Other heavy processes are running:\n  ' + busy.join('\n  '));
    if (!args.force) {
      console.log('Not measuring. Wait for them to finish, or pass --force (the results then note it).');
      process.exit(2);
    }
  }
  return busy.length ? `FORCED while busy: ${busy.join(' | ')}` : 'no other benchmark/load/training process found';
}

// ---------- 2. Serve the production build ----------
async function startServer() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('vite preview did not start (is port 4173 already in use?)');
}

// ---------- 3. One measured run ----------
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
interface RunResult {
  renderer: string;
  n: number;
  run: number;
  error?: string;
  genMs?: number;
  renderMs?: number;
  inpMs?: number | null;
  maxInteractionMs?: number;
  interactionsOver16ms?: number;
  fps?: number;
  frames?: number;
  windowMs?: number;
  blockingMs?: number;
  longTaskCount?: number;
  longTaskTotalMs?: number;
  wheelEvents?: number;
  dragSteps?: number;
  lodRequests?: number;
  lodRoundTripMedianMs?: number;
  lodRoundTripMaxMs?: number;
  workerMedianMs?: number;
}

const settle = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))));

async function measure(browser: Awaited<ReturnType<typeof chromium.launch>>, renderer: string, n: number, run: number) {
  const res: RunResult = { renderer, n, run };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  let crashed = false;
  page.on('crash', () => (crashed = true));
  try {
    await page.goto(`${BASE}/?renderer=${renderer}&n=${n}&bench=1`);
    await page.waitForFunction(() => window.__tsv?.renderMs !== undefined, null, { timeout: RENDER_TIMEOUT_MS, polling: 200 });
    const tsv = await page.evaluate(() => ({ ...window.__tsv }));
    res.genMs = tsv.genMs;
    res.renderMs = tsv.renderMs;
    await page.evaluate(settle);

    // INP: 10 zoom clicks, each followed by a settled frame.
    for (let i = 0; i < 10; i++) {
      await page.click('#zoom-in');
      await page.evaluate(settle);
    }
    const inp = await page.evaluate(() => ({ ...window.__tsv }));
    res.inpMs = inp.inp ?? null; // null = no interaction reached the 16 ms Event Timing threshold
    res.maxInteractionMs = inp.maxInteractionMs;
    res.interactionsOver16ms = inp.interactions;

    await page.click('#reset');
    await page.evaluate(settle);

    // fps + long tasks during a scripted 5 s of wheel zoom and drag pan.
    const box = (await page.locator('[data-testid=plot]').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const windowPromise = page.evaluate(
      (ms) =>
        new Promise<{ frames: number; elapsed: number; long: number[] }>((resolve) => {
          const long: number[] = [];
          const obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(e.duration)));
          obs.observe({ type: 'longtask' });
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            const elapsed = performance.now() - start;
            if (elapsed >= ms) {
              obs.takeRecords().forEach((e) => long.push(e.duration));
              obs.disconnect();
              resolve({ frames, elapsed, long });
            } else {
              frames++;
              requestAnimationFrame(tick);
            }
          };
          requestAnimationFrame(tick);
        }),
      5000,
    );
    const t0 = Date.now();
    const timeLeft = () => Date.now() - t0 < 5000;
    let wheelEvents = 0;
    let dragSteps = 0;
    await page.mouse.move(cx, cy);
    while (timeLeft()) {
      for (let i = 0; i < 5 && timeLeft(); i++, wheelEvents++) await page.mouse.wheel(0, -120);
      await page.mouse.down();
      for (let s = 1; s <= 10 && timeLeft(); s++, dragSteps++) await page.mouse.move(cx + 30 * s, cy);
      await page.mouse.up();
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 5 && timeLeft(); i++, wheelEvents++) await page.mouse.wheel(0, 120);
      await page.mouse.down();
      for (let s = 1; s <= 10 && timeLeft(); s++, dragSteps++) await page.mouse.move(cx + 300 - 30 * s, cy);
      await page.mouse.up();
      await page.mouse.move(cx, cy);
    }
    const w = await windowPromise;
    res.frames = w.frames;
    res.windowMs = w.elapsed;
    res.fps = w.frames / (w.elapsed / 1000);
    res.longTaskCount = w.long.length;
    res.longTaskTotalMs = w.long.reduce((a, b) => a + b, 0);
    res.blockingMs = w.long.reduce((a, d) => a + Math.max(0, d - 50), 0);
    res.wheelEvents = wheelEvents;
    res.dragSteps = dragSteps;
    // LTTB renderer only: worker timings over the whole run (load + INP clicks + scripted interaction).
    const lod = await page.evaluate(() => ({ rt: window.__tsv.lodRoundTripMs ?? [], w: window.__tsv.workerMs ?? [] }));
    if (lod.rt.length) {
      res.lodRequests = lod.rt.length;
      res.lodRoundTripMedianMs = median(lod.rt);
      res.lodRoundTripMaxMs = Math.max(...lod.rt);
      res.workerMedianMs = median(lod.w);
    }
  } catch (e) {
    res.error = crashed ? 'page crashed (likely out of memory)' : String((e as Error).message).split('\n')[0];
  } finally {
    await context.close().catch(() => {});
  }
  return res;
}

// ---------- 4. Main ----------

const conditions = preflight();
const server = await startServer();
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const chromeVersion = browser.version();
const results: RunResult[] = [];
try {
  for (const renderer of renderers) {
    for (const n of sizes) {
      for (let run = 1; run <= runs; run++) {
        const r = await measure(browser, renderer, n, run);
        results.push(r);
        console.log(JSON.stringify(r));
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}

const fmt = (v: number | undefined | null, d = 0) => (v === undefined ? '—' : v === null ? '<16' : v.toFixed(d));
console.log(`\n${label}: Chrome ${chromeVersion}, headed, 1280x800 @2x, median of ${runs} run(s); ${conditions}`);
console.log('renderer | n | render ms | fps | INP ms | block ms | failed runs');
const summary = [];
for (const renderer of renderers) {
  for (const n of sizes) {
    const ok = results.filter((r) => r.renderer === renderer && r.n === n && !r.error);
    const failed = results.filter((r) => r.renderer === renderer && r.n === n && r.error);
    const pick = (k: keyof RunResult) => {
      const xs = ok.map((r) => r[k]).filter((v): v is number => typeof v === 'number');
      return xs.length ? median(xs) : undefined;
    };
    // INP: a run where no zoom click reached 16 ms counts as "<16"; report that only if most runs had it.
    const inpNull = ok.filter((r) => r.inpMs === null).length;
    const inp = ok.length && inpNull * 2 > ok.length ? null : pick('inpMs');
    const row = { renderer, n, renderMs: pick('renderMs'), fps: pick('fps'), inpMs: inp, blockingMs: pick('blockingMs'), failed: failed.map((f) => f.error) };
    summary.push(row);
    console.log(
      `${renderer} | ${n / 1e6}M | ${fmt(row.renderMs)} | ${fmt(row.fps, 1)} | ${fmt(row.inpMs)} | ${fmt(row.blockingMs)} | ${failed.length}/${runs}${failed.length ? ' (' + failed[0].error + ')' : ''}`,
    );
  }
}

mkdirSync('bench/results', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = `bench/results/${label}-${stamp}.json`;
writeFileSync(
  file,
  JSON.stringify({ label, chromeVersion, conditions, viewport: '1280x800 @2x headed', runsPerCell: runs, summary, results }, null, 2),
);
console.log(`saved ${file}`);
