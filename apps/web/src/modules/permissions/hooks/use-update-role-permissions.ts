import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiPut } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Permission } from '@/common/types';

interface UseUpdateRolePermissionsParams {
  readonly orgId: number;
}

interface UpdateRolePermissionsInput {
  readonly role: 'admin' | 'member';
  readonly permissions: Permission[];
}

export function useUpdateRolePermissions({
  orgId,
}: UseUpdateRolePermissionsParams): UseMutationResult<void, Error, UpdateRolePermissionsInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ role, permissions }: UpdateRolePermissionsInput) =>
      apiPut<void>(`/orgs/${orgId}/permissions/${role}`, { permissions }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.permissions.all(orgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.permissions.me(orgId),
      });
    },
  });
}
