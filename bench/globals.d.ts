// The app exposes its measurements on window.__tsv (see src/perf.ts).
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __tsv: any;
}
