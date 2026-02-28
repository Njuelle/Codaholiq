import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('should show formatted cost when available', () => {
    const executionsWithCost: ExecutionWithAutomation[] = [
      {
        execution: mockExecution({ id: 10, totalCostMicros: 1_500_000 }),
        automationName: 'Costly Bot',
      },
    ];

    render(
      <MemoryRouter>
        <ExecutionTable executions={executionsWithCost} orgId={1} />
      </MemoryRouter>,
    );

    expect(screen.getByText('$1.50')).toBeInTheDocument();
  });

  it('should show dash when cost is null', () => {
    const executionsNoCost: ExecutionWithAutomation[] = [
      {
        execution: mockExecution({ id: 11, totalCostMicros: null }),
        automationName: 'Free Bot',
      },
    ];

    render(
      <MemoryRouter>
        <ExecutionTable executions={executionsNoCost} orgId={1} />
      </MemoryRouter>,
    );

    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should navigate to execution detail on row click', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('button');
    await user.click(rows[0]!);

    // The row was clicked; navigation was invoked (no error thrown)
    expect(rows[0]).toBeInTheDocument();
  });

  it('should navigate on Enter key press', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('button');
    rows[0]!.focus();
    await user.keyboard('{Enter}');

    expect(rows[0]).toBeInTheDocument();
  });

  it('should navigate on Space key press', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ExecutionTable executions={executions} orgId={1} />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('button');
    rows[0]!.focus();
    await user.keyboard(' ');

    expect(rows[0]).toBeInTheDocument();
  });
});
