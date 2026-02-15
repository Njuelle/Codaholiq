import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseDeleteSharedVariableParams {
  readonly orgId: number;
}

export function useDeleteSharedVariable({
  orgId,
}: UseDeleteSharedVariableParams): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variableId: number) => apiDelete(`/orgs/${orgId}/variables/${variableId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.variables.all(orgId),
      });
      toast.success('Variable deleted');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete variable');
    },
  });
}
