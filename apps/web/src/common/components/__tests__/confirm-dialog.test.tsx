import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../confirm-dialog';

describe('ConfirmDialog', () => {
  it('should render dialog content when open', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete item?"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Delete item?"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Are you sure?"
        confirmLabel="Yes, delete"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('should use custom labels', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Confirm"
        description="Sure?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Deleting"
        description="Please wait."
        onConfirm={vi.fn()}
        isLoading
      />,
    );

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
  });
});
