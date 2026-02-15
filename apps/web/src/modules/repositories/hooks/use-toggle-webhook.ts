import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Repository } from '@/common/types';

interface UseToggleWebhookParams {
  readonly orgId: number;
  readonly repoId: number;
}

export function useToggleWebhook({
  orgId,
  repoId,
}: UseToggleWebhookParams): UseMutationResult<Repository, Error, boolean> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (webhookActive: boolean) =>
      apiPatch<Repository>(`/orgs/${orgId}/repos/${repoId}`, { webhookActive }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.detail({ orgId, repoId }),
      });
      toast.success(data.webhookActive ? 'Webhook enabled' : 'Webhook disabled');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update webhook status');
    },
  });
}
