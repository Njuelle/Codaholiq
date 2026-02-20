import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete } from '@/common/lib/api-client';

interface UseDeleteMutationOptions {
  readonly buildUrl: (id: number) => string;
  readonly queryKey: readonly unknown[];
  readonly successMessage: string;
  readonly errorMessage?: string;
  readonly onSuccess?: () => void;
}

export function useDeleteMutation({
  buildUrl,
  queryKey,
  successMessage,
  errorMessage = 'Operation failed',
  onSuccess,
}: UseDeleteMutationOptions): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiDelete(buildUrl(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
      toast.success(successMessage);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || errorMessage);
    },
  });
}
