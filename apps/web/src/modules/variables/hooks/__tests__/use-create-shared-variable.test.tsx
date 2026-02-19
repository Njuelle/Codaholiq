import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useCreateSharedVariable } from '../use-create-shared-variable';
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

describe('useCreateSharedVariable', () => {
  it('should create a shared variable successfully', async () => {
    const { result } = renderHook(() => useCreateSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ key: 'NEW_VAR', value: 'new-value' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle create error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/variables', () => {
        return HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'Variable already exists' },
          { status: 409 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateSharedVariable({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ key: 'EXISTING', value: 'val' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
