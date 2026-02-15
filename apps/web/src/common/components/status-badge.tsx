import { Badge } from '@/common/components/ui/badge';
import { cn } from '@/common/lib/utils';
import type { ExecutionStatus } from '@/modules/executions/types';
import type { ReactElement } from 'react';

const STATUS_STYLES: Record<ExecutionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  dispatching: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  timed_out: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  pending: 'Pending',
  dispatching: 'Dispatching',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  timed_out: 'Timed out',
};

interface StatusBadgeProps {
  readonly status: ExecutionStatus;
  readonly className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps): ReactElement {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
