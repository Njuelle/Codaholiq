import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useTriggerAutomation } from '../use-trigger-automation';
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

describe('useTriggerAutomation', () => {
  it('should trigger automation and return executionId', async () => {
    const { result } = renderHook(() => useTriggerAutomation({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ executionId: 42, status: 'pending' });
  });

  it('should handle trigger error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/automations/:automationId/trigger', () => {
        return HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: 'Automation is disabled' },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useTriggerAutomation({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
