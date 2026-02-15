import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { PaginatedResponse, Repository } from '@/common/types';

interface UseReposParams {
  readonly orgId: number;
  readonly search?: string;
}

interface UseReposReturn {
  readonly repos: readonly Repository[];
  readonly isLoading: boolean;
}

export function useRepos({ orgId, search }: UseReposParams): UseReposReturn {
  const params: Record<string, unknown> = { limit: 100 };
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.repos.all(orgId), params],
    queryFn: () => apiGet<PaginatedResponse<Repository>>(`/orgs/${orgId}/repos`, params),
  });

  return {
    repos: data?.items ?? [],
    isLoading,
  };
}
