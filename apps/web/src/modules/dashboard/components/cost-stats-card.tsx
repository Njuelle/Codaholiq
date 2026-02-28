import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/common/components/ui/tabs';
import { formatCost, formatTokens } from '@/common/lib/format';
import type { CostStats, DashboardStats } from '@/common/types';
import type { ReactElement } from 'react';

interface CostStatsCardProps {
  readonly costStats: DashboardStats['costStats'];
}

function CostBreakdown({ stats }: { readonly stats: CostStats }): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Total Cost</p>
        <p className="text-xl font-bold">{formatCost(stats.totalCostMicros)}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Avg per Execution</p>
        <p className="text-xl font-bold">{formatCost(stats.averageCostMicros)}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Input Tokens</p>
        <p className="text-xl font-bold">{formatTokens(stats.totalInputTokens)}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Output Tokens</p>
        <p className="text-xl font-bold">{formatTokens(stats.totalOutputTokens)}</p>
      </div>
    </div>
  );
}

export function CostStatsCard({ costStats }: CostStatsCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="24h">
          <TabsList>
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
          <TabsContent value="24h">
            <CostBreakdown stats={costStats.last24h} />
          </TabsContent>
          <TabsContent value="7d">
            <CostBreakdown stats={costStats.last7d} />
          </TabsContent>
          <TabsContent value="30d">
            <CostBreakdown stats={costStats.last30d} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
