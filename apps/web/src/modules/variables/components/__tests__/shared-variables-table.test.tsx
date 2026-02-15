import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockSharedVariable, mockRepo } from '@/test/factories';
import { SharedVariablesTable } from '../shared-variables-table';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('SharedVariablesTable', () => {
  const orgVar = mockSharedVariable({
    id: 1,
    key: 'API_URL',
    value: 'https://api.example.com',
    description: 'API base URL',
    repoId: null,
  });

  const repoVar = mockSharedVariable({
    id: 2,
    key: 'DEPLOY_ENV',
    value: 'staging',
    description: null,
    repoId: 10,
  });

  const repos = [
    mockRepo({ id: 10, fullName: 'acme/web-app' }),
    mockRepo({ id: 20, fullName: 'acme/api' }),
  ];

  const defaultProps = {
    variables: [orgVar, repoVar],
    repos,
    isLoading: false,
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render table with variable rows', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByText('API_URL')).toBeInTheDocument();
    expect(screen.getByText('DEPLOY_ENV')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('should show Organization badge for org-wide variables', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByText('Organization')).toBeInTheDocument();
  });

  it('should show repo name for repo-scoped variables', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByText('acme/web-app')).toBeInTheDocument();
  });

  it('should show variable description', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByText('API base URL')).toBeInTheDocument();
  });

  it('should show dash for null description', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    const rows = screen.getAllByRole('row');
    const repoRow = rows.find((row) => within(row).queryByText('DEPLOY_ENV'));
    expect(repoRow).toBeDefined();
    expect(within(repoRow!).getByText('-')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} isLoading={true} />);

    expect(screen.getByText('Loading variables...')).toBeInTheDocument();
    expect(screen.queryByText('API_URL')).not.toBeInTheDocument();
  });

  it('should show empty state when no variables', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} variables={[]} />);

    expect(
      screen.getByText('No shared variables yet. Add one to get started.'),
    ).toBeInTheDocument();
  });

  it('should render Add Variable button', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByRole('button', { name: /add variable/i })).toBeInTheDocument();
  });

  it('should render edit and delete buttons for each variable', () => {
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Edit API_URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete API_URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DEPLOY_ENV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete DEPLOY_ENV' })).toBeInTheDocument();
  });

  it('should open delete confirmation dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Delete API_URL' }));

    expect(screen.getByText('Delete variable?')).toBeInTheDocument();
    expect(screen.getAllByText(/API_URL/).length).toBeGreaterThanOrEqual(1);
  });

  it('should call onDelete when confirming deletion', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Delete API_URL' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(defaultProps.onDelete).toHaveBeenCalledWith(1);
  });

  it('should not call onDelete when cancelling deletion', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SharedVariablesTable {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Delete API_URL' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onDelete).not.toHaveBeenCalled();
  });

  it('should truncate long values', () => {
    const longVar = mockSharedVariable({
      id: 3,
      key: 'LONG_VAL',
      value: 'a'.repeat(100),
    });

    renderWithProviders(<SharedVariablesTable {...defaultProps} variables={[longVar]} />);

    expect(screen.getByText('a'.repeat(50) + '...')).toBeInTheDocument();
  });

  it('should show fallback repo name when repo is not found', () => {
    const unknownRepoVar = mockSharedVariable({
      id: 4,
      key: 'UNKNOWN_REPO',
      repoId: 999,
    });

    renderWithProviders(<SharedVariablesTable {...defaultProps} variables={[unknownRepoVar]} />);

    expect(screen.getByText('Repo #999')).toBeInTheDocument();
  });
});
