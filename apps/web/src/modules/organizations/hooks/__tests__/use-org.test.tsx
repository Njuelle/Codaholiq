import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { mockOrg } from '@/test/factories';
import { AuthProvider } from '@/modules/auth/hooks/use-auth';
import { OrgProvider, useOrg } from '../use-org';
import type { ReactNode } from 'react';

function createWrapper({ isAuthenticated = true }: { isAuthenticated?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  const user = isAuthenticated ? { id: 1, username: 'test', email: null, avatarUrl: null } : null;

  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user} initialIsAuthenticated={isAuthenticated}>
          <OrgProvider>{children}</OrgProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('useOrg', () => {
  it('should throw when used outside OrgProvider', () => {
    expect(() => renderHook(() => useOrg())).toThrow('useOrg must be used within an OrgProvider');
  });

  it('should fetch and auto-select the first org', async () => {
    const org1 = mockOrg({ id: 10, name: 'First Org' });
    const org2 = mockOrg({ id: 20, name: 'Second Org' });

    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [org1, org2],
          requestId: 'req-1',
        });
      }),
    );

    const { result } = renderHook(() => useOrg(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.org?.id).toBe(10);
    });

    expect(result.current.orgs).toHaveLength(2);
  });

  it('should restore last-used org from localStorage', async () => {
    const org1 = mockOrg({ id: 10, name: 'First' });
    const org2 = mockOrg({ id: 20, name: 'Second' });

    localStorage.setItem('lastOrgId', '20');

    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [org1, org2],
          requestId: 'req-1',
        });
      }),
    );

    const { result } = renderHook(() => useOrg(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.org?.id).toBe(20);
    });
  });

  it('should switch org and persist selection', async () => {
    const org1 = mockOrg({ id: 10, name: 'First' });
    const org2 = mockOrg({ id: 20, name: 'Second' });

    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [org1, org2],
          requestId: 'req-1',
        });
      }),
    );

    const { result } = renderHook(() => useOrg(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.org?.id).toBe(10);
    });

    act(() => {
      result.current.switchOrg(20);
    });

    expect(result.current.org?.id).toBe(20);
    expect(localStorage.getItem('lastOrgId')).toBe('20');
  });

  it('should not fetch orgs when not authenticated', async () => {
    let fetchCalled = false;
    server.use(
      http.get('/api/orgs', () => {
        fetchCalled = true;
        return HttpResponse.json({
          data: [],
          requestId: 'req-1',
        });
      }),
    );

    const { result } = renderHook(() => useOrg(), {
      wrapper: createWrapper({ isAuthenticated: false }),
    });

    // Give time for any fetch to fire
    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCalled).toBe(false);
    expect(result.current.org).toBeNull();
  });

  it('should use initialOrg for testing', () => {
    const testOrg = mockOrg({ id: 99, name: 'Test Org' });

    function TestWrapper({ children }: { children: ReactNode }): ReactNode {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <AuthProvider
            initialUser={{
              id: 1,
              username: 'test',
              email: null,
              avatarUrl: null,
            }}
            initialIsAuthenticated
          >
            <OrgProvider initialOrg={testOrg}>{children}</OrgProvider>
          </AuthProvider>
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useOrg(), { wrapper: TestWrapper });

    expect(result.current.org?.id).toBe(99);
    expect(result.current.isLoading).toBe(false);
  });
});
