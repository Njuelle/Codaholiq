import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { mockExecution } from '@/test/factories';
import { ExecutionInfoCard } from '../execution-info-card';

describe('ExecutionInfoCard', () => {
  it('should render execution details', () => {
    const execution = mockExecution({ id: 1, status: 'completed' });

    renderWithProviders(
      <ExecutionInfoCard execution={execution} automationName="PR Review Bot" orgId={1} />,
    );

    expect(screen.getByText('Execution Info')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
  });

  it('should show GitHub link when githubRunUrl exists', () => {
    const execution = mockExecution({
      githubRunUrl: 'https://github.com/org/repo/actions/runs/123',
    });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('View on GitHub')).toBeInTheDocument();
  });

  it('should not show GitHub link when no URL', () => {
    const execution = mockExecution({ githubRunUrl: null });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.queryByText('View on GitHub')).not.toBeInTheDocument();
  });

  it('should show error message when present', () => {
    const execution = mockExecution({
      status: 'failed',
      errorMessage: 'Workflow timed out',
    });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('Workflow timed out')).toBeInTheDocument();
  });

  it('should link automation name to detail page', () => {
    const execution = mockExecution({ automationId: 5 });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    const link = screen.getByRole('link', { name: 'Bot' });
    expect(link).toHaveAttribute('href', '/orgs/1/automations/5');
  });

  it('should show cost when totalCostMicros is present', () => {
    const execution = mockExecution({ totalCostMicros: 2_500_000 });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('$2.50')).toBeInTheDocument();
  });

  it('should show token breakdown when tokens are present', () => {
    const execution = mockExecution({
      totalCostMicros: 1_000_000,
      inputTokens: 150_000,
      outputTokens: 25_000,
    });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText(/150\.0K in/)).toBeInTheDocument();
    expect(screen.getByText(/25\.0K/)).toBeInTheDocument();
  });

  it('should not show cost section when totalCostMicros is null', () => {
    const execution = mockExecution({ totalCostMicros: null });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.queryByText('Cost')).not.toBeInTheDocument();
  });

  it('should show only input tokens when outputTokens is null', () => {
    const execution = mockExecution({
      totalCostMicros: 500_000,
      inputTokens: 80_000,
      outputTokens: null,
    });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText(/80\.0K in/)).toBeInTheDocument();
    expect(screen.queryByText(/out/)).not.toBeInTheDocument();
  });

  it('should show only output tokens when inputTokens is null', () => {
    const execution = mockExecution({
      totalCostMicros: 500_000,
      inputTokens: null,
      outputTokens: 12_000,
    });

    renderWithProviders(<ExecutionInfoCard execution={execution} automationName="Bot" orgId={1} />);

    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText(/12\.0K out/)).toBeInTheDocument();
    expect(screen.queryByText(/in/)).not.toBeInTheDocument();
  });
});
