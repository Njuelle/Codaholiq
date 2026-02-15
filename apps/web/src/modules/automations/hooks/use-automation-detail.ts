import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AutomationWithVariables } from '@/common/types';

interface UseAutomationDetailParams {
  readonly orgId: number;
  readonly automationId: number;
}

interface UseAutomationDetailReturn {
  readonly automation: AutomationWithVariables | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useAutomationDetail({
  orgId,
  automationId,
}: UseAutomationDetailParams): UseAutomationDetailReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.automations.detail({ orgId, automationId }),
    queryFn: () => apiGet<AutomationWithVariables>(`/orgs/${orgId}/automations/${automationId}`),
  });

  return {
    automation: data,
    isLoading,
    isError,
    error,
  };
}
