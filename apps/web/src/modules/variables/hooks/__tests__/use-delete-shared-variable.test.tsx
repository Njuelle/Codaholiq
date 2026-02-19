import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useDeleteSharedVariable } from '../use-delete-shared-variable';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteSharedVariable', () => {
  it('should delete a shared variable successfully', async () => {
    const { result } = renderHook(() => useDeleteSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle delete error', async () => {
    server.use(
      http.delete('/api/orgs/:orgId/variables/:variableId', () => {
        return HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Not allowed' },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useDeleteSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
