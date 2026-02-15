import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { DashboardStats } from '@/common/types';

interface UseDashboardParams {
  readonly orgId: number;
}

interface UseDashboardReturn {
  readonly stats: DashboardStats | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useDashboard({ orgId }: UseDashboardParams): UseDashboardReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.stats(orgId),
    queryFn: () => apiGet<DashboardStats>(`/orgs/${orgId}/dashboard`),
    enabled: orgId > 0,
    refetchInterval: 30_000,
  });

  return {
    stats: data ?? null,
    isLoading,
    isError,
    error,
  };
}
