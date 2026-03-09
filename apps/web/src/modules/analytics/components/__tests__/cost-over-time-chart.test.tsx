import { render, screen } from '@testing-library/react';
import { CostOverTimeChart } from '../cost-over-time-chart';
import type { CostOverTimePoint } from '../../types';

// Recharts relies on SVG rendering which jsdom doesn't support well.
// We test container rendering, not SVG internals.

// Mock ResizeObserver for recharts ResponsiveContainer
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const series: CostOverTimePoint[] = [
  {
    date: '2026-01-15',
    totalCostMicros: 500_000,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    executionCount: 2,
  },
  {
    date: '2026-01-16',
    totalCostMicros: 750_000,
    totalInputTokens: 1500,
    totalOutputTokens: 800,
    executionCount: 3,
  },
];

describe('CostOverTimeChart', () => {
  it('should render the chart title', () => {
    render(<CostOverTimeChart series={series} />);
    expect(screen.getByText('Cost Over Time')).toBeInTheDocument();
  });

  it('should render empty state when no data', () => {
    render(<CostOverTimeChart series={[]} />);
    expect(screen.getByText('No cost data available for the selected period.')).toBeInTheDocument();
  });

  it('should render chart container with data', () => {
    const { container } = render(<CostOverTimeChart series={series} />);
    const chartContainer = container.querySelector('[data-slot="chart"]');
    expect(chartContainer).toBeInTheDocument();
  });
});
