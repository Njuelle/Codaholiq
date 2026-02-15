import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useUpdateMemberRole } from '../use-update-member-role';
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

describe('useUpdateMemberRole', () => {
  it('should update role successfully', async () => {
    const { result } = renderHook(() => useUpdateMemberRole({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ userId: 2, role: 'admin' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle update error', async () => {
    server.use(
      http.patch('/api/orgs/:orgId/members/:userId', () => {
        return HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Not authorized' },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useUpdateMemberRole({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ userId: 2, role: 'admin' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
