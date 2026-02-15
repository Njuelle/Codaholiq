import { cn } from '@/common/lib/utils';
import { formatDate, formatDuration, computeDurationMs } from '@/common/lib/format';
import type { Execution } from '@/common/types';
import { Check, Circle, Clock, Loader2, X, Ban, AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';

interface StatusTimelineProps {
  readonly execution: Execution;
}

interface TimelineStep {
  readonly label: string;
  readonly timestamp: string | null;
  readonly status: 'completed' | 'active' | 'pending';
  readonly icon: ReactElement;
}

const STATUS_ICONS: Record<string, ReactElement> = {
  completed: <Check className="size-4" />,
  failed: <X className="size-4" />,
  cancelled: <Ban className="size-4" />,
  timed_out: <AlertTriangle className="size-4" />,
};

function deriveSteps(execution: Execution): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const isTerminal = ['completed', 'failed', 'cancelled', 'timed_out'].includes(execution.status);

  // Created
  steps.push({
    label: 'Created',
    timestamp: execution.createdAt,
    status: 'completed',
    icon: <Check className="size-4" />,
  });

  // Running
  if (execution.startedAt) {
    steps.push({
      label: 'Running',
      timestamp: execution.startedAt,
      status: isTerminal ? 'completed' : 'active',
      icon: isTerminal ? <Check className="size-4" /> : <Loader2 className="size-4 animate-spin" />,
    });
  } else if (!isTerminal && execution.status !== 'pending') {
    steps.push({
      label: 'Dispatching',
      timestamp: null,
      status: 'active',
      icon: <Loader2 className="size-4 animate-spin" />,
    });
  }

  // Final state
  if (isTerminal) {
    const statusLabel: Record<string, string> = {
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
      timed_out: 'Timed out',
    };
    steps.push({
      label: statusLabel[execution.status] ?? execution.status,
      timestamp: execution.completedAt,
      status: 'completed',
      icon: STATUS_ICONS[execution.status] ?? <Circle className="size-4" />,
    });
  } else if (execution.status === 'pending') {
    steps.push({
      label: 'Waiting',
      timestamp: null,
      status: 'active',
      icon: <Clock className="size-4" />,
    });
  }

  return steps;
}

const STEP_COLORS: Record<TimelineStep['status'], string> = {
  completed: 'bg-green-500 text-white',
  active: 'bg-blue-500 text-white',
  pending: 'bg-gray-200 text-gray-500',
};

export function StatusTimeline({ execution }: StatusTimelineProps): ReactElement {
  const steps = deriveSteps(execution);

  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const durationMs =
          index > 0 && steps[index - 1]?.timestamp && step.timestamp
            ? computeDurationMs({
                startedAt: steps[index - 1]!.timestamp!,
                completedAt: step.timestamp,
              })
            : null;

        return (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  STEP_COLORS[step.status],
                )}
              >
                {step.icon}
              </div>
              {index < steps.length - 1 && <div className="h-8 w-px bg-border" />}
            </div>
            <div className="pb-8">
              <p className="text-sm font-medium">{step.label}</p>
              {step.timestamp && (
                <p className="text-xs text-muted-foreground">{formatDate(step.timestamp)}</p>
              )}
              {durationMs !== null && durationMs > 0 && (
                <p className="text-xs text-muted-foreground">{formatDuration(durationMs)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
