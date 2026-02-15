import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolderOpen } from 'lucide-react';
import { EmptyState } from '../empty-state';

describe('EmptyState', () => {
  it('should render title and description', () => {
    render(
      <EmptyState
        icon={FolderOpen}
        title="No items"
        description="Create your first item to get started."
      />,
    );

    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Create your first item to get started.')).toBeInTheDocument();
  });

  it('should render action button when provided', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <EmptyState
        icon={FolderOpen}
        title="No items"
        description="Create one."
        action={{ label: 'Create', onClick }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should not render action button when not provided', () => {
    render(<EmptyState icon={FolderOpen} title="No items" description="Nothing here." />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
