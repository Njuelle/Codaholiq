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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import { SharedVariableDialog } from './shared-variable-dialog';
import type { Repository } from '@/modules/repositories/types';
import type { SharedVariable } from '@/modules/variables/types';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';

function truncateValue(value: string, maxLength = 50): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

interface SharedVariablesTableProps {
  readonly variables: readonly SharedVariable[];
  readonly repos: readonly Repository[];
  readonly isLoading: boolean;
  readonly onCreate: (input: {
    key: string;
    value: string;
    description?: string;
    repoId?: number;
  }) => void;
  readonly onUpdate: (
    variableId: number,
    input: { value?: string; description?: string | null },
  ) => void;
  readonly onDelete: (variableId: number) => void;
  readonly isSubmitting: boolean;
}

export function SharedVariablesTable({
  variables,
  repos,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isSubmitting,
}: SharedVariablesTableProps): ReactElement {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<SharedVariable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SharedVariable | null>(null);

  const getRepoName = useCallback(
    (repoId: number | null): string => {
      if (repoId === null) return 'Organization';
      const repo = repos.find((r) => r.id === repoId);
      return repo?.fullName ?? `Repo #${repoId}`;
    },
    [repos],
  );

  const handleOpenCreate = useCallback((): void => {
    setEditingVariable(null);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((variable: SharedVariable): void => {
    setEditingVariable(variable);
    setDialogOpen(true);
  }, []);

  const handleDialogSubmit = useCallback(
    (values: { key: string; value: string; description?: string; repoId?: number }): void => {
      if (editingVariable) {
        onUpdate(editingVariable.id, {
          value: values.value,
          description: values.description ?? null,
        });
      } else {
        onCreate(values);
      }
      setDialogOpen(false);
    },
    [editingVariable, onCreate, onUpdate],
  );

  const handleDeleteConfirm = useCallback((): void => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, onDelete]);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-muted-foreground text-sm">
          Shared variables are available in all automation prompts. Repo-scoped variables only
          appear when the matching repo is selected.
        </p>
        <Button onClick={handleOpenCreate} size="sm">
          <Plus className="size-4 mr-1" />
          Add Variable
        </Button>
      </div>

      {isLoading && (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading variables...</p>
      )}

      {!isLoading && variables.length === 0 && (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No shared variables yet. Add one to get started.
        </p>
      )}

      {!isLoading && variables.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((variable) => (
              <TableRow key={variable.id}>
                <TableCell className="font-mono font-medium">{variable.key}</TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {truncateValue(variable.value)}
                </TableCell>
                <TableCell>
                  <Badge variant={variable.repoId === null ? 'secondary' : 'outline'}>
                    {getRepoName(variable.repoId)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {variable.description ?? '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => handleOpenEdit(variable)}
                      aria-label={`Edit ${variable.key}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setDeleteTarget(variable)}
                      aria-label={`Delete ${variable.key}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SharedVariableDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        variable={editingVariable}
        repos={repos}
        onSubmit={handleDialogSubmit}
        isSubmitting={isSubmitting}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the variable &quot;{deleteTarget?.key}
              &quot;. Automations using this variable will no longer resolve its value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
