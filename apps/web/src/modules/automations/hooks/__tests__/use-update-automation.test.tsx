import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useUpdateAutomation } from '../use-update-automation';
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

describe('useUpdateAutomation', () => {
  it('should update automation successfully', async () => {
    const { result } = renderHook(() => useUpdateAutomation({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
      name: 'Updated Name',
      repoId: 1,
      promptTemplate: 'Test prompt',
      provider: 'claude-code',
      model: null,
      enabled: true,
      monthlyCostLimitMicros: null,
      variables: [],
      description: null,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle update error', async () => {
    server.use(
      http.patch('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: 'Invalid data' },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useUpdateAutomation({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
      name: '',
      repoId: 1,
      promptTemplate: 'Test prompt',
      provider: 'claude-code',
      model: null,
      enabled: true,
      monthlyCostLimitMicros: null,
      variables: [],
      description: null,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
