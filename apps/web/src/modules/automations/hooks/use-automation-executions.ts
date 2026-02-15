import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { ExecutionWithAutomation, PaginatedResponse } from '@/common/types';

interface UseAutomationExecutionsParams {
  readonly orgId: number;
  readonly automationId: number;
  readonly limit?: number;
}

interface UseAutomationExecutionsReturn {
  readonly executions: readonly ExecutionWithAutomation[];
  readonly isLoading: boolean;
}

export function useAutomationExecutions({
  orgId,
  automationId,
  limit = 5,
}: UseAutomationExecutionsParams): UseAutomationExecutionsReturn {
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.executions.all(orgId), { automationId, limit }],
    queryFn: () =>
      apiGet<PaginatedResponse<ExecutionWithAutomation>>(`/orgs/${orgId}/executions`, {
        automationId,
        limit,
      }),
  });

  return {
    executions: data?.items ?? [],
    isLoading,
  };
}
