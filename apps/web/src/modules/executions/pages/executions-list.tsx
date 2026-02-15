import { ExecutionFilters } from '@/modules/executions/components/execution-filters';
import { ExecutionTable } from '@/modules/executions/components/execution-table';
import { EmptyState } from '@/common/components/empty-state';
import { PageHeader } from '@/common/components/page-header';
import { Button } from '@/common/components/ui/button';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useAutomations } from '@/modules/automations/hooks/use-automations';
import { useExecutions } from '@/modules/executions/hooks/use-executions';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import type { ExecutionStatus } from '@/common/types';
import { Activity } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';
import { useSearchParams } from 'react-router-dom';

const PAGE_SIZE = 20;

export function ExecutionsListPage(): ReactElement {
  const { org } = useOrg();
  const [searchParams] = useSearchParams();

  const rawAutomationId = searchParams.get('automationId');
  const parsedAutomationId = rawAutomationId ? Number(rawAutomationId) : NaN;
  const initialAutomationId = Number.isNaN(parsedAutomationId) ? undefined : parsedAutomationId;

  const [status, setStatus] = useState<ExecutionStatus | undefined>();
  const [automationId, setAutomationId] = useState<number | undefined>(initialAutomationId);
  const [page, setPage] = useState(0);

  const orgId = org?.id ?? 0;

  const { executions, total, isLoading, isError, error } = useExecutions({
    orgId,
    filters: {
      status,
      automationId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
  });

  const { automations } = useAutomations({ orgId });

  const handleStatusChange = useCallback((value: ExecutionStatus | undefined): void => {
    setStatus(value);
    setPage(0);
  }, []);

  const handleAutomationIdChange = useCallback((value: number | undefined): void => {
    setAutomationId(value);
    setPage(0);
  }, []);

  const handlePreviousPage = useCallback((): void => {
    setPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback((): void => {
    setPage((prev) => prev + 1);
  }, []);

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Executions" description="Monitor your automation executions." />
        <p className="text-destructive text-sm">
          Failed to load executions: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  const isEmpty = !isLoading && executions.length === 0 && page === 0;
  const hasNextPage = executions.length === PAGE_SIZE;
  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd = page * PAGE_SIZE + executions.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Executions" description="Monitor your automation executions." />

      <ExecutionFilters
        status={status}
        automationId={automationId}
        automations={automations}
        onStatusChange={handleStatusChange}
        onAutomationIdChange={handleAutomationIdChange}
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={Activity}
          title="No executions found"
          description={
            status || automationId
              ? 'Try adjusting your filters.'
              : 'Executions will appear here when your automations run.'
          }
        />
      )}

      {!isLoading && executions.length > 0 && (
        <>
          <ExecutionTable executions={executions} orgId={orgId} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
