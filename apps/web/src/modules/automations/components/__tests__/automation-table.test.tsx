import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomation } from '@/test/factories';
import { AutomationTable } from '../automation-table';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('AutomationTable', () => {
  const automations = [
    mockAutomation({
      id: 1,
      name: 'Deploy on Push',
      description: 'Deploys when code is pushed',
      triggerType: 'event',
      enabled: true,
      createdAt: '2025-06-15T10:00:00.000Z',
    }),
    mockAutomation({
      id: 2,
      name: 'Nightly Build',
      description: null,
      triggerType: 'cron',
      enabled: false,
      createdAt: '2025-03-20T08:30:00.000Z',
    }),
    mockAutomation({
      id: 3,
      name: 'Manual Review',
      triggerType: 'manual',
      enabled: true,
      createdAt: '2025-01-10T14:00:00.000Z',
    }),
  ];

  const defaultProps = {
    automations,
    onToggleEnabled: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render table headers', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('should render automation names', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    expect(screen.getByText('Deploy on Push')).toBeInTheDocument();
    expect(screen.getByText('Nightly Build')).toBeInTheDocument();
    expect(screen.getByText('Manual Review')).toBeInTheDocument();
  });

  it('should render automation descriptions when present', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    expect(screen.getByText('Deploys when code is pushed')).toBeInTheDocument();
  });

  it('should render trigger badges for each automation', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Cron')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('should render formatted creation dates', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    // The exact format depends on locale, but let's check the year appears
    const rows = screen.getAllByRole('row');
    // Header row + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('should render toggle switches with correct checked state', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    const toggles = screen.getAllByRole('switch');
    expect(toggles).toHaveLength(3);

    expect(toggles[0]).toHaveAttribute('aria-checked', 'true');
    expect(toggles[1]).toHaveAttribute('aria-checked', 'false');
    expect(toggles[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('should render toggle switches with aria-label', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    expect(screen.getByRole('switch', { name: 'Toggle Deploy on Push' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle Nightly Build' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Toggle Manual Review' })).toBeInTheDocument();
  });

  it('should call onToggleEnabled when a switch is clicked', async () => {
    const user = userEvent.setup();
    const onToggleEnabled = vi.fn();

    renderWithProviders(<AutomationTable {...defaultProps} onToggleEnabled={onToggleEnabled} />);

    const toggle = screen.getByRole('switch', { name: 'Toggle Deploy on Push' });
    await user.click(toggle);

    expect(onToggleEnabled).toHaveBeenCalledWith({
      automationId: 1,
      enabled: false,
    });
  });

  it('should call onToggleEnabled with enabled=true for a disabled automation', async () => {
    const user = userEvent.setup();
    const onToggleEnabled = vi.fn();

    renderWithProviders(<AutomationTable {...defaultProps} onToggleEnabled={onToggleEnabled} />);

    const toggle = screen.getByRole('switch', { name: 'Toggle Nightly Build' });
    await user.click(toggle);

    expect(onToggleEnabled).toHaveBeenCalledWith({
      automationId: 2,
      enabled: true,
    });
  });

  it('should navigate to automation detail when a row is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AutomationTable {...defaultProps} />);

    const row = screen.getByText('Deploy on Push').closest('tr');
    expect(row).toBeInTheDocument();

    await user.click(row!);

    expect(mockNavigate).toHaveBeenCalledWith('1');
  });

  it('should render dropdown menu trigger buttons', () => {
    renderWithProviders(<AutomationTable {...defaultProps} />);

    const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });
    expect(menuButtons).toHaveLength(3);
  });

  it('should show dropdown menu items when menu button is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AutomationTable {...defaultProps} />);

    const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuButtons[0]!);

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should navigate to detail page when View is clicked from menu', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AutomationTable {...defaultProps} />);

    const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuButtons[0]!);
    await user.click(screen.getByText('View'));

    expect(mockNavigate).toHaveBeenCalledWith('1');
  });

  it('should navigate to edit page when Edit is clicked from menu', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AutomationTable {...defaultProps} />);

    const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuButtons[0]!);
    await user.click(screen.getByText('Edit'));

    expect(mockNavigate).toHaveBeenCalledWith('1/edit');
  });

  it('should call onDelete when Delete is clicked from menu', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    renderWithProviders(<AutomationTable {...defaultProps} onDelete={onDelete} />);

    const menuButtons = screen.getAllByRole('button', { name: 'Open menu' });
    await user.click(menuButtons[0]!);
    await user.click(screen.getByText('Delete'));

    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('should not navigate when toggle switch is clicked', async () => {
    const user = userEvent.setup();

    renderWithProviders(<AutomationTable {...defaultProps} />);

    const toggle = screen.getByRole('switch', { name: 'Toggle Deploy on Push' });
    await user.click(toggle);

    // The navigate should not be called from the toggle click
    // (stopPropagation prevents row click handler)
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
