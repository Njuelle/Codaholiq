import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Notification } from '@/common/types';

interface UseNotificationsParams {
  readonly orgId: number;
}

interface UseNotificationsReturn {
  readonly notifications: readonly Notification[];
  readonly count: number;
  readonly isLoading: boolean;
}

export function useNotifications({ orgId }: UseNotificationsParams): UseNotificationsReturn {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications.all(orgId),
    queryFn: () => apiGet<Notification[]>(`/orgs/${orgId}/notifications`),
    enabled: orgId > 0,
    refetchInterval: 30_000,
  });

  return {
    notifications: data ?? [],
    count: data?.length ?? 0,
    isLoading,
  };
}
