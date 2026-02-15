import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseCancelExecutionParams {
  readonly orgId: number;
}

export function useCancelExecution({
  orgId,
}: UseCancelExecutionParams): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (executionId: number) =>
      apiPost<void>(`/orgs/${orgId}/executions/${executionId}/cancel`),
    onSuccess: (_data, executionId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.executions.all(orgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.executions.detail({ orgId, executionId }),
      });
      toast.success('Execution cancelled');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to cancel execution');
    },
  });
}
