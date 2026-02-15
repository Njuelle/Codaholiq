import { useEffect, useRef, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { apiPost } from '@/common/lib/api-client';
import { LoadingScreen } from '@/common/components/loading-screen';

export function AuthCallbackPage(): ReactElement {
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    window.history.replaceState({}, '', '/auth/callback');

    const code = params.get('code');
    if (!code) {
      void navigate('/login', { replace: true });
      return;
    }

    const exchange = async (): Promise<void> => {
      try {
        // Exchange the one-time code for tokens (refresh token set as httpOnly cookie by server)
        const result = await apiPost<{ accessToken: string }>('/auth/exchange', { code });
        handleCallback({ accessToken: result.accessToken });
        void navigate('/orgs', { replace: true });
      } catch {
        void navigate('/login', { replace: true });
      }
    };

    void exchange();
  }, [handleCallback, navigate]);

  return <LoadingScreen />;
}
