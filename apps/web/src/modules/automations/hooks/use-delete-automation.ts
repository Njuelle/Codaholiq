import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiDelete } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseDeleteAutomationParams {
  readonly orgId: number;
}

export function useDeleteAutomation({
  orgId,
}: UseDeleteAutomationParams): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (automationId: number) => apiDelete(`/orgs/${orgId}/automations/${automationId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.automations.all(orgId),
      });
      toast.success('Automation deleted');
      void navigate(`/orgs/${orgId}/automations`);
    },
    onError: () => {
      toast.error('Failed to delete automation');
    },
  });
}
