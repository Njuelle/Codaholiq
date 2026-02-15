import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockRepo } from '@/test/factories';
import { useRepos } from '../use-repos';
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

describe('useRepos', () => {
  it('should return repos array on success', async () => {
    const { result } = renderHook(() => useRepos({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.repos[0]!.fullName).toBe('test-org/repo-1');
    expect(result.current.repos[1]!.fullName).toBe('test-org/repo-2');
  });

  it('should pass search param', async () => {
    const searchResult = mockRepo({
      id: 5,
      name: 'search-match',
      fullName: 'test-org/search-match',
    });

    server.use(
      http.get('/api/orgs/:orgId/repos', ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        if (search === 'search-match') {
          return HttpResponse.json({
            data: {
              items: [searchResult],
              meta: { total: 1, limit: 100, offset: 0 },
            },
            requestId: 'test-request-id',
          });
        }
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 100, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useRepos({ orgId: 1, search: 'search-match' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.repos).toHaveLength(1);
    expect(result.current.repos[0]!.name).toBe('search-match');
  });
});
