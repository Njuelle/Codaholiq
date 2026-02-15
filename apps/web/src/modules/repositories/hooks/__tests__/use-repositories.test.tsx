import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockRepo } from '@/test/factories';
import { useRepositories } from '../use-repositories';
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

describe('useRepositories', () => {
  it('should return repos on success', async () => {
    const { result } = renderHook(() => useRepositories({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.isError).toBe(false);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useRepositories({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.repos).toEqual([]);
  });

  it('should pass search filter to API', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        if (search === 'frontend') {
          return HttpResponse.json({
            data: {
              items: [mockRepo({ id: 10, name: 'frontend-app' })],
              meta: { total: 1, limit: 50, offset: 0 },
            },
            requestId: 'test-request-id',
          });
        }
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 50, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(
      () => useRepositories({ orgId: 1, filters: { search: 'frontend' } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toHaveLength(1);
    expect(result.current.repos[0]!.name).toBe('frontend-app');
  });
});
