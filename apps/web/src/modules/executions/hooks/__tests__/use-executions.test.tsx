import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockExecution } from '@/test/factories';
import { useExecutions } from '../use-executions';
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

describe('useExecutions', () => {
  it('should return executions on success', async () => {
    const { result } = renderHook(() => useExecutions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.executions).toHaveLength(1);
    expect(result.current.executions[0]!.automationName).toBe('Test Automation');
    expect(result.current.total).toBe(1);
    expect(result.current.isError).toBe(false);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'DB down' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useExecutions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.executions).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('should pass filter params to API', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        if (status === 'failed') {
          return HttpResponse.json({
            data: {
              items: [
                {
                  execution: mockExecution({ id: 10, status: 'failed' }),
                  automationName: 'Failed Run',
                },
              ],
              meta: { total: 1, limit: 50, offset: 0 },
            },
            requestId: 'test-request-id',
          });
        }
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 50, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(
      () => useExecutions({ orgId: 1, filters: { status: 'failed' } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.executions).toHaveLength(1);
    expect(result.current.executions[0]!.automationName).toBe('Failed Run');
  });
});
