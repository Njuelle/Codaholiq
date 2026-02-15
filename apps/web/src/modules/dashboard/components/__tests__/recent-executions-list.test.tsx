import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { RecentExecutionsList } from '../recent-executions-list';
import type { ExecutionSummary } from '@/common/types';

const executions: ExecutionSummary[] = [
  {
    execution: { id: 1, status: 'completed', createdAt: new Date().toISOString() },
    automationName: 'PR Review Bot',
  },
  {
    execution: { id: 2, status: 'failed', createdAt: new Date().toISOString() },
    automationName: 'Nightly Build',
  },
];

describe('RecentExecutionsList', () => {
  it('should render execution entries', () => {
    renderWithProviders(<RecentExecutionsList executions={executions} orgId={1} />);

    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText('Nightly Build')).toBeInTheDocument();
  });

  it('should render status badges', () => {
    renderWithProviders(<RecentExecutionsList executions={executions} orgId={1} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    renderWithProviders(<RecentExecutionsList executions={[]} orgId={1} />);

    expect(screen.getByText('No recent executions.')).toBeInTheDocument();
  });

  it('should render "View all" link', () => {
    renderWithProviders(<RecentExecutionsList executions={executions} orgId={1} />);

    const link = screen.getByRole('link', { name: /view all/i });
    expect(link).toHaveAttribute('href', '/orgs/1/executions');
  });
});
