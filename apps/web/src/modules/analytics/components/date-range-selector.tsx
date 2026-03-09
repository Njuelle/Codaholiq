import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/common/components/ui/button';
import { Calendar } from '@/common/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/common/components/ui/popover';
import { cn } from '@/common/lib/utils';
import type { DateRange, DateRangePreset } from '../types';
import type { ReactElement } from 'react';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';

interface DateRangeSelectorProps {
  readonly dateRange: DateRange;
  readonly preset: DateRangePreset;
  readonly onPresetChange: (preset: DateRangePreset) => void;
  readonly onDateRangeChange: (range: DateRange) => void;
}

const PRESETS: { label: string; value: DateRangePreset }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
];

export function DateRangeSelector({
  dateRange,
  preset,
  onPresetChange,
  onDateRangeChange,
}: DateRangeSelectorProps): ReactElement {
  const [calendarOpen, setCalendarOpen] = useState(false);

  function handleCalendarSelect(range: DayPickerDateRange | undefined): void {
    if (range?.from && range.to) {
      onDateRangeChange({ from: range.from, to: range.to });
      setCalendarOpen(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {PRESETS.map(({ label, value }) => (
        <Button
          key={value}
          variant={preset === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPresetChange(value)}
        >
          {label}
        </Button>
      ))}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={preset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className={cn('gap-1.5', preset === 'custom' && 'min-w-[200px]')}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === 'custom'
              ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
              : 'Custom'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
