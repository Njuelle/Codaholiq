import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { queryKeys } from '@/common/lib/query-keys';
import type { OrgMember } from '@/common/types';

interface UseOrgMembersParams {
  readonly orgId: number;
}

interface UseOrgMembersReturn {
  readonly members: readonly OrgMember[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

export function useOrgMembers({ orgId }: UseOrgMembersParams): UseOrgMembersReturn {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.orgs.members(orgId),
    queryFn: () => apiGet<OrgMember[]>(`/orgs/${orgId}/members`),
    enabled: orgId > 0,
  });

  return {
    members: data ?? [],
    isLoading,
    isError,
    error,
  };
}
