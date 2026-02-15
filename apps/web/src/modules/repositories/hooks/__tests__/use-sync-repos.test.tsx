import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useSyncRepos } from '../use-sync-repos';
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

describe('useSyncRepos', () => {
  it('should sync repos successfully', async () => {
    const { result } = renderHook(() => useSyncRepos({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle sync error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/repos/sync', () => {
        return HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Not authorized' },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useSyncRepos({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
