import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseUpdateWorkflowPRParams {
  readonly orgId: number;
  readonly repoId: number;
}

interface UpdateWorkflowPRResponse {
  readonly pullRequestUrl: string;
}

export function useUpdateWorkflowPR({
  orgId,
  repoId,
}: UseUpdateWorkflowPRParams): UseMutationResult<UpdateWorkflowPRResponse, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiPost<UpdateWorkflowPRResponse>(`/orgs/${orgId}/repos/${repoId}/update-workflow`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.setupStatus({ orgId, repoId }),
      });
      toast.success('Workflow update pull request created successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create workflow update pull request');
    },
  });
}
