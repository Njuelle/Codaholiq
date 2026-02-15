import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import type { TriggerType } from '@/common/types';
import type { ReactElement } from 'react';

interface AutomationFiltersProps {
  readonly triggerType?: TriggerType;
  readonly enabled?: boolean;
  readonly onTriggerTypeChange: (triggerType: TriggerType | undefined) => void;
  readonly onEnabledChange: (enabled: boolean | undefined) => void;
}

export function AutomationFilters({
  triggerType,
  enabled,
  onTriggerTypeChange,
  onEnabledChange,
}: AutomationFiltersProps): ReactElement {
  const handleTriggerTypeChange = (value: string): void => {
    onTriggerTypeChange(value === 'all' ? undefined : (value as TriggerType));
  };

  const handleEnabledChange = (value: string): void => {
    if (value === 'all') {
      onEnabledChange(undefined);
    } else {
      onEnabledChange(value === 'enabled');
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Select value={triggerType ?? 'all'} onValueChange={handleTriggerTypeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Trigger Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Triggers</SelectItem>
          <SelectItem value="event">Event</SelectItem>
          <SelectItem value="cron">Cron</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={enabled === undefined ? 'all' : enabled ? 'enabled' : 'disabled'}
        onValueChange={handleEnabledChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="enabled">Enabled</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
