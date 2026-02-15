import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionStatsTabs } from '../execution-stats-tabs';
import type { DashboardStats } from '@/common/types';

const stats: DashboardStats['executionStats'] = {
  last24h: { total: 10, completed: 8, failed: 1, running: 1 },
  last7d: { total: 50, completed: 42, failed: 5, running: 3 },
  last30d: { total: 200, completed: 180, failed: 15, running: 5 },
};

describe('ExecutionStatsTabs', () => {
  it('should render the 24h tab by default', () => {
    render(<ExecutionStatsTabs stats={stats} />);

    expect(screen.getByText('10')).toBeInTheDocument(); // total
    expect(screen.getByText('8')).toBeInTheDocument(); // completed
  });

  it('should render all tab triggers', () => {
    render(<ExecutionStatsTabs stats={stats} />);

    expect(screen.getByRole('tab', { name: '24 Hours' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '30 Days' })).toBeInTheDocument();
  });

  it('should switch to 7d tab', async () => {
    const user = userEvent.setup();
    render(<ExecutionStatsTabs stats={stats} />);

    await user.click(screen.getByRole('tab', { name: '7 Days' }));

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
