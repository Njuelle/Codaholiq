import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useRepository } from '../use-repository';
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

describe('useRepository', () => {
  it('should return repo on success', async () => {
    const { result } = renderHook(() => useRepository({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 },
    );

    expect(result.current.repo).toBeDefined();
  });

  it('should handle 404 error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos/:repoId', () => {
        return HttpResponse.json(
          { error: 'Not Found', message: 'Repository not found', statusCode: 404 },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHook(() => useRepository({ orgId: 1, repoId: 999 }), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.repo).toBeUndefined();
  });

  it('should not fetch when orgId is 0', () => {
    const { result } = renderHook(() => useRepository({ orgId: 0, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.repo).toBeUndefined();
  });
});
