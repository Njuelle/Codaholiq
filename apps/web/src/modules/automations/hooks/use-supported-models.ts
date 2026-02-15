import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { ClaudeModel } from '@/modules/automations/types';

interface ModelsResponse {
  readonly models: readonly ClaudeModel[];
  readonly defaultModelId: string;
}

interface UseSupportedModelsReturn {
  readonly models: readonly ClaudeModel[];
  readonly defaultModelName: string;
  readonly isLoading: boolean;
}

export function useSupportedModels(): UseSupportedModelsReturn {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.models.all(),
    queryFn: () => apiGet<ModelsResponse>('/models'),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — models rarely change
  });

  const defaultModelName = useMemo(() => {
    if (!data) return 'Default';
    const defaultModel = data.models.find((m) => m.id === data.defaultModelId);
    return defaultModel ? `Default (${defaultModel.name})` : 'Default';
  }, [data]);

  return {
    models: data?.models ?? [],
    defaultModelName,
    isLoading,
  };
}
