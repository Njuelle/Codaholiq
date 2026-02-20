import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { buildQueryParams } from '@/common/lib/query-params';
import { TERMINAL_STATUSES } from '@/modules/executions/lib/execution-utils';
import { queryKeys } from '@/common/lib/query-keys';
import type { ExecutionStatus, ExecutionWithAutomation, PaginatedResponse } from '@/common/types';

interface ExecutionFilters {
  readonly status?: ExecutionStatus;
  readonly automationId?: number;
  readonly repoId?: number;
  readonly limit?: number;
  readonly offset?: number;
}

interface UseExecutionsParams {
  readonly orgId: number;
  readonly filters?: ExecutionFilters;
}

interface UseExecutionsReturn {
  readonly executions: readonly ExecutionWithAutomation[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useExecutions({ orgId, filters }: UseExecutionsParams): UseExecutionsReturn {
  const queryParams = buildQueryParams(filters);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...queryKeys.executions.all(orgId), queryParams],
    queryFn: () =>
      apiGet<PaginatedResponse<ExecutionWithAutomation>>(`/orgs/${orgId}/executions`, queryParams),
    enabled: orgId > 0,
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      if (!items) return false;
      const hasActive = items.some((item) => !TERMINAL_STATUSES.has(item.execution.status));
      return hasActive ? 5000 : false;
    },
  });

  return {
    executions: data?.items ?? [],
    total: data?.meta.total ?? 0,
    isLoading,
    isError,
    error,
  };
}
