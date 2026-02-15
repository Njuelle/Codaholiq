import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrgMember } from '@/test/factories';
import { MembersTable } from '../members-table';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MembersTable', () => {
  const ownerMember = mockOrgMember({
    userId: 1,
    username: 'owner-user',
    role: 'owner',
    joinedAt: '2025-01-01T00:00:00.000Z',
  });
  const adminMember = mockOrgMember({
    userId: 2,
    username: 'admin-user',
    role: 'admin',
    joinedAt: '2025-02-15T00:00:00.000Z',
  });
  const regularMember = mockOrgMember({
    userId: 3,
    username: 'member-user',
    role: 'member',
    joinedAt: '2025-03-20T00:00:00.000Z',
  });

  const members = [ownerMember, adminMember, regularMember];

  const defaultProps = {
    members,
    currentUserId: 2,
    onRoleChange: vi.fn(),
    onRemove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render member rows', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    expect(screen.getByText('owner-user')).toBeInTheDocument();
    expect(screen.getByText('admin-user')).toBeInTheDocument();
    expect(screen.getByText('member-user')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
  });

  it('should show Owner badge for owner role', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    const ownerBadge = screen.getByText('Owner');
    expect(ownerBadge).toBeInTheDocument();
    expect(ownerBadge.closest('[data-slot="badge"]')).toBeInTheDocument();
  });

  it('should disable remove button for current user', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    const removeButton = screen.getByRole('button', {
      name: 'Remove admin-user',
    });
    expect(removeButton).toBeDisabled();
  });

  it('should disable remove button for owner', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    const removeButton = screen.getByRole('button', {
      name: 'Remove owner-user',
    });
    expect(removeButton).toBeDisabled();
  });

  it('should enable remove button for other non-owner members', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    const removeButton = screen.getByRole('button', {
      name: 'Remove member-user',
    });
    expect(removeButton).not.toBeDisabled();
  });

  it('should show role selector for non-owner members', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    expect(screen.getByRole('combobox', { name: 'Role for admin-user' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for member-user' })).toBeInTheDocument();
  });

  it('should not show role selector for owner', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    expect(screen.queryByRole('combobox', { name: 'Role for owner-user' })).not.toBeInTheDocument();
  });

  it('should show confirmation dialog when remove button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<MembersTable {...defaultProps} />);

    const removeButton = screen.getByRole('button', {
      name: 'Remove member-user',
    });
    await user.click(removeButton);

    expect(screen.getByText('Remove member?')).toBeInTheDocument();
    expect(
      screen.getByText('This will remove member-user from the organization.'),
    ).toBeInTheDocument();
  });

  it('should call onRemove when confirmation dialog is confirmed', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    renderWithProviders(<MembersTable {...defaultProps} onRemove={onRemove} />);

    const removeButton = screen.getByRole('button', {
      name: 'Remove member-user',
    });
    await user.click(removeButton);

    const confirmButton = screen.getByRole('button', { name: 'Remove' });
    await user.click(confirmButton);

    expect(onRemove).toHaveBeenCalledWith(3);
  });

  it('should render correct number of rows', () => {
    renderWithProviders(<MembersTable {...defaultProps} />);

    const rows = screen.getAllByRole('row');
    // Header row + 3 data rows
    expect(rows).toHaveLength(4);
  });
});
