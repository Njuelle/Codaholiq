import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockExecution } from '@/test/factories';
import { useExecution } from '../use-execution';
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

describe('useExecution', () => {
  it('should return execution detail on success', async () => {
    const { result } = renderHook(() => useExecution({ orgId: 1, executionId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.execution).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.execution).not.toBeNull();
    expect(result.current.execution!.id).toBe(1);
    expect(result.current.automationName).toBe('Test Automation');
    expect(result.current.isError).toBe(false);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Execution not found' },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHook(() => useExecution({ orgId: 1, executionId: 999 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.execution).toBeNull();
  });

  it('should return running execution data', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return HttpResponse.json({
          data: {
            execution: mockExecution({ id: 5, status: 'running' }),
            automationName: 'Active Bot',
          },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useExecution({ orgId: 1, executionId: 5 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.execution!.status).toBe('running');
  });
});
