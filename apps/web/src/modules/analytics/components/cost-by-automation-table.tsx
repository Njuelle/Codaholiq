import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { formatCost } from '@/common/lib/format';
import type { AutomationCostBreakdown } from '../types';
import type { ReactElement } from 'react';

interface CostByAutomationTableProps {
  readonly data: readonly AutomationCostBreakdown[];
}

export function CostByAutomationTable({ data }: CostByAutomationTableProps): ReactElement {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Costliest Automations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No automation cost data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Costliest Automations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Automation</TableHead>
              <TableHead className="text-right">Executions</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.automationId}>
                <TableCell className="font-medium">{item.automationName}</TableCell>
                <TableCell className="text-right">{item.executionCount}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCost(item.totalCostMicros)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
