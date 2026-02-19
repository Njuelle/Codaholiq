import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockSharedVariable } from '@/test/factories';
import { useSharedVariables } from '../use-shared-variables';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSharedVariables', () => {
  it('should fetch shared variables for the org', async () => {
    const { result } = renderHook(() => useSharedVariables({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.variables.length).toBeGreaterThan(0);
    expect(result.current.isError).toBe(false);
  });

  it('should return empty array when orgId is 0', async () => {
    const { result } = renderHook(() => useSharedVariables({ orgId: 0 }), {
      wrapper: createWrapper(),
    });

    // Query is disabled when orgId <= 0, so it stays in initial state
    expect(result.current.variables).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle fetch error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/variables', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'DB down' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useSharedVariables({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.variables).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });
});
