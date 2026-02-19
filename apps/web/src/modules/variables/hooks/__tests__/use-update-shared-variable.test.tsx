import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useUpdateSharedVariable } from '../use-update-shared-variable';
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

describe('useUpdateSharedVariable', () => {
  it('should update a shared variable successfully', async () => {
    const { result } = renderHook(() => useUpdateSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ variableId: 1, data: { value: 'updated-value' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle update error', async () => {
    server.use(
      http.patch('/api/orgs/:orgId/variables/:variableId', () => {
        return HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Variable not found' },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHook(() => useUpdateSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ variableId: 999, data: { value: 'val' } });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
