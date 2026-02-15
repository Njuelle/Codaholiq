import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import type { DashboardStats } from '@/common/types';
import { Activity, GitFork, CheckCircle, Zap } from 'lucide-react';
import type { ReactElement } from 'react';

interface StatsCardsProps {
  readonly stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps): ReactElement {
  const { last24h } = stats.executionStats;
  const successRate = last24h.total > 0 ? Math.round((last24h.completed / last24h.total) * 100) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Active Automations</CardTitle>
          <Zap className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeAutomationsCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Repositories</CardTitle>
          <GitFork className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.repositoryCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Executions (24h)</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{last24h.total}</div>
          <p className="text-xs text-muted-foreground">
            {last24h.completed} completed, {last24h.failed} failed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Success Rate (24h)</CardTitle>
          <CheckCircle className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate}%</div>
          <p className="text-xs text-muted-foreground">{last24h.running} currently running</p>
        </CardContent>
      </Card>
    </div>
  );
}
