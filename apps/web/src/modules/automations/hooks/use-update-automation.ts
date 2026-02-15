import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import type { Automation } from '@/common/types';

interface UseUpdateAutomationParams {
  readonly orgId: number;
  readonly automationId: number;
}

export function useUpdateAutomation({
  orgId,
  automationId,
}: UseUpdateAutomationParams): UseMutationResult<Automation, Error, AutomationFormValues> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AutomationFormValues) =>
      apiPatch<Automation>(`/orgs/${orgId}/automations/${automationId}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.detail({ orgId, automationId }),
      });
      toast.success('Automation updated');
    },
    onError: () => {
      toast.error('Failed to update automation');
    },
  });
}
