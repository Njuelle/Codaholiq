import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { Permission } from '@/common/types';
import { useRolePermissions } from '../use-role-permissions';
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

describe('useRolePermissions', () => {
  it('should fetch all role permissions', async () => {
    const { result } = renderHook(() => useRolePermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.rolePermissions).toBeDefined();
    expect(result.current.rolePermissions?.owner).toContain(Permission.AUTOMATIONS_VIEW);
    expect(result.current.rolePermissions?.admin).toContain(Permission.AUTOMATIONS_VIEW);
    expect(result.current.rolePermissions?.member).toContain(Permission.AUTOMATIONS_VIEW);
  });

  it('should return undefined when disabled', () => {
    const { result } = renderHook(() => useRolePermissions({ orgId: 1, enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.rolePermissions).toBeUndefined();
  });

  it('should not fetch when orgId is 0', () => {
    const { result } = renderHook(() => useRolePermissions({ orgId: 0 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.rolePermissions).toBeUndefined();
  });

  it('should return custom permissions when org has overrides', async () => {
    server.use(
      http.get('/api/orgs/:orgId/permissions', () => {
        return HttpResponse.json({
          data: {
            owner: Object.values(Permission),
            admin: [Permission.AUTOMATIONS_VIEW],
            member: [],
          },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useRolePermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.rolePermissions?.admin).toEqual([Permission.AUTOMATIONS_VIEW]);
    expect(result.current.rolePermissions?.member).toEqual([]);
  });
});
