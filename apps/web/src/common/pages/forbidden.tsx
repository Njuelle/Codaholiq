import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import type { ReactElement } from 'react';

export function ForbiddenPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <ShieldX className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Access denied</h1>
      <p className="text-muted-foreground">
        You don&apos;t have permission to access this resource.
      </p>
      <button
        type="button"
        onClick={() => {
          void navigate('/orgs');
        }}
        className="text-sm text-primary underline hover:no-underline"
      >
        Go to organizations
      </button>
    </div>
  );
}
