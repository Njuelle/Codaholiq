import { useParams, Navigate } from 'react-router-dom';
import { useEffect, type ReactElement } from 'react';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { LoadingScreen } from './loading-screen';
import { AppShell } from './layout/app-shell';

export function OrgRoute(): ReactElement {
  const { orgId } = useParams<{ orgId: string }>();
  const { orgs, switchOrg, isLoading } = useOrg();

  const numericOrgId = Number(orgId);
  const orgExists = orgs.some((o) => o.id === numericOrgId);

  useEffect(() => {
    if (orgExists) {
      switchOrg(numericOrgId);
    }
  }, [numericOrgId, orgExists, switchOrg]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!orgExists) {
    return <Navigate to="/forbidden" replace />;
  }

  return <AppShell />;
}
