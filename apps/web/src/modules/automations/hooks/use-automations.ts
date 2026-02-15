import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
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
  const queryParams: Record<string, unknown> = {};
  if (filters?.triggerType) queryParams.triggerType = filters.triggerType;
  if (filters?.enabled !== undefined) queryParams.enabled = String(filters.enabled);
  if (filters?.repoId) queryParams.repoId = filters.repoId;
  if (filters?.limit) queryParams.limit = filters.limit;
  if (filters?.offset) queryParams.offset = filters.offset;

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
