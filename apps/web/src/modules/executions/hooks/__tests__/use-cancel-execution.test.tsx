import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useCancelExecution } from '../use-cancel-execution';
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

describe('useCancelExecution', () => {
  it('should cancel execution successfully', async () => {
    const { result } = renderHook(() => useCancelExecution({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(1);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle cancel error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/executions/:executionId/cancel', () => {
        return HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: 'Cannot cancel' },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useCancelExecution({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(1);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
