import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/common/components/ui/tabs';
import type { DashboardStats, StatusCounts } from '@/common/types';
import type { ReactElement } from 'react';

interface ExecutionStatsTabsProps {
  readonly stats: DashboardStats['executionStats'];
}

function StatsBreakdown({ counts }: { readonly counts: StatusCounts }): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="text-xl font-bold">{counts.total}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Running</p>
        <p className="text-xl font-bold text-blue-600">{counts.running}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Completed</p>
        <p className="text-xl font-bold text-green-600">{counts.completed}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Failed</p>
        <p className="text-xl font-bold text-red-600">{counts.failed}</p>
      </div>
    </div>
  );
}

export function ExecutionStatsTabs({ stats }: ExecutionStatsTabsProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="24h">
          <TabsList>
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
          <TabsContent value="24h">
            <StatsBreakdown counts={stats.last24h} />
          </TabsContent>
          <TabsContent value="7d">
            <StatsBreakdown counts={stats.last7d} />
          </TabsContent>
          <TabsContent value="30d">
            <StatsBreakdown counts={stats.last30d} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
