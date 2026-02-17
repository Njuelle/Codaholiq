import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { RepoSelectDialog } from '../repo-select-dialog';

// Polyfills for Radix Select in jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderDialog(
  overrides: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (repoId: number) => void;
    isLoading: boolean;
  }> = {},
): ReturnType<typeof renderWithProviders> {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    orgId: 1,
    templateName: 'PR Code Review',
    onConfirm: vi.fn(),
    isLoading: false,
  };

  return renderWithProviders(
    <RepoSelectDialog {...defaults} {...overrides} />,
    { user: testUser, org: testOrg },
  );
}

describe('RepoSelectDialog', () => {
  it('should render dialog title and template name', async () => {
    renderDialog();

    expect(await screen.findByText('Select a Repository')).toBeInTheDocument();
    expect(screen.getByText(/PR Code Review/)).toBeInTheDocument();
  });

  it('should have Create button disabled initially', async () => {
    renderDialog();

    const createButton = await screen.findByRole('button', { name: 'Create Automation' });
    expect(createButton).toBeDisabled();
  });

  it('should enable Create button after selecting a repo', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Open the select dropdown
    const trigger = await screen.findByRole('combobox');
    await user.click(trigger);

    // Select a repo
    const option = await screen.findByText('test-org/repo-1');
    await user.click(option);

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: 'Create Automation' });
      expect(createButton).not.toBeDisabled();
    });
  });

  it('should call onConfirm with selected repoId', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    const trigger = await screen.findByRole('combobox');
    await user.click(trigger);

    const option = await screen.findByText('test-org/repo-1');
    await user.click(option);

    const createButton = screen.getByRole('button', { name: 'Create Automation' });
    await user.click(createButton);

    expect(onConfirm).toHaveBeenCalledWith(expect.any(Number));
  });

  it('should call onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show loading state', async () => {
    renderDialog({ isLoading: true });

    expect(await screen.findByRole('button', { name: 'Creating...' })).toBeInTheDocument();
  });
});
