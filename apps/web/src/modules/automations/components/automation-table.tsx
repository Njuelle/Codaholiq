import { TriggerBadge } from '@/common/components/trigger-badge';
import { Button } from '@/common/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/common/components/ui/dropdown-menu';
import { Switch } from '@/common/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { formatShortDate } from '@/common/lib/format';
import type { Automation } from '@/common/types';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

interface AutomationTableProps {
  readonly automations: readonly Automation[];
  readonly onToggleEnabled: (params: {
    readonly automationId: number;
    readonly enabled: boolean;
  }) => void;
  readonly onDelete: (automationId: number) => void;
  readonly canToggle?: boolean;
  readonly canEdit?: boolean;
  readonly canDelete?: boolean;
}

export function AutomationTable({
  automations,
  onToggleEnabled,
  onDelete,
  canToggle = true,
  canEdit = true,
  canDelete = true,
}: AutomationTableProps): ReactElement {
  const navigate = useNavigate();

  const handleRowClick = (automation: Automation): void => {
    void navigate(String(automation.id));
  };

  const handleToggle = (e: React.MouseEvent, automation: Automation): void => {
    e.stopPropagation();
    onToggleEnabled({
      automationId: automation.id,
      enabled: !automation.enabled,
    });
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {automations.map((automation) => (
          <TableRow
            key={automation.id}
            className="cursor-pointer"
            onClick={() => handleRowClick(automation)}
          >
            <TableCell className="font-medium">
              <div>
                <span>{automation.name}</span>
                {automation.description && (
                  <p className="text-muted-foreground text-xs mt-0.5 truncate max-w-xs">
                    {automation.description}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <TriggerBadge triggerType={automation.triggerType} />
            </TableCell>
            <TableCell>
              <Switch
                checked={automation.enabled}
                onClick={(e: React.MouseEvent) => handleToggle(e, automation)}
                disabled={!canToggle}
                aria-label={`Toggle ${automation.name}`}
              />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatShortDate(automation.createdAt)}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      void navigate(String(automation.id));
                    }}
                  >
                    <Eye className="size-4" />
                    View
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        void navigate(`${automation.id}/edit`);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onDelete(automation.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
