import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useProviders } from '../use-providers';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useProviders', () => {
  it('should return loading state initially', () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.providers).toEqual([]);
  });

  it('should fetch and return providers', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.providers).toHaveLength(2);
    const providerIds = result.current.providers.map((p) => p.id);
    expect(providerIds).toEqual(['claude-code', 'codex']);
    expect(result.current.defaultProviderId).toBe('claude-code');
  });

  it('should resolve provider name by ID', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getProviderName('claude-code')).toBe('Claude Code');
    expect(result.current.getProviderName('codex')).toBe('OpenAI Codex');
    expect(result.current.getProviderName('unknown')).toBe('unknown');
  });

  it('should return models for a given provider', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const claudeModels = result.current.getModelsForProvider('claude-code');
    expect(claudeModels).toHaveLength(2);
    expect(claudeModels.map((m) => m.id)).toContain('claude-sonnet-4-5-20250929');

    const codexModels = result.current.getModelsForProvider('codex');
    expect(codexModels).toHaveLength(2);
    expect(codexModels.map((m) => m.id)).toContain('codex-mini');
  });

  it('should return empty models for unknown provider', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getModelsForProvider('nonexistent')).toEqual([]);
  });

  it('should return default model ID for a provider', async () => {
    const { result } = renderHook(() => useProviders(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.getDefaultModelId('claude-code')).toBe('claude-sonnet-4-5-20250929');
    expect(result.current.getDefaultModelId('codex')).toBe('codex-mini');
    expect(result.current.getDefaultModelId('unknown')).toBeNull();
  });
});
