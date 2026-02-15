import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useDeleteAutomation } from '../use-delete-automation';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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

describe('useDeleteAutomation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should delete automation successfully', async () => {
    const { result } = renderHook(() => useDeleteAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/orgs/1/automations');
  });

  it('should handle delete error', async () => {
    server.use(
      http.delete('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Not allowed' },
          { status: 403 },
        );
      }),
    );

    const { result } = renderHook(() => useDeleteAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
