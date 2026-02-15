import { useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { LoadingScreen } from '@/common/components/loading-screen';

export function OrgSelectorPage(): ReactElement {
  const { org, orgs, isLoading } = useOrg();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // If only one org, auto-redirect
    if (orgs.length === 1 && orgs[0]) {
      void navigate(`/orgs/${orgs[0].id}/dashboard`, { replace: true });
      return;
    }

    // If user previously selected an org (stored in localStorage), redirect
    if (org && localStorage.getItem('lastOrgId')) {
      void navigate(`/orgs/${org.id}/dashboard`, { replace: true });
    }
  }, [org, orgs, isLoading, navigate]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold">Select an Organization</h1>
        {orgs.length === 0 ? (
          <p className="text-muted-foreground text-center max-w-sm">
            You are not a member of any organization yet. Ask an organization owner to invite you,
            or create a new organization.
          </p>
        ) : (
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  void navigate(`/orgs/${o.id}/dashboard`);
                }}
                className="flex items-center gap-3 rounded-md border p-4 text-left hover:bg-accent transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                  {o.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-sm text-muted-foreground">{o.slug}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
