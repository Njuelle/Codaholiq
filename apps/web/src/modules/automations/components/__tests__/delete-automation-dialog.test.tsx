import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAutomationDialog } from '../delete-automation-dialog';

describe('DeleteAutomationDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    automationName: 'My Automation',
    onConfirm: vi.fn(),
    isLoading: false,
  };

  it('should render dialog when open is true', () => {
    render(<DeleteAutomationDialog {...defaultProps} />);

    expect(screen.getByText('Delete Automation')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should not render dialog when open is false', () => {
    render(<DeleteAutomationDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Delete Automation')).not.toBeInTheDocument();
  });

  it('should display the automation name in the description and label', () => {
    render(<DeleteAutomationDialog {...defaultProps} />);

    // The name appears in both the description and the confirmation label
    const nameElements = screen.getAllByText('My Automation');
    expect(nameElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should have confirm button disabled until name is typed correctly', () => {
    render(<DeleteAutomationDialog {...defaultProps} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
  });

  it('should keep confirm button disabled when partial name is typed', async () => {
    const user = userEvent.setup();
    render(<DeleteAutomationDialog {...defaultProps} />);

    const input = screen.getByLabelText(/Type .* to confirm/);
    await user.type(input, 'My Auto');

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
  });

  it('should enable confirm button when name matches exactly', async () => {
    const user = userEvent.setup();
    render(<DeleteAutomationDialog {...defaultProps} />);

    const input = screen.getByLabelText(/Type .* to confirm/);
    await user.type(input, 'My Automation');

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeEnabled();
  });

  it('should call onConfirm when name matches and button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteAutomationDialog {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByLabelText(/Type .* to confirm/);
    await user.type(input, 'My Automation');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should not call onConfirm when name does not match and button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteAutomationDialog {...defaultProps} onConfirm={onConfirm} />);

    const input = screen.getByLabelText(/Type .* to confirm/);
    await user.type(input, 'Wrong Name');

    // Button should be disabled, so click should not trigger onConfirm
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should show loading state when isLoading is true', () => {
    render(<DeleteAutomationDialog {...defaultProps} isLoading />);

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });

  it('should disable input when isLoading is true', () => {
    render(<DeleteAutomationDialog {...defaultProps} isLoading />);

    const input = screen.getByLabelText(/Type .* to confirm/);
    expect(input).toBeDisabled();
  });
});
