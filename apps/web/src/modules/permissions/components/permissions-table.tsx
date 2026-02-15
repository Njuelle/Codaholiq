import { Button } from '@/common/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/common/components/ui/card';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useRolePermissions } from '@/modules/permissions/hooks/use-role-permissions';
import { useUpdateRolePermissions } from '@/modules/permissions/hooks/use-update-role-permissions';
import { Permission } from '@/common/types';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';

interface PermissionsTableProps {
  readonly orgId: number;
}

interface PermissionGroup {
  readonly label: string;
  readonly permissions: readonly { value: Permission; label: string }[];
}

const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    label: 'Automations',
    permissions: [
      { value: Permission.AUTOMATIONS_VIEW, label: 'View' },
      { value: Permission.AUTOMATIONS_CREATE, label: 'Create' },
      { value: Permission.AUTOMATIONS_EDIT, label: 'Edit' },
      { value: Permission.AUTOMATIONS_DELETE, label: 'Delete' },
      { value: Permission.AUTOMATIONS_TOGGLE, label: 'Toggle' },
    ],
  },
  {
    label: 'Executions',
    permissions: [
      { value: Permission.EXECUTIONS_VIEW, label: 'View' },
      { value: Permission.EXECUTIONS_RETRY, label: 'Retry / Cancel' },
    ],
  },
  {
    label: 'Organization',
    permissions: [
      { value: Permission.ORG_SETTINGS_VIEW, label: 'View settings' },
      { value: Permission.ORG_SETTINGS_EDIT, label: 'Edit settings' },
      { value: Permission.ORG_MEMBERS_VIEW, label: 'View members' },
      { value: Permission.ORG_MEMBERS_MANAGE, label: 'Manage members' },
    ],
  },
  {
    label: 'Notifications',
    permissions: [
      { value: Permission.NOTIFICATIONS_VIEW, label: 'View' },
      { value: Permission.NOTIFICATIONS_DISMISS, label: 'Dismiss' },
    ],
  },
];

export function PermissionsTable({ orgId }: PermissionsTableProps): ReactElement {
  const { rolePermissions, isLoading } = useRolePermissions({ orgId });
  const updateMutation = useUpdateRolePermissions({ orgId });

  const [localAdminPerms, setLocalAdminPerms] = useState<Set<Permission> | null>(null);
  const [localMemberPerms, setLocalMemberPerms] = useState<Set<Permission> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const adminPerms = useMemo(
    () => localAdminPerms ?? new Set(rolePermissions?.admin ?? []),
    [localAdminPerms, rolePermissions],
  );
  const memberPerms = useMemo(
    () => localMemberPerms ?? new Set(rolePermissions?.member ?? []),
    [localMemberPerms, rolePermissions],
  );
  const isDirty = localAdminPerms !== null || localMemberPerms !== null;

  const handleToggle = useCallback(
    (role: 'admin' | 'member', permission: Permission, checked: boolean): void => {
      const current = role === 'admin' ? adminPerms : memberPerms;
      const setter = role === 'admin' ? setLocalAdminPerms : setLocalMemberPerms;
      const next = new Set(current);
      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }
      setter(next);
    },
    [adminPerms, memberPerms],
  );

  const handleSave = useCallback((): void => {
    async function saveAll(): Promise<void> {
      setIsSaving(true);
      setSaveError(null);
      try {
        await updateMutation.mutateAsync({ role: 'admin', permissions: [...adminPerms] });
        await updateMutation.mutateAsync({ role: 'member', permissions: [...memberPerms] });
        setLocalAdminPerms(null);
        setLocalMemberPerms(null);
      } catch {
        setSaveError('Failed to save permissions. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
    void saveAll();
  }, [adminPerms, memberPerms, updateMutation]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Permissions</CardTitle>
        <CardDescription>
          Customize what each role can do. Owner always has all permissions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-4 text-left font-medium">Permission</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Owner</th>
                <th className="px-4 py-3 text-center font-medium">Admin</th>
                <th className="px-4 py-3 text-center font-medium">Member</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <GroupRows
                  key={group.label}
                  group={group}
                  adminPerms={adminPerms}
                  memberPerms={memberPerms}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        </div>

        {saveError && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {saveError}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save Permissions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRows({
  group,
  adminPerms,
  memberPerms,
  onToggle,
}: {
  readonly group: PermissionGroup;
  readonly adminPerms: ReadonlySet<Permission>;
  readonly memberPerms: ReadonlySet<Permission>;
  readonly onToggle: (role: 'admin' | 'member', permission: Permission, checked: boolean) => void;
}): ReactElement {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {group.label}
        </td>
      </tr>
      {group.permissions.map((perm) => (
        <tr key={perm.value} className="border-b last:border-0">
          <td className="py-2 pr-4">{perm.label}</td>
          <td className="px-4 py-2 text-center">
            <Checkbox checked disabled aria-label={`Owner: ${group.label} ${perm.label}`} />
          </td>
          <td className="px-4 py-2 text-center">
            <Checkbox
              checked={adminPerms.has(perm.value)}
              onCheckedChange={(checked: boolean) => onToggle('admin', perm.value, checked)}
              aria-label={`Admin: ${group.label} ${perm.label}`}
            />
          </td>
          <td className="px-4 py-2 text-center">
            <Checkbox
              checked={memberPerms.has(perm.value)}
              onCheckedChange={(checked: boolean) => onToggle('member', perm.value, checked)}
              aria-label={`Member: ${group.label} ${perm.label}`}
            />
          </td>
        </tr>
      ))}
    </>
  );
}
