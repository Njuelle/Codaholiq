import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeSelector } from '../date-range-selector';
import type { DateRange, DateRangePreset } from '../../types';

const defaultDateRange: DateRange = {
  from: new Date('2026-02-01'),
  to: new Date('2026-03-01'),
};

describe('DateRangeSelector', () => {
  it('should render preset buttons', () => {
    render(
      <DateRangeSelector
        dateRange={defaultDateRange}
        preset="30d"
        onPresetChange={vi.fn()}
        onDateRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Custom/ })).toBeInTheDocument();
  });

  it('should call onPresetChange when a preset button is clicked', async () => {
    const user = userEvent.setup();
    const onPresetChange = vi.fn();

    render(
      <DateRangeSelector
        dateRange={defaultDateRange}
        preset="30d"
        onPresetChange={onPresetChange}
        onDateRangeChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '7d' }));
    expect(onPresetChange).toHaveBeenCalledWith('7d');
  });

  it('should highlight the active preset', () => {
    const { rerender } = render(
      <DateRangeSelector
        dateRange={defaultDateRange}
        preset="7d"
        onPresetChange={vi.fn()}
        onDateRangeChange={vi.fn()}
      />,
    );

    const button7d = screen.getByRole('button', { name: '7d' });
    const button30d = screen.getByRole('button', { name: '30d' });
    // The active button should NOT have the outline variant class
    expect(button7d.className).not.toContain('border-input');
    // The inactive button should have the outline variant
    expect(button30d.className).toContain('border-input');

    rerender(
      <DateRangeSelector
        dateRange={defaultDateRange}
        preset="30d"
        onPresetChange={vi.fn()}
        onDateRangeChange={vi.fn()}
      />,
    );

    const updatedButton7d = screen.getByRole('button', { name: '7d' });
    const updatedButton30d = screen.getByRole('button', { name: '30d' });
    expect(updatedButton7d.className).toContain('border-input');
    expect(updatedButton30d.className).not.toContain('border-input');
  });

  it('should show date range text when custom is selected', () => {
    render(
      <DateRangeSelector
        dateRange={defaultDateRange}
        preset={'custom' as DateRangePreset}
        onPresetChange={vi.fn()}
        onDateRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Feb 1 - Mar 1, 2026/ })).toBeInTheDocument();
  });
});
