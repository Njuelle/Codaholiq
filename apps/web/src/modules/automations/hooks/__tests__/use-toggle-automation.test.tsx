import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useToggleAutomation } from '../use-toggle-automation';
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
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useToggleAutomation', () => {
  it('should toggle automation enabled status', async () => {
    const { result } = renderHook(() => useToggleAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ automationId: 1, enabled: false });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle toggle error', async () => {
    server.use(
      http.patch('/api/orgs/:orgId/automations/:automationId/enabled', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Toggle failed' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useToggleAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ automationId: 1, enabled: true });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
