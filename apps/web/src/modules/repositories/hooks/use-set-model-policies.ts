import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPut } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { ModelPoliciesResponse } from '@/modules/repositories/types';

interface UseSetModelPoliciesParams {
  readonly orgId: number;
  readonly repoId: number;
}

interface SetModelPoliciesInput {
  readonly policies: readonly { provider: string; model: string }[];
}

export function useSetModelPolicies({
  orgId,
  repoId,
}: UseSetModelPoliciesParams): UseMutationResult<
  ModelPoliciesResponse,
  Error,
  SetModelPoliciesInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetModelPoliciesInput) =>
      apiPut<ModelPoliciesResponse>(`/orgs/${orgId}/repos/${repoId}/model-policies`, input),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.repos.modelPolicies({ orgId, repoId }),
      });
      toast.success(data.isRestricted ? 'Model policy updated' : 'Model restrictions removed');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update model policy');
    },
  });
}
