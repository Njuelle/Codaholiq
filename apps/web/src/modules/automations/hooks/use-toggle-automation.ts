import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPatch } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { Automation } from '@/common/types';

interface UseToggleAutomationParams {
  readonly orgId: number;
}

interface ToggleParams {
  readonly automationId: number;
  readonly enabled: boolean;
}

export function useToggleAutomation({
  orgId,
}: UseToggleAutomationParams): UseMutationResult<
  void,
  Error,
  ToggleParams,
  { previousList: Automation[] | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ automationId, enabled }: ToggleParams) =>
      apiPatch<void>(`/orgs/${orgId}/automations/${automationId}/enabled`, { enabled }),
    onMutate: async ({ automationId, enabled }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.automations.all(orgId),
      });

      const previousList = queryClient.getQueryData<Automation[]>(queryKeys.automations.all(orgId));

      // Optimistic update on list cache — update any matching query
      queryClient.setQueriesData<Automation[]>(
        { queryKey: queryKeys.automations.all(orgId) },
        (old) => old?.map((a) => (a.id === automationId ? { ...a, enabled } : a)),
      );

      return { previousList };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueriesData<Automation[]>(
          { queryKey: queryKeys.automations.all(orgId) },
          () => context.previousList,
        );
      }
      toast.error('Failed to update automation status');
    },
    onSettled: (_data, _err, { automationId }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.detail({ orgId, automationId }),
      });
    },
  });
}
