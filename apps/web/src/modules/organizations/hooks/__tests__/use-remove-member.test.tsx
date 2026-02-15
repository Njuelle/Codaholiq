import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useRemoveMember } from '../use-remove-member';
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

describe('useRemoveMember', () => {
  it('should remove member successfully', async () => {
    const { result } = renderHook(() => useRemoveMember({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle removal error', async () => {
    server.use(
      http.delete('/api/orgs/:orgId/members/:userId', () => {
        return HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Cannot remove' },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useRemoveMember({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
