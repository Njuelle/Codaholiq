import type { UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDeleteMutation } from '@/common/hooks/use-delete-mutation';
import { queryKeys } from '@/common/lib/query-keys';

interface UseDeleteAutomationParams {
  readonly orgId: number;
}

export function useDeleteAutomation({
  orgId,
}: UseDeleteAutomationParams): UseMutationResult<void, Error, number> {
  const navigate = useNavigate();

  return useDeleteMutation({
    buildUrl: (automationId) => `/orgs/${orgId}/automations/${automationId}`,
    queryKey: queryKeys.automations.all(orgId),
    successMessage: 'Automation deleted',
    errorMessage: 'Failed to delete automation',
    onSuccess: () => void navigate(`/orgs/${orgId}/automations`),
  });
}
