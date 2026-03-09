import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '@/common/components/page-header';
import { useAnalytics } from '../hooks/use-analytics';
import { useRepositories } from '@/modules/repositories/hooks/use-repositories';
import { DateRangeSelector } from '../components/date-range-selector';
import { RepositorySelector } from '../components/repository-selector';
import { CostSummaryCards } from '../components/cost-summary-cards';
import { CostOverTimeChart } from '../components/cost-over-time-chart';
import { CostByProviderChart } from '../components/cost-by-provider-chart';
import { CostByAutomationTable } from '../components/cost-by-automation-table';
import type { DateRange, DateRangePreset } from '../types';
import type { ReactElement } from 'react';

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const to = new Date();
  const from = new Date();
  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
    case 'custom':
      from.setDate(from.getDate() - 30);
      break;
  }
  return { from, to };
}

const emptySummary = {
  totalCostMicros: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  executionsWithCost: 0,
  averageCostMicros: 0,
};

export function AnalyticsPage(): ReactElement {
  const { orgId } = useParams<{ orgId: string }>();
  const numericOrgId = Number(orgId);

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeFromPreset('30d'));
  const [repoId, setRepoId] = useState<number | undefined>(undefined);

  const { repos } = useRepositories({ orgId: numericOrgId });

  const { data, isLoading, isError } = useAnalytics({
    orgId: numericOrgId,
    dateRange,
    repoId,
  });

  function handlePresetChange(newPreset: DateRangePreset): void {
    if (newPreset === 'custom') return;
    setPreset(newPreset);
    setDateRange(getDateRangeFromPreset(newPreset));
  }

  function handleDateRangeChange(range: DateRange): void {
    setDateRange(range);
    setPreset('custom');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Cost & Usage"
          description="Track costs and usage across your automations."
        />
        <div className="flex items-center gap-3">
          <RepositorySelector repoId={repoId} repositories={repos} onRepoIdChange={setRepoId} />
          <DateRangeSelector
            dateRange={dateRange}
            preset={preset}
            onPresetChange={handlePresetChange}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[400px] items-center justify-center text-muted-foreground">
          Loading analytics...
        </div>
      ) : isError ? (
        <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Failed to load analytics data. Please try again.</p>
        </div>
      ) : (
        <>
          <CostSummaryCards summary={data?.summary ?? emptySummary} />
          <CostOverTimeChart series={data?.series ?? []} />
          <div className="grid gap-4 lg:grid-cols-2">
            <CostByProviderChart data={data?.costByProvider ?? []} />
            <CostByAutomationTable data={data?.topCostliestAutomations ?? []} />
          </div>
        </>
      )}
    </div>
  );
}
