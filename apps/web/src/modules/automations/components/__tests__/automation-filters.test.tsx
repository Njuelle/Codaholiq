import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { AutomationFilters } from '../automation-filters';

// Polyfill missing DOM APIs for jsdom (required by Radix Select)
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AutomationFilters', () => {
  const defaultProps = {
    triggerType: undefined,
    enabled: undefined,
    onTriggerTypeChange: vi.fn(),
    onEnabledChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render trigger type and status select controls', () => {
    renderWithProviders(<AutomationFilters {...defaultProps} />);

    expect(screen.getByText('All Triggers')).toBeInTheDocument();
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('should display the selected trigger type', () => {
    renderWithProviders(<AutomationFilters {...defaultProps} triggerType="event" />);

    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('should display the selected enabled status', () => {
    renderWithProviders(<AutomationFilters {...defaultProps} enabled={true} />);

    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('should display "Disabled" when enabled is false', () => {
    renderWithProviders(<AutomationFilters {...defaultProps} enabled={false} />);

    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('should call onTriggerTypeChange with "event" when Event is selected', async () => {
    const user = userEvent.setup();
    const onTriggerTypeChange = vi.fn();

    renderWithProviders(
      <AutomationFilters {...defaultProps} onTriggerTypeChange={onTriggerTypeChange} />,
    );

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]!);
    await user.click(screen.getByRole('option', { name: 'Event' }));

    expect(onTriggerTypeChange).toHaveBeenCalledWith('event');
  });

  it('should call onTriggerTypeChange with "cron" when Cron is selected', async () => {
    const user = userEvent.setup();
    const onTriggerTypeChange = vi.fn();

    renderWithProviders(
      <AutomationFilters {...defaultProps} onTriggerTypeChange={onTriggerTypeChange} />,
    );

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]!);
    await user.click(screen.getByRole('option', { name: 'Cron' }));

    expect(onTriggerTypeChange).toHaveBeenCalledWith('cron');
  });

  it('should call onTriggerTypeChange with "manual" when Manual is selected', async () => {
    const user = userEvent.setup();
    const onTriggerTypeChange = vi.fn();

    renderWithProviders(
      <AutomationFilters {...defaultProps} onTriggerTypeChange={onTriggerTypeChange} />,
    );

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]!);
    await user.click(screen.getByRole('option', { name: 'Manual' }));

    expect(onTriggerTypeChange).toHaveBeenCalledWith('manual');
  });

  it('should call onTriggerTypeChange with undefined when "All Triggers" is selected', async () => {
    const user = userEvent.setup();
    const onTriggerTypeChange = vi.fn();

    renderWithProviders(
      <AutomationFilters
        {...defaultProps}
        triggerType="event"
        onTriggerTypeChange={onTriggerTypeChange}
      />,
    );

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]!);
    await user.click(screen.getByRole('option', { name: 'All Triggers' }));

    expect(onTriggerTypeChange).toHaveBeenCalledWith(undefined);
  });

  it('should call onEnabledChange with true when Enabled is selected', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();

    renderWithProviders(<AutomationFilters {...defaultProps} onEnabledChange={onEnabledChange} />);

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]!);
    await user.click(screen.getByRole('option', { name: 'Enabled' }));

    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('should call onEnabledChange with false when Disabled is selected', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();

    renderWithProviders(<AutomationFilters {...defaultProps} onEnabledChange={onEnabledChange} />);

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]!);
    await user.click(screen.getByRole('option', { name: 'Disabled' }));

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it('should call onEnabledChange with undefined when "All Statuses" is selected', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();

    renderWithProviders(
      <AutomationFilters {...defaultProps} enabled={true} onEnabledChange={onEnabledChange} />,
    );

    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[1]!);
    await user.click(screen.getByRole('option', { name: 'All Statuses' }));

    expect(onEnabledChange).toHaveBeenCalledWith(undefined);
  });
});
