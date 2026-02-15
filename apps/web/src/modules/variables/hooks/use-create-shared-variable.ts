import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { SharedVariable, CreateSharedVariableInput } from '@/common/types';

interface UseCreateSharedVariableParams {
  readonly orgId: number;
}

export function useCreateSharedVariable({
  orgId,
}: UseCreateSharedVariableParams): UseMutationResult<
  SharedVariable,
  Error,
  CreateSharedVariableInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSharedVariableInput) =>
      apiPost<SharedVariable>(`/orgs/${orgId}/variables`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.variables.all(orgId),
      });
      toast.success('Variable created');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create variable');
    },
  });
}
