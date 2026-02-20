import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseCreateWorkflowPRParams {
  readonly orgId: number;
  readonly repoId: number;
}

interface CreateWorkflowPRResponse {
  readonly pullRequestUrl: string;
}

export function useCreateWorkflowPR({
  orgId,
  repoId,
}: UseCreateWorkflowPRParams): UseMutationResult<CreateWorkflowPRResponse, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<CreateWorkflowPRResponse>(`/orgs/${orgId}/repos/${repoId}/setup-workflow`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.setupStatus({ orgId, repoId }),
      });
      toast.success('Pull request created successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create workflow pull request');
    },
  });
}
