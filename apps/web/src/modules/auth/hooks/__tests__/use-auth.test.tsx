import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { AuthProvider, useAuth } from '../use-auth';
import { setAccessToken, getAccessToken } from '@/common/lib/api-client';
import type { ReactNode } from 'react';

function createTestJwt({
  sub = 1,
  username = 'testuser',
  avatarUrl = null as string | null,
  exp = Math.floor(Date.now() / 1000) + 900,
} = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub, username, avatarUrl, iat: Math.floor(Date.now() / 1000), exp }),
  );
  return `${header}.${payload}.test-sig`;
}

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <AuthProvider skipSessionRestore>{children}</AuthProvider>;
}

describe('useAuth', () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it('should throw when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    );
  });

  it('should start with isLoading false when skipSessionRestore is true', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should start with isLoading true and restore session via cookie', async () => {
    const testJwt = createTestJwt({ sub: 5, username: 'restored' });
    server.use(
      http.post('/api/auth/refresh', () => {
        return HttpResponse.json({
          data: { accessToken: testJwt },
          requestId: 'req-1',
        });
      }),
    );

    function restoreWrapper({ children }: { children: ReactNode }): ReactNode {
      return <AuthProvider>{children}</AuthProvider>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: restoreWrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('restored');
    expect(result.current.user?.id).toBe(5);
  });

  it('should skip session restore on /auth/callback route', async () => {
    const originalPathname = window.location.pathname;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/auth/callback' },
      writable: true,
    });

    let refreshCalled = false;
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshCalled = true;
        return HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Missing' },
          { status: 401 },
        );
      }),
    );

    function restoreWrapper({ children }: { children: ReactNode }): ReactNode {
      return <AuthProvider>{children}</AuthProvider>;
    }

    try {
      const { result } = renderHook(() => useAuth(), { wrapper: restoreWrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(refreshCalled).toBe(false);
      expect(result.current.isAuthenticated).toBe(false);
    } finally {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, pathname: originalPathname },
        writable: true,
      });
    }
  });

  it('should clear state when refresh fails on mount', async () => {
    server.use(
      http.post('/api/auth/refresh', () => {
        return HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Expired' },
          { status: 401 },
        );
      }),
    );

    function restoreWrapper({ children }: { children: ReactNode }): ReactNode {
      return <AuthProvider>{children}</AuthProvider>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: restoreWrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should set user on handleCallback', () => {
    const testJwt = createTestJwt({ sub: 10, username: 'newuser' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.handleCallback({
        accessToken: testJwt,
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.id).toBe(10);
    expect(result.current.user?.username).toBe('newuser');
    expect(getAccessToken()).toBe(testJwt);
  });

  it('should clear state on logout', async () => {
    const testJwt = createTestJwt({ sub: 1, username: 'user' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.handleCallback({
        accessToken: testJwt,
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('lastOrgId')).toBeNull();
  });

  it('should use initialUser for testing', () => {
    const testUser = { id: 99, username: 'init', email: null, avatarUrl: null };
    function testWrapper({ children }: { children: ReactNode }): ReactNode {
      return (
        <AuthProvider initialUser={testUser} initialIsAuthenticated>
          {children}
        </AuthProvider>
      );
    }

    const { result } = renderHook(() => useAuth(), { wrapper: testWrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.user?.username).toBe('init');
  });
});
