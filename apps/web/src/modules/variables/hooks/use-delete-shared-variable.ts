import type { UseMutationResult } from '@tanstack/react-query';
import { useDeleteMutation } from '@/common/hooks/use-delete-mutation';
import { queryKeys } from '@/common/lib/query-keys';

interface UseDeleteSharedVariableParams {
  readonly orgId: number;
}

export function useDeleteSharedVariable({
  orgId,
}: UseDeleteSharedVariableParams): UseMutationResult<void, Error, number> {
  return useDeleteMutation({
    buildUrl: (variableId) => `/orgs/${orgId}/variables/${variableId}`,
    queryKey: queryKeys.variables.all(orgId),
    successMessage: 'Variable deleted',
    errorMessage: 'Failed to delete variable',
  });
}
