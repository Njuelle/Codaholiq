import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { buildQueryParams } from '@/common/lib/query-params';
import { queryKeys } from '@/common/lib/query-keys';
import type { Automation, AutomationListFilters } from '@/common/types';

interface UseAutomationsParams {
  readonly orgId: number;
  readonly filters?: AutomationListFilters;
}

interface UseAutomationsReturn {
  readonly automations: readonly Automation[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useAutomations({ orgId, filters }: UseAutomationsParams): UseAutomationsReturn {
  const queryParams = buildQueryParams(filters);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...queryKeys.automations.all(orgId), queryParams],
    queryFn: () => apiGet<Automation[]>(`/orgs/${orgId}/automations`, queryParams),
    enabled: orgId > 0,
  });

  return {
    automations: data ?? [],
    isLoading,
    isError,
    error,
  };
}
