import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { RepoFilters } from '../repo-filters';

const defaultProps = {
  search: '',
  showArchived: false,
  onSearchChange: vi.fn(),
  onShowArchivedChange: vi.fn(),
};

describe('RepoFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input and archived checkbox', () => {
    renderWithProviders(<RepoFilters {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();
    expect(screen.getByText('Show archived')).toBeInTheDocument();
  });

  it('should call onSearchChange when typing in search', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    renderWithProviders(<RepoFilters {...defaultProps} onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Search repositories...');
    await user.type(input, 'a');

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('should call onShowArchivedChange when toggling', async () => {
    const user = userEvent.setup();
    const onShowArchivedChange = vi.fn();

    renderWithProviders(
      <RepoFilters {...defaultProps} onShowArchivedChange={onShowArchivedChange} />,
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(onShowArchivedChange).toHaveBeenCalledWith(true);
  });
});
