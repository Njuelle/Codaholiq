import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useOrgMembers } from '../use-org-members';
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

describe('useOrgMembers', () => {
  it('should return members on success', async () => {
    const { result } = renderHook(() => useOrgMembers({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.members).toHaveLength(2);
    expect(result.current.members[0]!.username).toBe('owner-user');
    expect(result.current.members[0]!.role).toBe('owner');
    expect(result.current.isError).toBe(false);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/members', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useOrgMembers({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.members).toEqual([]);
  });
});
