import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockNotification } from '@/test/factories';
import { useNotifications } from '../use-notifications';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
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

describe('useNotifications', () => {
  it('should fetch notifications and return count', async () => {
    server.use(
      http.get('/api/orgs/:orgId/notifications', () => {
        return HttpResponse.json({
          data: [mockNotification({ id: 1 }), mockNotification({ id: 2 })],
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useNotifications({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.count).toBe(2);
  });

  it('should return empty array when no notifications', async () => {
    const { result } = renderHook(() => useNotifications({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it('should not fetch when orgId is 0', () => {
    const { result } = renderHook(() => useNotifications({ orgId: 0 }), {
      wrapper: createWrapper(),
    });

    // Should stay in initial state without fetching
    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });
});
