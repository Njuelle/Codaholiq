import { CostStatsCard } from '@/modules/dashboard/components/cost-stats-card';
import { ExecutionStatsTabs } from '@/modules/dashboard/components/execution-stats-tabs';
import { RecentExecutionsList } from '@/modules/dashboard/components/recent-executions-list';
import { StatsCards } from '@/modules/dashboard/components/stats-cards';
import { TopCostliestAutomationsCard } from '@/modules/dashboard/components/top-costliest-automations-card';
import { UpcomingCronsCard } from '@/modules/dashboard/components/upcoming-crons-card';
import { PageHeader } from '@/common/components/page-header';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useDashboard } from '@/modules/dashboard/hooks/use-dashboard';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import type { ReactElement } from 'react';

export function DashboardPage(): ReactElement {
  const { org } = useOrg();
  const orgId = org?.id ?? 0;
  const { stats, isLoading, isError, error } = useDashboard({ orgId });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Overview of your automation activity." />
        <p className="text-destructive text-sm">
          Failed to load dashboard: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${org?.name ?? 'your organization'}.`}
      />

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentExecutionsList executions={stats.recentExecutions} orgId={orgId} />
        <CostStatsCard costStats={stats.costStats} />
        <TopCostliestAutomationsCard automations={stats.topCostliestAutomations} orgId={orgId} />
        <ExecutionStatsTabs stats={stats.executionStats} />
      </div>

      <UpcomingCronsCard triggers={stats.upcomingCronTriggers} orgId={orgId} />
    </div>
  );
}
