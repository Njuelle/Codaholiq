import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { ManualTriggerResponse } from '@/common/types';

interface UseTriggerAutomationParams {
  readonly orgId: number;
  readonly automationId: number;
}

interface TriggerParams {
  readonly variables?: Record<string, string>;
}

export function useTriggerAutomation({
  orgId,
  automationId,
}: UseTriggerAutomationParams): UseMutationResult<
  ManualTriggerResponse,
  Error,
  TriggerParams | void
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: TriggerParams | void) =>
      apiPost<ManualTriggerResponse>(
        `/orgs/${orgId}/automations/${automationId}/trigger`,
        params ?? {},
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.executions.all(orgId),
      });
      toast.success('Automation triggered');
    },
    onError: () => {
      toast.error('Failed to trigger automation');
    },
  });
}
