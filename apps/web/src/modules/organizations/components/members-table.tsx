import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/common/components/ui/alert-dialog';
import { Badge } from '@/common/components/ui/badge';
import { Button } from '@/common/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { formatShortDate } from '@/common/lib/format';
import type { Role } from '@/modules/auth/types';
import type { OrgMember } from '@/modules/organizations/types';
import { Trash2 } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';

interface MembersTableProps {
  readonly members: readonly OrgMember[];
  readonly currentUserId: number;
  readonly onRoleChange: (userId: number, role: Role) => void;
  readonly onRemove: (userId: number) => void;
  readonly canManageMembers?: boolean;
}

export function MembersTable({
  members,
  currentUserId,
  onRoleChange,
  onRemove,
  canManageMembers = true,
}: MembersTableProps): ReactElement {
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null);

  const handleRoleChange = useCallback(
    (userId: number, role: string): void => {
      onRoleChange(userId, role as Role);
    },
    [onRoleChange],
  );

  const handleRemoveConfirm = useCallback((): void => {
    if (!removeTarget) return;
    onRemove(removeTarget.userId);
    setRemoveTarget(null);
  }, [removeTarget, onRemove]);

  const isOwner = (member: OrgMember): boolean => member.role === 'owner';
  const isSelf = (member: OrgMember): boolean => member.userId === currentUserId;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            {canManageMembers && (
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.userId}>
              <TableCell className="font-medium">{member.username}</TableCell>
              <TableCell>
                {isOwner(member) || !canManageMembers ? (
                  <Badge variant="secondary">
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Badge>
                ) : (
                  <Select
                    value={member.role}
                    onValueChange={(value: string) => handleRoleChange(member.userId, value)}
                  >
                    <SelectTrigger className="w-28" aria-label={`Role for ${member.username}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatShortDate(member.joinedAt)}
              </TableCell>
              {canManageMembers && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={isOwner(member) || isSelf(member)}
                    onClick={() => setRemoveTarget(member)}
                    aria-label={`Remove ${member.username}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {removeTarget?.username} from the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
