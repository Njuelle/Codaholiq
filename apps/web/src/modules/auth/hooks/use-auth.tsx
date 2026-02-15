import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
  type ReactElement,
} from 'react';
import {
  setAccessToken,
  setOnAuthFailure,
  refreshAccessToken,
  apiPost,
} from '@/common/lib/api-client';
import { decodeJwtPayload } from '@/common/lib/jwt';
import type { User } from '@/modules/auth/types';

/** Must match the route in App.tsx router config */
const AUTH_CALLBACK_PATH = '/auth/callback';

interface AuthContextValue {
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly login: () => void;
  readonly logout: () => Promise<void>;
  readonly handleCallback: (params: { accessToken: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  readonly children: ReactNode;
  readonly initialUser?: User | null;
  readonly initialIsAuthenticated?: boolean;
  readonly skipSessionRestore?: boolean;
}

export function AuthProvider({
  children,
  initialUser = null,
  initialIsAuthenticated,
  skipSessionRestore = false,
}: AuthProviderProps): ReactElement {
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser && !skipSessionRestore);

  const isAuthenticated = initialIsAuthenticated !== undefined ? initialIsAuthenticated : !!user;

  const refreshSession = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const token = await refreshAccessToken({ signal });
      const payload = decodeJwtPayload(token);
      setUser({
        id: payload.sub,
        username: payload.username,
        email: null,
        avatarUrl: payload.avatarUrl,
      });
    } catch {
      if (!signal?.aborted) {
        setAccessToken(null);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  // On mount: attempt session restore via httpOnly cookie
  useEffect(() => {
    if (initialUser !== null || skipSessionRestore) {
      setIsLoading(false);
      return;
    }

    // Skip on the OAuth callback page — the exchange flow handles auth
    if (window.location.pathname === AUTH_CALLBACK_PATH) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    void refreshSession(controller.signal);
    return () => controller.abort();
  }, [initialUser, skipSessionRestore, refreshSession]);

  // Register auth failure callback
  useEffect(() => {
    setOnAuthFailure(() => {
      setUser(null);
      setAccessToken(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  const login = useCallback((): void => {
    window.location.href = '/api/auth/github';
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // Ignore logout errors — server clears cookie regardless
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('lastOrgId');
  }, []);

  const handleCallback = useCallback(({ accessToken }: { accessToken: string }): void => {
    setAccessToken(accessToken);
    const payload = decodeJwtPayload(accessToken);
    setUser({
      id: payload.sub,
      username: payload.username,
      email: null,
      avatarUrl: payload.avatarUrl,
    });
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated, isLoading, login, logout, handleCallback }),
    [user, isAuthenticated, isLoading, login, logout, handleCallback],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
