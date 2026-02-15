import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Repository } from '@/common/types';

interface UseRepositoryParams {
  readonly orgId: number;
  readonly repoId: number;
}

interface RepositoryDetailResponse {
  readonly repo: Repository;
  readonly automationCount: number;
}

interface UseRepositoryReturn {
  readonly repo: Repository | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useRepository({ orgId, repoId }: UseRepositoryParams): UseRepositoryReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.repos.detail({ orgId, repoId }),
    queryFn: () => apiGet<RepositoryDetailResponse>(`/orgs/${orgId}/repos/${repoId}`),
    enabled: orgId > 0 && repoId > 0,
  });

  return {
    repo: data?.repo,
    isLoading,
    isError,
    error,
  };
}
