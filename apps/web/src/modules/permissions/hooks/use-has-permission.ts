import { useMyPermissions } from './use-my-permissions';
import type { Permission } from '@/common/types';

interface UseHasPermissionParams {
  readonly orgId: number;
}

interface UseHasPermissionReturn {
  readonly hasPermission: (permission: Permission) => boolean;
  readonly isLoading: boolean;
}

export function useHasPermission({ orgId }: UseHasPermissionParams): UseHasPermissionReturn {
  const { permissions, isLoading } = useMyPermissions({ orgId });

  return {
    hasPermission: (permission: Permission) => permissions.includes(permission),
    isLoading,
  };
}
