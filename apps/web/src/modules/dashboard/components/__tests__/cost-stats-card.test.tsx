import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostStatsCard } from '../cost-stats-card';
import type { DashboardStats } from '@/common/types';

const costStats: DashboardStats['costStats'] = {
  last24h: {
    totalCostMicros: 1_500_000,
    totalInputTokens: 150_000,
    totalOutputTokens: 25_000,
    executionsWithCost: 8,
    averageCostMicros: 187_500,
  },
  last7d: {
    totalCostMicros: 10_000_000,
    totalInputTokens: 1_200_000,
    totalOutputTokens: 180_000,
    executionsWithCost: 42,
    averageCostMicros: 238_095,
  },
  last30d: {
    totalCostMicros: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    executionsWithCost: 0,
    averageCostMicros: 0,
  },
};

describe('CostStatsCard', () => {
  it('should render the card title', () => {
    render(<CostStatsCard costStats={costStats} />);

    expect(screen.getByText('Cost Overview')).toBeInTheDocument();
  });

  it('should render the 24h tab by default', () => {
    render(<CostStatsCard costStats={costStats} />);

    expect(screen.getByText('$1.50')).toBeInTheDocument();
    expect(screen.getByText('150.0K')).toBeInTheDocument();
  });

  it('should render all tab triggers', () => {
    render(<CostStatsCard costStats={costStats} />);

    expect(screen.getByRole('tab', { name: '24 Hours' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '30 Days' })).toBeInTheDocument();
  });

  it('should switch to 7d tab', async () => {
    const user = userEvent.setup();
    render(<CostStatsCard costStats={costStats} />);

    await user.click(screen.getByRole('tab', { name: '7 Days' }));

    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('1.2M')).toBeInTheDocument();
  });

  it('should display zero cost when no data', async () => {
    const user = userEvent.setup();
    render(<CostStatsCard costStats={costStats} />);

    await user.click(screen.getByRole('tab', { name: '30 Days' }));

    const zeroCosts = screen.getAllByText('$0.00');
    expect(zeroCosts.length).toBeGreaterThanOrEqual(1);
  });
});
