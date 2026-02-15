import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Execution } from '@/common/types';

interface UseRetryExecutionParams {
  readonly orgId: number;
}

interface RetryExecutionResponse {
  readonly execution: Execution;
}

export function useRetryExecution({
  orgId,
}: UseRetryExecutionParams): UseMutationResult<RetryExecutionResponse, Error, number> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (executionId: number) =>
      apiPost<RetryExecutionResponse>(`/orgs/${orgId}/executions/${executionId}/retry`),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.executions.all(orgId),
      });
      toast.success('Execution retried');
      void navigate(`/orgs/${orgId}/executions/${data.execution.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to retry execution');
    },
  });
}
