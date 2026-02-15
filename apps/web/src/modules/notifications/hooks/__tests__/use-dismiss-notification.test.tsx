import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useDismissNotification } from '../use-dismiss-notification';
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

describe('useDismissNotification', () => {
  it('should dismiss notification successfully', async () => {
    const { result } = renderHook(() => useDismissNotification({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(5);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should handle dismiss error', async () => {
    server.use(
      http.delete('/api/orgs/:orgId/notifications/:notificationId', () => {
        return HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Notification not found' },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHook(() => useDismissNotification({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate(99999);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
