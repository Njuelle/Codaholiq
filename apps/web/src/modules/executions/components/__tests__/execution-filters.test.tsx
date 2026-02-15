import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomation } from '@/test/factories';
import { ExecutionFilters } from '../execution-filters';

// Polyfill missing DOM APIs for jsdom (required by Radix Select)
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const automations = [
  mockAutomation({ id: 1, name: 'PR Review Bot' }),
  mockAutomation({ id: 2, name: 'Nightly Build' }),
];

const defaultProps: {
  status: undefined;
  automationId: undefined;
  automations: typeof automations;
  onStatusChange: ReturnType<typeof vi.fn>;
  onAutomationIdChange: ReturnType<typeof vi.fn>;
} = {
  status: undefined,
  automationId: undefined,
  automations,
  onStatusChange: vi.fn(),
  onAutomationIdChange: vi.fn(),
};

describe('ExecutionFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render status and automation dropdowns', () => {
    renderWithProviders(<ExecutionFilters {...defaultProps} />);

    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('All Automations')).toBeInTheDocument();
  });

  it('should display selected status', () => {
    renderWithProviders(<ExecutionFilters {...defaultProps} status="failed" />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should call onStatusChange when status is selected', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    renderWithProviders(<ExecutionFilters {...defaultProps} onStatusChange={onStatusChange} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]!);
    await user.click(screen.getByRole('option', { name: 'Running' }));

    expect(onStatusChange).toHaveBeenCalledWith('running');
  });

  it('should call onAutomationIdChange when automation is selected', async () => {
    const user = userEvent.setup();
    const onAutomationIdChange = vi.fn();

    renderWithProviders(
      <ExecutionFilters {...defaultProps} onAutomationIdChange={onAutomationIdChange} />,
    );

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]!);
    await user.click(screen.getByRole('option', { name: 'PR Review Bot' }));

    expect(onAutomationIdChange).toHaveBeenCalledWith(1);
  });

  it('should call onStatusChange with undefined for "All Statuses"', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();

    renderWithProviders(
      <ExecutionFilters {...defaultProps} status="failed" onStatusChange={onStatusChange} />,
    );

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]!);
    await user.click(screen.getByRole('option', { name: 'All Statuses' }));

    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });
});
