import { AutomationFilters } from '@/modules/automations/components/automation-filters';
import { AutomationTable } from '@/modules/automations/components/automation-table';
import { ConfirmDialog } from '@/common/components/confirm-dialog';
import { EmptyState } from '@/common/components/empty-state';
import { PageHeader } from '@/common/components/page-header';
import { Button } from '@/common/components/ui/button';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useAutomations } from '@/modules/automations/hooks/use-automations';
import { useDeleteAutomation } from '@/modules/automations/hooks/use-delete-automation';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useToggleAutomation } from '@/modules/automations/hooks/use-toggle-automation';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import { Permission, type TriggerType } from '@/common/types';
import { Bot, Plus } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

export function AutomationsListPage(): ReactElement {
  const { org } = useOrg();
  const navigate = useNavigate();

  const [triggerType, setTriggerType] = useState<TriggerType | undefined>();
  const [enabled, setEnabled] = useState<boolean | undefined>();
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const orgId = org?.id ?? 0;
  const { hasPermission } = useHasPermission({ orgId });

  const { automations, isLoading, isError, error } = useAutomations({
    orgId,
    filters: {
      triggerType,
      enabled,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
  });

  const toggleMutation = useToggleAutomation({ orgId });
  const deleteMutation = useDeleteAutomation({ orgId });

  const handleTriggerTypeChange = useCallback((value: TriggerType | undefined): void => {
    setTriggerType(value);
    setPage(0);
  }, []);

  const handleEnabledChange = useCallback((value: boolean | undefined): void => {
    setEnabled(value);
    setPage(0);
  }, []);

  const handleToggleEnabled = useCallback(
    (params: { readonly automationId: number; readonly enabled: boolean }): void => {
      toggleMutation.mutate(params);
    },
    [toggleMutation],
  );

  const handleDeleteConfirm = useCallback((): void => {
    if (deleteTarget === null) return;
    deleteMutation.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const handlePreviousPage = useCallback((): void => {
    setPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback((): void => {
    setPage((prev) => prev + 1);
  }, []);

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Automations" description="Manage your GitHub automations." />
        <p className="text-destructive text-sm">
          Failed to load automations: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  const isEmpty = !isLoading && automations.length === 0 && page === 0;
  const hasNextPage = automations.length === PAGE_SIZE;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="Manage your GitHub automations."
        actions={
          hasPermission(Permission.AUTOMATIONS_CREATE) ? (
            <Button asChild>
              <Link to="new">
                <Plus className="size-4" />
                New Automation
              </Link>
            </Button>
          ) : undefined
        }
      />

      <AutomationFilters
        triggerType={triggerType}
        enabled={enabled}
        onTriggerTypeChange={handleTriggerTypeChange}
        onEnabledChange={handleEnabledChange}
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={Bot}
          title="No automations yet"
          description="Create your first automation to start running Claude Code on your repositories."
          action={{
            label: 'New Automation',
            onClick: () => void navigate('new'),
          }}
        />
      )}

      {!isLoading && automations.length > 0 && (
        <>
          <AutomationTable
            automations={automations}
            onToggleEnabled={handleToggleEnabled}
            onDelete={setDeleteTarget}
            canToggle={hasPermission(Permission.AUTOMATIONS_TOGGLE)}
            canEdit={hasPermission(Permission.AUTOMATIONS_EDIT)}
            canDelete={hasPermission(Permission.AUTOMATIONS_DELETE)}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={page === 0}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage}>
              Next
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Automation"
        description="Are you sure you want to delete this automation? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
