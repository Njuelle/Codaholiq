import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { SharedVariable, UpdateSharedVariableInput } from '@/common/types';

interface UseUpdateSharedVariableParams {
  readonly orgId: number;
}

interface UpdateSharedVariableMutationInput {
  readonly variableId: number;
  readonly data: UpdateSharedVariableInput;
}

export function useUpdateSharedVariable({
  orgId,
}: UseUpdateSharedVariableParams): UseMutationResult<
  SharedVariable,
  Error,
  UpdateSharedVariableMutationInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ variableId, data }: UpdateSharedVariableMutationInput) =>
      apiPatch<SharedVariable>(`/orgs/${orgId}/variables/${variableId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.variables.all(orgId),
      });
      toast.success('Variable updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update variable');
    },
  });
}
