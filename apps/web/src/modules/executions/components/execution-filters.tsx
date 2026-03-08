import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import type { Automation, ExecutionStatus } from '@/common/types';
import type { ReactElement } from 'react';

const EXECUTION_STATUSES: readonly { value: ExecutionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'dispatching', label: 'Dispatching' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'timed_out', label: 'Timed out' },
  { value: 'cost_blocked', label: 'Cost blocked' },
];

interface ExecutionFiltersProps {
  readonly status: ExecutionStatus | undefined;
  readonly automationId: number | undefined;
  readonly automations: readonly Automation[];
  readonly onStatusChange: (status: ExecutionStatus | undefined) => void;
  readonly onAutomationIdChange: (id: number | undefined) => void;
}

export function ExecutionFilters({
  status,
  automationId,
  automations,
  onStatusChange,
  onAutomationIdChange,
}: ExecutionFiltersProps): ReactElement {
  const handleStatusChange = (value: string): void => {
    onStatusChange(value === 'all' ? undefined : (value as ExecutionStatus));
  };

  const handleAutomationChange = (value: string): void => {
    onAutomationIdChange(value === 'all' ? undefined : Number(value));
  };

  return (
    <div className="flex items-center gap-3">
      <Select value={status ?? 'all'} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {EXECUTION_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={automationId !== undefined ? String(automationId) : 'all'}
        onValueChange={handleAutomationChange}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Automation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Automations</SelectItem>
          {automations.map((a) => (
            <SelectItem key={a.id} value={String(a.id)}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
