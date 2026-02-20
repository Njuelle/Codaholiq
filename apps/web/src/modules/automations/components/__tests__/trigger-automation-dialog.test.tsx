import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { TriggerAutomationDialog } from '../trigger-automation-dialog';

describe('TriggerAutomationDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    automationName: 'PR Review Bot',
    automationOrgId: 1,
    onTrigger: vi.fn(),
    isPending: false,
    result: undefined,
  };

  it('should render dialog title and description', () => {
    renderWithProviders(<TriggerAutomationDialog {...defaultProps} />);

    expect(screen.getByText('Trigger PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText(/Manually trigger this automation/)).toBeInTheDocument();
  });

  it('should call onTrigger when trigger button is clicked', async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} onTrigger={onTrigger} />);

    await user.click(screen.getByRole('button', { name: 'Trigger' }));

    expect(onTrigger).toHaveBeenCalledOnce();
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

  it('should not show trigger button when result is provided', () => {
    const result = { executionId: 42, status: 'pending' };

    renderWithProviders(<TriggerAutomationDialog {...defaultProps} result={result} />);

    expect(screen.queryByRole('button', { name: 'Trigger' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});
