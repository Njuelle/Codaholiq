import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockExecutionLog } from '@/test/factories';
import { useExecutionLogs } from '../use-execution-logs';
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

describe('useExecutionLogs', () => {
  it('should return initial logs on success', async () => {
    const { result } = renderHook(
      () =>
        useExecutionLogs({
          orgId: 1,
          executionId: 1,
          executionStatus: 'completed',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[0]!.message).toBe('Starting execution...');
    expect(result.current.isStreaming).toBe(false);
  });

  it('should handle empty logs', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return HttpResponse.json({
          data: [],
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(
      () =>
        useExecutionLogs({
          orgId: 1,
          executionId: 1,
          executionStatus: 'completed',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.logs).toHaveLength(0);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(
      () =>
        useExecutionLogs({
          orgId: 1,
          executionId: 1,
          executionStatus: 'completed',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
  });

  it('should return multiple log entries with correct order', async () => {
    const logs = [
      mockExecutionLog({ id: 1, message: 'Step 1', level: 'info' }),
      mockExecutionLog({ id: 2, message: 'Step 2', level: 'warn' }),
      mockExecutionLog({ id: 3, message: 'Step 3', level: 'error' }),
    ];

    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return HttpResponse.json({
          data: logs,
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(
      () =>
        useExecutionLogs({
          orgId: 1,
          executionId: 1,
          executionStatus: 'completed',
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.logs).toHaveLength(3);
    expect(result.current.logs[0]!.level).toBe('info');
    expect(result.current.logs[2]!.level).toBe('error');
  });
});
