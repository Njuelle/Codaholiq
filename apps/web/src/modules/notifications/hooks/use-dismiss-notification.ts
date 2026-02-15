import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiDelete } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseDismissNotificationParams {
  readonly orgId: number;
}

export function useDismissNotification({
  orgId,
}: UseDismissNotificationParams): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) =>
      apiDelete(`/orgs/${orgId}/notifications/${notificationId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(orgId),
      });
    },
  });
}
