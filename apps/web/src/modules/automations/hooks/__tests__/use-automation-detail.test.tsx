import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAutomationDetail } from '../use-automation-detail';
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

describe('useAutomationDetail', () => {
  it('should return automation with variables on success', async () => {
    const { result } = renderHook(() => useAutomationDetail({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.automation).toBeDefined();
    expect(result.current.automation?.name).toBe('Test Automation');
    expect(result.current.automation?.variables).toBeDefined();
    expect(result.current.isError).toBe(false);
  });

  it('should handle not found error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Automation not found' },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHook(() => useAutomationDetail({ orgId: 1, automationId: 999 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.automation).toBeUndefined();
  });
});
