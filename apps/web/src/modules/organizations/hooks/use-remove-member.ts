import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseRemoveMemberParams {
  readonly orgId: number;
}

export function useRemoveMember({
  orgId,
}: UseRemoveMemberParams): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => apiDelete(`/orgs/${orgId}/members/${userId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orgs.members(orgId),
      });
      toast.success('Member removed');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove member');
    },
  });
}
