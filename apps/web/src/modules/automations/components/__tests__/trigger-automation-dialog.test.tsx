import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomationWithVariables, mockAutomationVariable } from '@/test/factories';
import { TriggerAutomationDialog } from '../trigger-automation-dialog';

describe('TriggerAutomationDialog', () => {
  const defaultAutomation = mockAutomationWithVariables({
    id: 1,
    orgId: 1,
    name: 'PR Review Bot',
    variables: [
      mockAutomationVariable({
        key: 'branch',
        value: 'main',
        source: 'static',
        required: true,
      }),
      mockAutomationVariable({
        key: 'API_KEY',
        value: 'secret-key',
        source: 'static',
        required: false,
      }),
    ],
  });

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    automation: defaultAutomation,
    onTrigger: vi.fn(),
    isPending: false,
    result: undefined,
  };

  it('should render variable inputs from automation', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} />);

    expect(screen.getByText('Trigger PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText(/Manually trigger this automation/)).toBeInTheDocument();
    expect(screen.getByLabelText(/branch/)).toBeInTheDocument();
    expect(screen.getByLabelText(/API_KEY/)).toBeInTheDocument();
  });

  it('should pre-fill variable inputs with current values', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} />);

    const branchInput = screen.getByLabelText(/branch/);
    expect(branchInput).toHaveValue('main');
  });

  it('should show required indicator for required variables', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} />);

    // The "branch" variable is required and should have the * indicator
    const branchLabel = screen.getByText('branch');
    const requiredIndicator = branchLabel.parentElement?.querySelector('.text-destructive');
    expect(requiredIndicator).toBeInTheDocument();
    expect(requiredIndicator).toHaveTextContent('*');
  });

  it('should call onTrigger with variable overrides when trigger button is clicked', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} onTrigger={onTrigger} />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(onTrigger).toHaveBeenCalledOnce();
    expect(onTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: 'main',
        API_KEY: 'secret-key',
      }),
    );
  });

  it('should call onTrigger with undefined when automation has no variables', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    const noVarsAutomation = mockAutomationWithVariables({
      id: 1,
      orgId: 1,
      name: 'Simple Bot',
      variables: [],
    });

    renderWithProviders(
      <TriggerAutomationDialog
        {...defaultProps}
        automation={noVarsAutomation}
        onTrigger={onTrigger}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(onTrigger).toHaveBeenCalledOnce();
    expect(onTrigger).toHaveBeenCalledWith(undefined);
  });

  it('should allow editing variable values', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} onTrigger={onTrigger} />);

    const branchInput = screen.getByLabelText(/branch/);
    await user.clear(branchInput);
    await user.type(branchInput, 'develop');
    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(onTrigger).toHaveBeenCalledWith(expect.objectContaining({ branch: 'develop' }));
  });

  it('should show pending state when isPending is true', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} isPending />);

    expect(screen.getByRole('button', { name: 'Triggering...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Triggering...' })).toBeDisabled();
  });

  it('should show success state with execution link when result is provided', () => {
    const result = { executionId: 42, status: 'pending' };

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} result={result} />);

    expect(screen.getByText('Automation triggered successfully')).toBeInTheDocument();
    expect(screen.getByText(/Execution #42/)).toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();

    const viewLink = screen.getByRole('link', { name: 'View Execution' });
    expect(viewLink).toBeInTheDocument();
    expect(viewLink).toHaveAttribute('href', '/orgs/1/executions/42');
  });

  it('should not show variable inputs when result is provided', () => {
    const result = { executionId: 42, status: 'pending' };

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} result={result} />);

    expect(screen.queryByLabelText(/branch/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trigger' })).not.toBeInTheDocument();
  });

  it('should display source info for each variable', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} />);

    expect(screen.getAllByText('Source: static')).toHaveLength(2);
  });
});
