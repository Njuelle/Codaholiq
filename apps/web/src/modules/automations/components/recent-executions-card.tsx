import { StatusBadge } from '@/common/components/status-badge';
import { Button } from '@/common/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { formatCompactDate, formatDuration, computeDurationMs } from '@/common/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { useAutomationExecutions } from '@/modules/automations/hooks/use-automation-executions';
import { ArrowRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface RecentExecutionsCardProps {
  readonly orgId: number;
  readonly automationId: number;
}

function LoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function RecentExecutionsCard({
  orgId,
  automationId,
}: RecentExecutionsCardProps): ReactElement {
  const { executions, isLoading } = useAutomationExecutions({
    orgId,
    automationId,
    limit: 5,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Executions</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/orgs/${orgId}/executions?automationId=${automationId}`}>
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : executions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No executions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((item) => (
                <TableRow key={item.execution.id}>
                  <TableCell>
                    <StatusBadge status={item.execution.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatCompactDate(item.execution.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {(() => {
                      const ms = computeDurationMs({
                        startedAt: item.execution.startedAt,
                        completedAt: item.execution.completedAt,
                      });
                      return ms !== null ? formatDuration(ms) : '-';
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
