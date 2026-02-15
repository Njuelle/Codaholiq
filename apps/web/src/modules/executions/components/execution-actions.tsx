import { Button } from '@/common/components/ui/button';
import { isValidGitHubUrl } from '@/modules/executions/lib/execution-utils';
import type { Execution } from '@/common/types';
import { ExternalLink, RotateCcw, Square } from 'lucide-react';
import type { ReactElement } from 'react';

interface ExecutionActionsProps {
  readonly execution: Execution;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
  readonly isCancelling: boolean;
  readonly isRetrying: boolean;
  readonly canCancelRetry?: boolean;
}

const CANCELLABLE_STATUSES = new Set(['pending', 'dispatching', 'running']);
const RETRIABLE_STATUSES = new Set(['failed', 'cancelled', 'timed_out']);

export function ExecutionActions({
  execution,
  onCancel,
  onRetry,
  isCancelling,
  isRetrying,
  canCancelRetry = true,
}: ExecutionActionsProps): ReactElement {
  const canCancel = canCancelRetry && CANCELLABLE_STATUSES.has(execution.status);
  const canRetry = canCancelRetry && RETRIABLE_STATUSES.has(execution.status);

  return (
    <div className="flex items-center gap-2">
      {canCancel && (
        <Button variant="destructive" size="sm" onClick={onCancel} disabled={isCancelling}>
          <Square className="size-4" />
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </Button>
      )}

      {canRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RotateCcw className="size-4" />
          {isRetrying ? 'Retrying...' : 'Retry'}
        </Button>
      )}

      {execution.githubRunUrl && isValidGitHubUrl(execution.githubRunUrl) && (
        <Button variant="outline" size="sm" asChild>
          <a href={execution.githubRunUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            View on GitHub
          </a>
        </Button>
      )}
    </div>
  );
}
