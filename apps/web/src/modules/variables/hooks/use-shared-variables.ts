import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { SharedVariable } from '@/common/types';

interface UseSharedVariablesParams {
  readonly orgId: number;
}

interface UseSharedVariablesReturn {
  readonly variables: readonly SharedVariable[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useSharedVariables({ orgId }: UseSharedVariablesParams): UseSharedVariablesReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.variables.all(orgId),
    queryFn: () => apiGet<SharedVariable[]>(`/orgs/${orgId}/variables`),
    enabled: orgId > 0,
  });

  return {
    variables: data ?? [],
    isLoading,
    isError,
    error,
  };
}
