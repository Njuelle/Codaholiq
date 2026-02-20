import type { UseMutationResult } from '@tanstack/react-query';
import { useDeleteMutation } from '@/common/hooks/use-delete-mutation';
import { queryKeys } from '@/common/lib/query-keys';

interface UseRemoveMemberParams {
  readonly orgId: number;
}

export function useRemoveMember({
  orgId,
}: UseRemoveMemberParams): UseMutationResult<void, Error, number> {
  return useDeleteMutation({
    buildUrl: (userId) => `/orgs/${orgId}/members/${userId}`,
    queryKey: queryKeys.orgs.members(orgId),
    successMessage: 'Member removed',
    errorMessage: 'Failed to remove member',
  });
}
