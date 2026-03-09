import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/common/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatCost } from '@/common/lib/format';
import type { CostOverTimePoint } from '../types';
import type { ReactElement } from 'react';

interface CostOverTimeChartProps {
  readonly series: readonly CostOverTimePoint[];
}

const chartConfig: ChartConfig = {
  cost: {
    label: 'Cost',
    color: 'oklch(0.65 0.2 250)',
  },
};

function formatChartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatYAxisCost(value: number): string {
  const dollars = value / 1_000_000;
  if (dollars === 0) return '$0';
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(0)}`;
}

export function CostOverTimeChart({ series }: CostOverTimeChartProps): ReactElement {
  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No cost data available for the selected period.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <AreaChart data={series as CostOverTimePoint[]} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickFormatter={formatYAxisCost} tickLine={false} axisLine={false} width={60} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label: string) => formatChartDate(label)}
                  formatter={(value) => formatCost(Number(value))}
                />
              }
            />
            <defs>
              <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="totalCostMicros"
              type="monotone"
              fill="url(#fillCost)"
              stroke="var(--color-cost)"
              strokeWidth={2}
              name="cost"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
