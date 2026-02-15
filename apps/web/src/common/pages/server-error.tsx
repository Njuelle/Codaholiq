import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';

export function ServerErrorPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">An unexpected error occurred. Please try again later.</p>
      <button
        type="button"
        onClick={() => {
          void navigate('/');
        }}
        className="text-sm text-primary underline hover:no-underline"
      >
        Go home
      </button>
    </div>
  );
}
