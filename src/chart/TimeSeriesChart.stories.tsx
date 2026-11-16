import type { Meta, StoryObj } from '@storybook/react-vite';
import { START_MS } from '../data/generate';
import { useDataset } from '../data/useDataset';
import { TimeSeriesChart, type Renderer } from './TimeSeriesChart';
import type { View } from './viewport';

interface DemoProps {
  /** Points per series. */
  n: number;
  renderer: Renderer;
  initialView?: View;
  initialVisible?: boolean[];
}

/** Generates seeded demo data and renders the chart, like the demo page does. */
function ChartDemo({ n, renderer, initialView, initialVisible }: DemoProps) {
  const loaded = useDataset(n, renderer, () => ({ view: initialView ?? null, visible: initialVisible ?? null }));
  if (!loaded) return <p role="status">Generating {n.toLocaleString('en-US')} points per series…</p>;
  return (
    <TimeSeriesChart
      // Remount when the data changes so the initial view/series apply again.
      key={`${n}-${renderer}`}
      dataset={loaded.dataset}
      renderer={renderer}
      initialView={loaded.initialView}
      initialVisible={loaded.initialVisible}
    />
  );
}

const meta = {
  title: 'TimeSeriesChart',
  component: ChartDemo,
  argTypes: {
    renderer: { control: 'inline-radio', options: ['lttb', 'canvas', 'svg'] },
    n: { control: 'select', options: [10_000, 100_000, 1_000_000, 5_000_000] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Wheel to zoom, drag to pan, hover for the nearest values. Focus the chart (Tab) and use the arrow keys, Home/End and +/-. ' +
          '`lttb` downsamples in a Web Worker; `canvas` and `svg` draw every point and are the baselines.',
      },
    },
  },
} satisfies Meta<typeof ChartDemo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const LttbWorker1M: Story = { name: 'LTTB worker, 1M points per series', args: { n: 1_000_000, renderer: 'lttb' } };

export const LttbWorker5M: Story = { name: 'LTTB worker, 5M points per series', args: { n: 5_000_000, renderer: 'lttb' } };

export const CanvasAllPoints: Story = {
  name: 'Canvas, every point (100k)',
  args: { n: 100_000, renderer: 'canvas' },
};

export const SvgBaseline: Story = {
  name: 'SVG baseline (100k)',
  args: { n: 100_000, renderer: 'svg' },
};

export const ZoomedIn: Story = {
  name: 'Zoomed in to one minute (permalink-style initial view)',
  args: { n: 1_000_000, renderer: 'lttb', initialView: { x0: START_MS + 3_600_000, x1: START_MS + 3_660_000 } },
};

export const OneSeriesHidden: Story = {
  name: 'Stroke rate hidden',
  args: { n: 1_000_000, renderer: 'lttb', initialVisible: [true, false, true] },
};
