import { MembersTable } from '@/modules/organizations/components/members-table';
import { PermissionsTable } from '@/modules/permissions/components/permissions-table';
import { SharedVariablesTable } from '@/modules/variables/components/shared-variables-table';
import { PageHeader } from '@/common/components/page-header';
import { Skeleton } from '@/common/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/common/components/ui/tabs';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import { useMyPermissions } from '@/modules/permissions/hooks/use-my-permissions';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useOrgMembers } from '@/modules/organizations/hooks/use-org-members';
import { useRemoveMember } from '@/modules/organizations/hooks/use-remove-member';
import { useUpdateMemberRole } from '@/modules/organizations/hooks/use-update-member-role';
import { useSharedVariables } from '@/modules/variables/hooks/use-shared-variables';
import { useCreateSharedVariable } from '@/modules/variables/hooks/use-create-shared-variable';
import { useUpdateSharedVariable } from '@/modules/variables/hooks/use-update-shared-variable';
import { useDeleteSharedVariable } from '@/modules/variables/hooks/use-delete-shared-variable';
import { useRepos } from '@/modules/repositories/hooks/use-repos';
import { Permission } from '@/common/types';
import type { Role } from '@/modules/auth/types';
import type { ReactElement } from 'react';

export function OrgSettingsPage(): ReactElement {
  const { user } = useAuth();
  const { org } = useOrg();
  const orgId = org?.id ?? 0;

  const { hasPermission } = useHasPermission({ orgId });
  const { role } = useMyPermissions({ orgId });

  const { members, isLoading: isMembersLoading, isError, error } = useOrgMembers({ orgId });
  const updateRoleMutation = useUpdateMemberRole({ orgId });
  const removeMemberMutation = useRemoveMember({ orgId });

  const { variables, isLoading: isVariablesLoading } = useSharedVariables({ orgId });
  const createVariableMutation = useCreateSharedVariable({ orgId });
  const updateVariableMutation = useUpdateSharedVariable({ orgId });
  const deleteVariableMutation = useDeleteSharedVariable({ orgId });
  const { repos } = useRepos({ orgId });

  const canManageMembers = hasPermission(Permission.ORG_MEMBERS_MANAGE);
  const isOwner = role === 'owner';

  const handleRoleChange = (userId: number, newRole: Role): void => {
    updateRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveMember = (userId: number): void => {
    removeMemberMutation.mutate(userId);
  };

  const handleCreateVariable = (input: {
    key: string;
    value: string;
    description?: string;
    repoId?: number;
  }): void => {
    createVariableMutation.mutate(input);
  };

  const handleUpdateVariable = (
    variableId: number,
    input: { value?: string; description?: string | null },
  ): void => {
    updateVariableMutation.mutate({ variableId, data: input });
  };

  const handleDeleteVariable = (variableId: number): void => {
    deleteVariableMutation.mutate(variableId);
  };

  if (!org || !user) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <Tabs defaultValue="variables">
        <TabsList>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isOwner && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
        </TabsList>

        <TabsContent value="variables" className="mt-6">
          <SharedVariablesTable
            variables={variables}
            repos={repos}
            isLoading={isVariablesLoading}
            onCreate={handleCreateVariable}
            onUpdate={handleUpdateVariable}
            onDelete={handleDeleteVariable}
            isSubmitting={createVariableMutation.isPending || updateVariableMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          {isMembersLoading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {isError && (
            <p className="text-destructive text-sm">
              Failed to load members: {error?.message ?? 'Unknown error'}
            </p>
          )}

          {!isMembersLoading && !isError && (
            <MembersTable
              members={members}
              currentUserId={user.id}
              onRoleChange={handleRoleChange}
              onRemove={handleRemoveMember}
              canManageMembers={canManageMembers}
            />
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="permissions" className="mt-6">
            <PermissionsTable orgId={orgId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
