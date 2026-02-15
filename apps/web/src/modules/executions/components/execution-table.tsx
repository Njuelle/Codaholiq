import { StatusBadge } from '@/common/components/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { formatCompactDate, formatDuration, computeDurationMs } from '@/common/lib/format';
import type { ExecutionWithAutomation } from '@/common/types';
import { type KeyboardEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

interface ExecutionTableProps {
  readonly executions: readonly ExecutionWithAutomation[];
  readonly orgId: number;
}

export function ExecutionTable({ executions, orgId }: ExecutionTableProps): ReactElement {
  const navigate = useNavigate();

  const handleRowClick = (executionId: number): void => {
    void navigate(`/orgs/${orgId}/executions/${executionId}`);
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, executionId: number): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(executionId);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Automation</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Duration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.map((item) => {
          const durationMs = computeDurationMs({
            startedAt: item.execution.startedAt,
            completedAt: item.execution.completedAt,
          });

          return (
            <TableRow
              key={item.execution.id}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(item.execution.id)}
              onKeyDown={(e) => handleRowKeyDown(e, item.execution.id)}
            >
              <TableCell>
                <StatusBadge status={item.execution.status} />
              </TableCell>
              <TableCell className="font-medium">{item.automationName}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatCompactDate(item.execution.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {durationMs !== null ? formatDuration(durationMs) : '-'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
