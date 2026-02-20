import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';

interface UseSetupStatusParams {
  readonly orgId: number;
  readonly repoId: number;
}

interface SetupStatusResponse {
  readonly workflowFileExists: boolean;
  readonly secretsConfigured: boolean;
  readonly hasAnthropicKey: boolean;
  readonly hasOAuthToken: boolean;
}

interface UseSetupStatusReturn {
  readonly workflowFileExists: boolean | undefined;
  readonly secretsConfigured: boolean | undefined;
  readonly hasAnthropicKey: boolean | undefined;
  readonly hasOAuthToken: boolean | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useSetupStatus({ orgId, repoId }: UseSetupStatusParams): UseSetupStatusReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.repos.setupStatus({ orgId, repoId }),
    queryFn: () => apiGet<SetupStatusResponse>(`/orgs/${orgId}/repos/${repoId}/setup-status`),
    enabled: orgId > 0 && repoId > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    workflowFileExists: data?.workflowFileExists,
    secretsConfigured: data?.secretsConfigured,
    hasAnthropicKey: data?.hasAnthropicKey,
    hasOAuthToken: data?.hasOAuthToken,
    isLoading,
    isError,
    error,
  };
}
