import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockExecution } from '@/test/factories';
import { ExecutionTable } from '../execution-table';
import type { ExecutionWithAutomation } from '@/common/types';

const executions: ExecutionWithAutomation[] = [
  {
    execution: mockExecution({ id: 1, status: 'completed' }),
    automationName: 'PR Review Bot',
  },
  {
    execution: mockExecution({
      id: 2,
      status: 'failed',
      errorMessage: 'Timeout',
      startedAt: null,
      completedAt: null,
    }),
    automationName: 'Nightly Build',
  },
];

describe('ExecutionTable', () => {
  it('should render execution rows', () => {
    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText('Nightly Build')).toBeInTheDocument();
  });

  it('should render status badges', () => {
    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should show dash for executions without duration', () => {
    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    // The failed execution has null startedAt/completedAt so shows '-'
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should render column headers', () => {
    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });
});
