import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useSupportedModels } from '../use-supported-models';
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

describe('useSupportedModels', () => {
  it('should return models after loading', async () => {
    const { result } = renderHook(() => useSupportedModels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toHaveLength(3);
    expect(result.current.models[0]).toEqual({
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      description: 'Balanced speed and capability',
    });
    expect(result.current.models[1]).toEqual({
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      description: 'Most capable, best for complex tasks',
    });
    expect(result.current.models[2]).toEqual({
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      description: 'Fastest and most cost-effective',
    });
  });

  it('should compute defaultModelName from the default model', async () => {
    const { result } = renderHook(() => useSupportedModels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultModelName).toBe('Default (Claude Sonnet 4.5)');
  });

  it('should return "Default" as defaultModelName while loading', () => {
    const { result } = renderHook(() => useSupportedModels(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.defaultModelName).toBe('Default');
    expect(result.current.models).toEqual([]);
  });

  it('should handle API error gracefully', async () => {
    server.use(
      http.get('/api/models', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Something went wrong' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useSupportedModels(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.models).toEqual([]);
    expect(result.current.defaultModelName).toBe('Default');
  });
});
