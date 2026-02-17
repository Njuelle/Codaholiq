import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiPost } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { AutomationWithVariables, CreateFromTemplateInput } from '@/common/types';

interface UseCreateFromTemplateParams {
  readonly orgId: number;
}

export function useCreateFromTemplate({
  orgId,
}: UseCreateFromTemplateParams): UseMutationResult<
  AutomationWithVariables,
  Error,
  CreateFromTemplateInput
> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: CreateFromTemplateInput) =>
      apiPost<AutomationWithVariables>(`/orgs/${orgId}/automations/from-template`, data),
    onSuccess: (automation) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      toast.success(`Automation "${automation.name}" created from template`);
      void navigate(`/orgs/${orgId}/automations/${automation.id}`);
    },
    onError: () => {
      toast.error('Failed to create automation from template');
    },
  });
}
