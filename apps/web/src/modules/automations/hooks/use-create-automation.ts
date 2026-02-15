import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AutomationWithVariables } from '@/common/types';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';

interface UseCreateAutomationParams {
  readonly orgId: number;
}

export function useCreateAutomation({
  orgId,
}: UseCreateAutomationParams): UseMutationResult<
  AutomationWithVariables,
  Error,
  AutomationFormValues
> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: AutomationFormValues) =>
      apiPost<AutomationWithVariables>(`/orgs/${orgId}/automations`, data),
    onSuccess: (automation) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      toast.success(`Automation "${automation.name}" created`);
      void navigate(`/orgs/${orgId}/automations/${automation.id}`);
    },
    onError: () => {
      toast.error('Failed to create automation');
    },
  });
}
