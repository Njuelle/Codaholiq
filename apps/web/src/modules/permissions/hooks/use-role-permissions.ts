import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AllRolePermissions } from '@/common/types';

interface UseRolePermissionsParams {
  readonly orgId: number;
  readonly enabled?: boolean;
}

interface UseRolePermissionsReturn {
  readonly rolePermissions: AllRolePermissions | undefined;
  readonly isLoading: boolean;
}

export function useRolePermissions({
  orgId,
  enabled = true,
}: UseRolePermissionsParams): UseRolePermissionsReturn {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.permissions.all(orgId),
    queryFn: () => apiGet<AllRolePermissions>(`/orgs/${orgId}/permissions`),
    enabled: enabled && orgId > 0,
    staleTime: 60_000,
  });

  return {
    rolePermissions: data,
    isLoading,
  };
}
