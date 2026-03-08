import { AutomationInfoCard } from '@/modules/automations/components/automation-info-card';
import { DeleteAutomationDialog } from '@/modules/automations/components/delete-automation-dialog';
import { PromptTemplateCard } from '@/modules/automations/components/prompt-template-card';
import { RecentExecutionsCard } from '@/modules/automations/components/recent-executions-card';
import { TriggerAutomationDialog } from '@/modules/automations/components/trigger-automation-dialog';

import { ConfirmDialog } from '@/common/components/confirm-dialog';
import { PageHeader } from '@/common/components/page-header';
import { Button } from '@/common/components/ui/button';
import { Skeleton } from '@/common/components/ui/skeleton';
import { Switch } from '@/common/components/ui/switch';
import { useAutomationDetail } from '@/modules/automations/hooks/use-automation-detail';
import { useDeleteAutomation } from '@/modules/automations/hooks/use-delete-automation';
import { useToggleAutomation } from '@/modules/automations/hooks/use-toggle-automation';
import { useTriggerAutomation } from '@/modules/automations/hooks/use-trigger-automation';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import { Permission } from '@/common/types';
import { AlertTriangle, Pencil, Play, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

function LoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-10" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

export function AutomationDetailPage(): ReactElement {
  const { orgId: orgIdParam, automationId: automationIdParam } = useParams();
  const navigate = useNavigate();

  const orgId = Number(orgIdParam);
  const automationId = Number(automationIdParam);

  const { automation, isLoading, isError, error } = useAutomationDetail({
    orgId,
    automationId,
  });

  const toggleMutation = useToggleAutomation({ orgId });
  const deleteMutation = useDeleteAutomation({ orgId });
  const triggerMutation = useTriggerAutomation({ orgId, automationId });
  const { hasPermission } = useHasPermission({ orgId });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTriggerDialogOpen, setIsTriggerDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive text-sm">{error?.message ?? 'Failed to load automation'}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void navigate(`/orgs/${orgId}/automations`)}
        >
          Back to Automations
        </Button>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Automation not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => void navigate(`/orgs/${orgId}/automations`)}
        >
          Back to Automations
        </Button>
      </div>
    );
  }

  const handleToggle = (): void => {
    if (automation.enabled) {
      setIsDisableDialogOpen(true);
      return;
    }
    toggleMutation.mutate({ automationId, enabled: true });
  };

  const handleConfirmDisable = (): void => {
    toggleMutation.mutate({ automationId, enabled: false });
    setIsDisableDialogOpen(false);
  };

  const handleDelete = (): void => {
    deleteMutation.mutate(automationId);
  };

  const handleTrigger = (): void => {
    triggerMutation.mutate(undefined);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={automation.name}
        description={automation.description ?? undefined}
        actions={
          <>
            {hasPermission(Permission.AUTOMATIONS_EDIT) && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/orgs/${orgId}/automations/${automationId}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              </Button>
            )}

            {hasPermission(Permission.AUTOMATIONS_TOGGLE) && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={automation.enabled}
                  onCheckedChange={handleToggle}
                  aria-label={automation.enabled ? 'Disable automation' : 'Enable automation'}
                />
                <span className="text-sm text-muted-foreground">
                  {automation.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            )}

            {hasPermission(Permission.AUTOMATIONS_EDIT) && (
              <Button variant="outline" size="sm" onClick={() => setIsTriggerDialogOpen(true)}>
                <Play className="size-4" />
                Trigger
              </Button>
            )}

            {hasPermission(Permission.AUTOMATIONS_DELETE) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </>
        }
      />

      {automation.costLimitStatus?.isCostLimitExceeded && (
        <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-5 shrink-0" />
          <p>
            This automation has exceeded its monthly cost limit of $
            {((automation.monthlyCostLimitMicros ?? 0) / 1_000_000).toFixed(2)} and will not
            dispatch new executions until next month.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <AutomationInfoCard automation={automation} />
        <PromptTemplateCard promptTemplate={automation.promptTemplate} />
        <RecentExecutionsCard orgId={orgId} automationId={automationId} />
      </div>

      <DeleteAutomationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        automationName={automation.name}
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />

      <TriggerAutomationDialog
        open={isTriggerDialogOpen}
        onOpenChange={setIsTriggerDialogOpen}
        automationName={automation.name}
        automationOrgId={automation.orgId}
        onTrigger={handleTrigger}
        isPending={triggerMutation.isPending}
        result={triggerMutation.data}
      />

      <ConfirmDialog
        open={isDisableDialogOpen}
        onOpenChange={setIsDisableDialogOpen}
        title="Disable Automation"
        description={`Are you sure you want to disable "${automation.name}"? It will no longer respond to triggers until re-enabled.`}
        confirmLabel="Disable"
        variant="destructive"
        onConfirm={handleConfirmDisable}
      />
    </div>
  );
}
