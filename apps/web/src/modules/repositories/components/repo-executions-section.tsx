import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { StatusBadge } from '@/common/components/status-badge';
import { useExecutions } from '@/modules/executions/hooks/use-executions';
import { formatRelativeTime } from '@/common/lib/format';
import { Link } from 'react-router-dom';
import { Button } from '@/common/components/ui/button';
import type { ReactElement } from 'react';

interface RepoExecutionsSectionProps {
  readonly orgId: number;
  readonly repoId: number;
}

export function RepoExecutionsSection({ orgId, repoId }: RepoExecutionsSectionProps): ReactElement {
  const { executions, isLoading } = useExecutions({
    orgId,
    filters: { repoId, limit: 5 },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Executions</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/orgs/${orgId}/executions`}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isLoading && executions.length === 0 && (
          <p className="text-muted-foreground text-sm">No executions yet.</p>
        )}

        {!isLoading && executions.length > 0 && (
          <div className="space-y-2">
            {executions.map(({ execution, automationName }) => (
              <Link
                key={execution.id}
                to={`/orgs/${orgId}/executions/${execution.id}`}
                className="hover:bg-muted flex items-center justify-between rounded-md border p-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={execution.status} />
                  <span className="text-sm">{automationName}</span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTime(execution.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
