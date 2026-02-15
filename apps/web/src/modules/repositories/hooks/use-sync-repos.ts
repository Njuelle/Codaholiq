import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseSyncReposParams {
  readonly orgId: number;
}

interface SyncReposResponse {
  readonly synced: number;
}

export function useSyncRepos({
  orgId,
}: UseSyncReposParams): UseMutationResult<SyncReposResponse, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<SyncReposResponse>(`/orgs/${orgId}/repos/sync`),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.all(orgId),
      });
      toast.success(`Synced ${data.synced} repositories`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to sync repositories');
    },
  });
}
