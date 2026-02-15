import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockMyPermissionsResponse } from '@/test/factories';
import { Permission } from '@/common/types';
import { useMyPermissions } from '../use-my-permissions';
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

describe('useMyPermissions', () => {
  it('should fetch and return permissions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/permissions/me', () => {
        return HttpResponse.json({
          data: mockMyPermissionsResponse({
            role: 'admin',
            permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
          }),
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useMyPermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.role).toBe('admin');
    expect(result.current.permissions).toEqual([
      Permission.AUTOMATIONS_VIEW,
      Permission.EXECUTIONS_VIEW,
    ]);
  });

  it('should return empty permissions while loading', () => {
    const { result } = renderHook(() => useMyPermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.permissions).toEqual([]);
    expect(result.current.role).toBeUndefined();
  });

  it('should not fetch when orgId is 0', () => {
    const { result } = renderHook(() => useMyPermissions({ orgId: 0 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.permissions).toEqual([]);
    expect(result.current.role).toBeUndefined();
  });

  it('should return all permissions for owner', async () => {
    const { result } = renderHook(() => useMyPermissions({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Default MSW handler returns owner with all permissions
    expect(result.current.role).toBe('owner');
    expect(result.current.permissions.length).toBeGreaterThan(0);
  });
});
