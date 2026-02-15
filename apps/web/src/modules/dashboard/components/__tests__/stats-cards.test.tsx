import { render, screen } from '@testing-library/react';
import { mockDashboardStats } from '@/test/factories';
import { StatsCards } from '../stats-cards';

describe('StatsCards', () => {
  it('should render all four stat cards', () => {
    const stats = mockDashboardStats();
    render(<StatsCards stats={stats} />);

    expect(screen.getByText('Active Automations')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
    expect(screen.getByText('Executions (24h)')).toBeInTheDocument();
    expect(screen.getByText('Success Rate (24h)')).toBeInTheDocument();
  });

  it('should display correct counts', () => {
    const stats = mockDashboardStats();
    render(<StatsCards stats={stats} />);

    expect(screen.getByText('5')).toBeInTheDocument(); // active automations
    expect(screen.getByText('3')).toBeInTheDocument(); // repositories
    expect(screen.getByText('10')).toBeInTheDocument(); // 24h total
  });

  it('should calculate success rate', () => {
    const stats = mockDashboardStats();
    render(<StatsCards stats={stats} />);

    // 8/10 = 80%
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('should show 0% when no executions', () => {
    const stats = mockDashboardStats({
      executionStats: {
        last24h: { total: 0, completed: 0, failed: 0, running: 0 },
        last7d: { total: 0, completed: 0, failed: 0, running: 0 },
        last30d: { total: 0, completed: 0, failed: 0, running: 0 },
      },
    });
    render(<StatsCards stats={stats} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
