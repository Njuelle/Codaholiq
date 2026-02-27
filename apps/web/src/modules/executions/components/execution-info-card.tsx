import { StatusBadge } from '@/common/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { isValidGitHubUrl } from '@/modules/executions/lib/execution-utils';
import { formatDate, formatDuration, computeDurationMs } from '@/common/lib/format';
import { useProviders } from '@/modules/automations/hooks/use-providers';
import type { Execution } from '@/common/types';
import { ExternalLink } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface ExecutionInfoCardProps {
  readonly execution: Execution;
  readonly automationName: string;
  readonly orgId: number;
}

export function ExecutionInfoCard({
  execution,
  automationName,
  orgId,
}: ExecutionInfoCardProps): ReactElement {
  const { getProviderName } = useProviders();
  const durationMs = computeDurationMs({
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <StatusBadge status={execution.status} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="text-sm font-medium">
              {durationMs !== null ? formatDuration(durationMs) : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Automation</p>
            <Link
              to={`/orgs/${orgId}/automations/${execution.automationId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {automationName}
            </Link>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Provider</p>
            <p className="text-sm font-medium">
              {execution.provider ? getProviderName(execution.provider) : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-sm font-medium">{formatDate(execution.createdAt)}</p>
          </div>
        </div>

        {execution.githubRunUrl && isValidGitHubUrl(execution.githubRunUrl) && (
          <div>
            <a
              href={execution.githubRunUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on GitHub
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {execution.errorMessage && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{execution.errorMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
