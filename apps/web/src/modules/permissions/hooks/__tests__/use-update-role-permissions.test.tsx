import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { Permission } from '@/common/types';
import { useUpdateRolePermissions } from '../use-update-role-permissions';
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

describe('useUpdateRolePermissions', () => {
  it('should call PUT with role and permissions', async () => {
    let capturedBody: unknown = null;
    let capturedRole: string | undefined;

    server.use(
      http.put('/api/orgs/:orgId/permissions/:role', async ({ request, params }) => {
        capturedBody = await request.json();
        capturedRole = params.role as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useUpdateRolePermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedRole).toBe('admin');
    expect(capturedBody).toEqual({
      permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
    });
  });

  it('should handle errors', async () => {
    server.use(
      http.put('/api/orgs/:orgId/permissions/:role', () => {
        return HttpResponse.json({ statusCode: 403, message: 'Forbidden' }, { status: 403 });
      }),
    );

    const { result } = renderHook(() => useUpdateRolePermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({
        role: 'member',
        permissions: [Permission.AUTOMATIONS_VIEW],
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
