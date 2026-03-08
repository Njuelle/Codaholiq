import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useModelPolicies } from '../use-model-policies';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

describe('useModelPolicies', () => {
  it('should return unrestricted when no policies exist', async () => {
    const { result } = renderHook(() => useModelPolicies({ orgId: 1, repoId: 100 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.policies).toEqual([]);
  });

  it('should return restricted when policies exist', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos/:repoId/model-policies', () => {
        return HttpResponse.json({
          data: {
            policies: [
              {
                provider: 'claude-code',
                model: 'claude-sonnet-4-5-20250929',
                createdAt: '2025-01-01',
                createdBy: 1,
              },
            ],
            isRestricted: true,
          },
          requestId: 'test',
        });
      }),
    );

    const { result } = renderHook(() => useModelPolicies({ orgId: 1, repoId: 100 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isRestricted).toBe(true);
    expect(result.current.policies).toHaveLength(1);
    expect(result.current.policies[0]?.provider).toBe('claude-code');
  });

  it('should not fetch when repoId is null', () => {
    const { result } = renderHook(() => useModelPolicies({ orgId: 1, repoId: null }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.policies).toEqual([]);
  });
});
