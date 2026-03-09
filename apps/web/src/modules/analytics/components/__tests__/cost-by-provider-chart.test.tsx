import { render, screen } from '@testing-library/react';
import { CostByProviderChart } from '../cost-by-provider-chart';
import type { ProviderCostBreakdown } from '../../types';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const data: ProviderCostBreakdown[] = [
  { provider: 'claude-code', model: 'opus', totalCostMicros: 3_000_000, count: 5 },
  { provider: 'codex', model: null, totalCostMicros: 1_000_000, count: 3 },
];

describe('CostByProviderChart', () => {
  it('should render the chart title', () => {
    render(<CostByProviderChart data={data} />);
    expect(screen.getByText('Cost by Provider')).toBeInTheDocument();
  });

  it('should render empty state when no data', () => {
    render(<CostByProviderChart data={[]} />);
    expect(screen.getByText('No provider cost data available.')).toBeInTheDocument();
  });

  it('should render chart container with data', () => {
    const { container } = render(<CostByProviderChart data={data} />);
    const chartContainer = container.querySelector('[data-slot="chart"]');
    expect(chartContainer).toBeInTheDocument();
  });
});
