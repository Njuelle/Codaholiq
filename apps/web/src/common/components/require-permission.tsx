import type { ReactNode } from 'react';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import type { Permission } from '@/common/types';

interface RequirePermissionProps {
  readonly orgId: number;
  readonly permission: Permission;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

export function RequirePermission({
  orgId,
  permission,
  children,
  fallback = null,
}: RequirePermissionProps): ReactNode {
  const { hasPermission, isLoading } = useHasPermission({ orgId });

  if (isLoading) return null;
  if (!hasPermission(permission)) return fallback;
  return children;
}
