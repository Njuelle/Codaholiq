import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/common/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatCost } from '@/common/lib/format';
import type { ProviderCostBreakdown } from '../types';
import type { ReactElement } from 'react';

interface CostByProviderChartProps {
  readonly data: readonly ProviderCostBreakdown[];
}

const chartConfig: ChartConfig = {
  cost: {
    label: 'Cost',
    color: 'oklch(0.7 0.15 150)',
  },
};

function formatProviderLabel(item: ProviderCostBreakdown): string {
  return item.model ? `${item.provider} (${item.model})` : item.provider;
}

export function CostByProviderChart({ data }: CostByProviderChartProps): ReactElement {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No provider cost data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    name: formatProviderLabel(item),
    totalCostMicros: item.totalCostMicros,
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart data={chartData} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              width={140}
              tick={{ fontSize: 12 }}
            />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatCost(value)}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => formatCost(Number(value))} />}
            />
            <Bar dataKey="totalCostMicros" fill="var(--color-cost)" radius={4} name="cost" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
