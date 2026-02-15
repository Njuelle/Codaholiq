import { useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import type { ReactElement } from 'react';

export function NotFoundPage(): ReactElement {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <button
        type="button"
        onClick={() => {
          void navigate(-1);
        }}
        className="text-sm text-primary underline hover:no-underline"
      >
        Go back
      </button>
    </div>
  );
}
