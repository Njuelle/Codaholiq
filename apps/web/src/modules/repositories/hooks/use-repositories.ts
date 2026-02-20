import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { buildQueryParams } from '@/common/lib/query-params';
import { queryKeys } from '@/common/lib/query-keys';
import type { PaginatedResponse, Repository } from '@/common/types';

interface RepositoryFilters {
  readonly search?: string;
  readonly language?: string;
  readonly archived?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

interface UseRepositoriesParams {
  readonly orgId: number;
  readonly filters?: RepositoryFilters;
}

interface UseRepositoriesReturn {
  readonly repos: readonly Repository[];
  readonly total: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useRepositories({ orgId, filters }: UseRepositoriesParams): UseRepositoriesReturn {
  const queryParams = buildQueryParams(filters);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...queryKeys.repos.all(orgId), queryParams],
    queryFn: () => apiGet<PaginatedResponse<Repository>>(`/orgs/${orgId}/repos`, queryParams),
    enabled: orgId > 0,
  });

  return {
    repos: data?.items ?? [],
    total: data?.meta.total ?? 0,
    isLoading,
    isError,
    error,
  };
}
