import { DollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatCost } from '@/common/lib/format';
import type { CostSummary } from '../types';
import type { ReactElement } from 'react';

interface CostSummaryCardsProps {
  readonly summary: CostSummary;
}

export function CostSummaryCards({ summary }: CostSummaryCardsProps): ReactElement {
  const cards = [
    {
      title: 'Total Cost',
      value: formatCost(summary.totalCostMicros),
      icon: DollarSign,
    },
    {
      title: 'Avg Cost / Execution',
      value: formatCost(summary.averageCostMicros),
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map(({ title, value, icon: Icon }) => (
        <Card key={title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">
              {summary.executionsWithCost} execution{summary.executionsWithCost !== 1 ? 's' : ''}{' '}
              with cost data
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
