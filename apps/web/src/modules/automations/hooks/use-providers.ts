import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type {
  ProviderDefinition,
  ProviderListResponse,
  ProviderModel,
} from '@/modules/automations/types';

interface UseProvidersReturn {
  readonly providers: readonly ProviderDefinition[];
  readonly defaultProviderId: string;
  readonly isLoading: boolean;
  readonly getProviderName: (providerId: string) => string;
  readonly getModelsForProvider: (providerId: string) => readonly ProviderModel[];
  readonly getDefaultModelId: (providerId: string) => string | null;
}

export function useProviders(): UseProvidersReturn {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.providers.all(),
    queryFn: () => apiGet<ProviderListResponse>('/providers'),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const providerMap = useMemo(() => {
    const map = new Map<string, ProviderDefinition>();
    for (const provider of data?.providers ?? []) {
      map.set(provider.id, provider);
    }
    return map;
  }, [data]);

  const getProviderName = useCallback(
    (providerId: string): string => {
      return providerMap.get(providerId)?.name ?? providerId;
    },
    [providerMap],
  );

  const getModelsForProvider = useCallback(
    (providerId: string): readonly ProviderModel[] => {
      return providerMap.get(providerId)?.models ?? [];
    },
    [providerMap],
  );

  const getDefaultModelId = useCallback(
    (providerId: string): string | null => {
      return providerMap.get(providerId)?.defaultModelId ?? null;
    },
    [providerMap],
  );

  return {
    providers: data?.providers ?? [],
    defaultProviderId: data?.defaultProviderId ?? 'claude-code',
    isLoading,
    getProviderName,
    getModelsForProvider,
    getDefaultModelId,
  };
}
