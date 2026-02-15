import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { MyPermissionsResponse, Permission } from '@/common/types';

interface UseMyPermissionsParams {
  readonly orgId: number;
}

interface UseMyPermissionsReturn {
  readonly permissions: readonly Permission[];
  readonly role: 'owner' | 'admin' | 'member' | undefined;
  readonly isLoading: boolean;
}

export function useMyPermissions({ orgId }: UseMyPermissionsParams): UseMyPermissionsReturn {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.permissions.me(orgId),
    queryFn: () => apiGet<MyPermissionsResponse>(`/orgs/${orgId}/permissions/me`),
    enabled: orgId > 0,
    staleTime: 60_000,
  });

  return {
    permissions: data?.permissions ?? [],
    role: data?.role,
    isLoading,
  };
}
