import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AnalyticsData, DateRange } from '../types';

interface UseAnalyticsParams {
  readonly orgId: number;
  readonly dateRange: DateRange;
  readonly repoId?: number;
}

interface UseAnalyticsReturn {
  readonly data: AnalyticsData | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useAnalytics({ orgId, dateRange, repoId }: UseAnalyticsParams): UseAnalyticsReturn {
  const from = dateRange.from.toISOString();
  const to = dateRange.to.toISOString();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.analytics.costOverTime({ orgId, from, to, repoId }),
    queryFn: () =>
      apiGet<AnalyticsData>(`/orgs/${orgId}/analytics/cost-over-time`, {
        from,
        to,
        ...(repoId ? { repoId: String(repoId) } : {}),
      }),
    enabled: orgId > 0,
    staleTime: 60_000,
  });

  return {
    data: data ?? null,
    isLoading,
    isError,
    error,
  };
}
