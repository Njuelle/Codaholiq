import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingScreen(): ReactElement {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
