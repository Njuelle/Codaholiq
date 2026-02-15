import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useDashboard } from '../use-dashboard';
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

describe('useDashboard', () => {
  it('should return dashboard stats on success', async () => {
    const { result } = renderHook(() => useDashboard({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.stats).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats!.activeAutomationsCount).toBe(5);
    expect(result.current.stats!.repositoryCount).toBe(3);
    expect(result.current.stats!.recentExecutions).toHaveLength(2);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/dashboard', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useDashboard({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.stats).toBeNull();
  });
});
