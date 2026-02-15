import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockAutomation } from '@/test/factories';
import { useAutomations } from '../use-automations';
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

describe('useAutomations', () => {
  it('should return automations array on success', async () => {
    const { result } = renderHook(() => useAutomations({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.automations).toEqual([]);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.automations).toHaveLength(2);
    expect(result.current.automations[0]!.name).toBe('Test Automation');
    expect(result.current.automations[1]!.name).toBe('Cron Automation');
    expect(result.current.isError).toBe(false);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Something went wrong' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useAutomations({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.automations).toEqual([]);
  });

  it('should pass filter params to API', async () => {
    const filtered = mockAutomation({ id: 10, name: 'Filtered', triggerType: 'cron' });

    server.use(
      http.get('/api/orgs/:orgId/automations', ({ request }) => {
        const url = new URL(request.url);
        const triggerType = url.searchParams.get('triggerType');
        if (triggerType === 'cron') {
          return HttpResponse.json({
            data: [filtered],
            requestId: 'test-request-id',
          });
        }
        return HttpResponse.json({
          data: [],
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(
      () => useAutomations({ orgId: 1, filters: { triggerType: 'cron' } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.automations).toHaveLength(1);
    expect(result.current.automations[0]!.name).toBe('Filtered');
  });
});
