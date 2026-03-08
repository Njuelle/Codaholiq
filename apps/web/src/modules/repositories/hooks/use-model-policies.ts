import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { ModelPolicyEntry, ModelPoliciesResponse } from '@/modules/repositories/types';

interface UseModelPoliciesParams {
  readonly orgId: number;
  readonly repoId: number | null;
}

interface UseModelPoliciesReturn {
  readonly policies: readonly ModelPolicyEntry[];
  readonly isRestricted: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function useModelPolicies({
  orgId,
  repoId,
}: UseModelPoliciesParams): UseModelPoliciesReturn {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.repos.modelPolicies({ orgId, repoId: repoId! }),
    queryFn: () => apiGet<ModelPoliciesResponse>(`/orgs/${orgId}/repos/${repoId!}/model-policies`),
    enabled: orgId > 0 && repoId !== null && repoId > 0,
    staleTime: 60 * 1000,
  });

  return {
    policies: data?.policies ?? [],
    isRestricted: data?.isRestricted ?? false,
    isLoading,
    isError,
  };
}
