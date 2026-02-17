import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { CatalogCategory, CatalogResponse } from '@/common/types';

interface UseAutomationCatalogReturn {
  readonly categories: readonly CatalogCategory[];
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function useAutomationCatalog(): UseAutomationCatalogReturn {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.catalog.all(),
    queryFn: () => apiGet<CatalogResponse>('/automation-catalog'),
    staleTime: 24 * 60 * 60 * 1000,
  });

  return {
    categories: data?.categories ?? [],
    isLoading,
    isError,
  };
}
