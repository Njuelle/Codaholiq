import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Role } from '@/common/types';

interface UseUpdateMemberRoleParams {
  readonly orgId: number;
}

interface UpdateMemberRoleInput {
  readonly userId: number;
  readonly role: Role;
}

export function useUpdateMemberRole({
  orgId,
}: UseUpdateMemberRoleParams): UseMutationResult<void, Error, UpdateMemberRoleInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: UpdateMemberRoleInput) =>
      apiPatch<void>(`/orgs/${orgId}/members/${userId}`, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.orgs.members(orgId),
      });
      toast.success('Member role updated');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update member role');
    },
  });
}
