import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type ReactElement,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import type { Organization } from '@/modules/organizations/types';

interface OrgContextValue {
  readonly org: Organization | null;
  readonly orgs: readonly Organization[];
  readonly isLoading: boolean;
  readonly switchOrg: (orgId: number) => void;
}

const OrgContext = createContext<OrgContextValue | null>(null);

interface OrgProviderProps {
  readonly children: ReactNode;
  readonly initialOrg?: Organization | null;
}

function getStoredOrgId(): number | null {
  const stored = localStorage.getItem('lastOrgId');
  return stored ? Number(stored) : null;
}

export function OrgProvider({ children, initialOrg = null }: OrgProviderProps): ReactElement {
  const { isAuthenticated } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    initialOrg?.id ?? getStoredOrgId(),
  );

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: queryKeys.orgs.all(),
    queryFn: () => apiGet<Organization[]>('/orgs'),
    enabled: isAuthenticated && initialOrg === null,
  });

  // Derive current org: try selectedOrgId, fall back to stored, then first org
  const org = useMemo(() => {
    if (initialOrg) return initialOrg;
    if (orgs.length === 0) return null;

    const selected = orgs.find((o) => o.id === selectedOrgId);
    if (selected) return selected;

    const storedId = getStoredOrgId();
    const stored = storedId ? orgs.find((o) => o.id === storedId) : undefined;
    if (stored) return stored;

    return orgs[0] ?? null;
  }, [initialOrg, orgs, selectedOrgId]);

  const switchOrg = useCallback((orgId: number): void => {
    setSelectedOrgId(orgId);
    localStorage.setItem('lastOrgId', String(orgId));
  }, []);

  const value = useMemo(
    () => ({ org, orgs, isLoading, switchOrg }),
    [org, orgs, isLoading, switchOrg],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
