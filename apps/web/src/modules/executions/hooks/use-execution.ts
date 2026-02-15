import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { TERMINAL_STATUSES } from '@/modules/executions/lib/execution-utils';
import { queryKeys } from '@/common/lib/query-keys';
import type { Execution, ExecutionWithAutomation } from '@/common/types';

interface UseExecutionParams {
  readonly orgId: number;
  readonly executionId: number;
}

interface UseExecutionReturn {
  readonly execution: Execution | null;
  readonly automationName: string | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useExecution({ orgId, executionId }: UseExecutionParams): UseExecutionReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.executions.detail({ orgId, executionId }),
    queryFn: () => apiGet<ExecutionWithAutomation>(`/orgs/${orgId}/executions/${executionId}`),
    enabled: orgId > 0 && executionId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.execution.status;
      if (!status) return false;
      return TERMINAL_STATUSES.has(status) ? false : 3000;
    },
  });

  return {
    execution: data?.execution ?? null,
    automationName: data?.automationName ?? null,
    isLoading,
    isError,
    error,
  };
}
