import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { Github, Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

export function LoginPage(): ReactElement {
  const { isAuthenticated, login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/orgs" replace />;
  }

  const handleLogin = (): void => {
    setIsLoading(true);
    login();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center">
        <img src="/codaholiq_logo.png" alt="Codaholiq" className="h-20 w-auto" />
        <p className="text-muted-foreground max-w-sm">
          AI-powered automations for your GitHub repositories
        </p>
        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Github className="h-5 w-5" />
          )}
          {isLoading ? 'Redirecting...' : 'Sign in with GitHub'}
        </button>
      </div>
    </div>
  );
}
