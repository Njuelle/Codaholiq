import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockMyPermissionsResponse } from '@/test/factories';
import { Permission } from '@/common/types';
import { useHasPermission } from '../use-has-permission';
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

describe('useHasPermission', () => {
  it('should return true for permissions the user has', async () => {
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

    const { result } = renderHook(() => useHasPermission({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission(Permission.AUTOMATIONS_VIEW)).toBe(true);
    expect(result.current.hasPermission(Permission.EXECUTIONS_VIEW)).toBe(true);
  });

  it('should return false for permissions the user lacks', async () => {
    server.use(
      http.get('/api/orgs/:orgId/permissions/me', () => {
        return HttpResponse.json({
          data: mockMyPermissionsResponse({
            role: 'member',
            permissions: [Permission.AUTOMATIONS_VIEW],
          }),
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useHasPermission({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPermission(Permission.AUTOMATIONS_CREATE)).toBe(false);
    expect(result.current.hasPermission(Permission.ORG_MEMBERS_MANAGE)).toBe(false);
  });

  it('should return false for all permissions while loading', () => {
    const { result } = renderHook(() => useHasPermission({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    // While loading, hasPermission should return false (empty array)
    expect(result.current.hasPermission(Permission.AUTOMATIONS_VIEW)).toBe(false);
  });
});
