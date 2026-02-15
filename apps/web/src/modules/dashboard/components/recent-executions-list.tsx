import { StatusBadge } from '@/common/components/status-badge';
import { Button } from '@/common/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatRelativeTime } from '@/common/lib/format';
import type { ExecutionSummary } from '@/common/types';
import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface RecentExecutionsListProps {
  readonly executions: readonly ExecutionSummary[];
  readonly orgId: number;
}

export function RecentExecutionsList({
  executions,
  orgId,
}: RecentExecutionsListProps): ReactElement {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Executions</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/orgs/${orgId}/executions`}>
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent executions.</p>
        ) : (
          <div className="space-y-3">
            {executions.map((item) => (
              <div
                key={item.execution.id}
                className="flex items-center justify-between cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent"
                role="button"
                tabIndex={0}
                onClick={() => void navigate(`/orgs/${orgId}/executions/${item.execution.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    void navigate(`/orgs/${orgId}/executions/${item.execution.id}`);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.execution.status} />
                  <span className="text-sm font-medium">{item.automationName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(item.execution.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
