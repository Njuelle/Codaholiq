import { ExecutionActions } from '@/modules/executions/components/execution-actions';
import { ExecutionInfoCard } from '@/modules/executions/components/execution-info-card';
import { LogViewer } from '@/modules/executions/components/log-viewer';
import { PromptDisplayCard } from '@/modules/executions/components/prompt-display-card';
import { StatusTimeline } from '@/modules/executions/components/status-timeline';
import { PageHeader } from '@/common/components/page-header';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useCancelExecution } from '@/modules/executions/hooks/use-cancel-execution';
import { useExecution } from '@/modules/executions/hooks/use-execution';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useRetryExecution } from '@/modules/executions/hooks/use-retry-execution';
import { Permission } from '@/common/types';
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';

export function ExecutionDetailPage(): ReactElement {
  const { org } = useOrg();
  const { executionId: executionIdParam } = useParams<{
    executionId: string;
  }>();

  const orgId = org?.id ?? 0;
  const executionId = Number(executionIdParam);

  const { execution, automationName, isLoading, isError, error } = useExecution({
    orgId,
    executionId,
  });

  const cancelMutation = useCancelExecution({ orgId });
  const retryMutation = useRetryExecution({ orgId });
  const { hasPermission } = useHasPermission({ orgId });

  const handleCancel = (): void => {
    cancelMutation.mutate(executionId);
  };

  const handleRetry = (): void => {
    retryMutation.mutate(executionId);
  };

  if (Number.isNaN(executionId)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Execution" />
        <p className="text-destructive text-sm">Invalid execution ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !execution) {
    return (
      <div className="space-y-6">
        <PageHeader title="Execution" />
        <p className="text-destructive text-sm">{error?.message ?? 'Execution not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Execution #${execution.id}`}
        description={automationName ?? undefined}
        actions={
          <ExecutionActions
            execution={execution}
            onCancel={handleCancel}
            onRetry={handleRetry}
            isCancelling={cancelMutation.isPending}
            isRetrying={retryMutation.isPending}
            canCancelRetry={hasPermission(Permission.EXECUTIONS_RETRY)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ExecutionInfoCard
            execution={execution}
            automationName={automationName ?? ''}
            orgId={orgId}
          />
          <PromptDisplayCard prompt={execution.resolvedPrompt} />
        </div>
        <StatusTimeline execution={execution} />
      </div>

      <LogViewer orgId={orgId} executionId={executionId} executionStatus={execution.status} />
    </div>
  );
}
