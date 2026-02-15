import { AutomationBasicsStep } from '@/modules/automations/components/form/automation-basics-step';
import { AutomationPromptStep } from '@/modules/automations/components/form/automation-prompt-step';
import { AutomationTriggerStep } from '@/modules/automations/components/form/automation-trigger-step';
import { AutomationWorkflowStep } from '@/modules/automations/components/form/automation-workflow-step';
import { ConfirmDialog } from '@/common/components/confirm-dialog';
import { PageHeader } from '@/common/components/page-header';
import { Button } from '@/common/components/ui/button';
import { Form } from '@/common/components/ui/form';
import { Skeleton } from '@/common/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/common/components/ui/tabs';
import { useAutomationDetail } from '@/modules/automations/hooks/use-automation-detail';
import { useUpdateAutomation } from '@/modules/automations/hooks/use-update-automation';
import {
  automationFormSchema,
  type AutomationFormValues,
} from '@/modules/automations/lib/automation-schemas';
import type {
  AutomationWithVariables,
  CronTriggerConfig,
  EventTriggerConfig,
} from '@/common/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useCallback, type ReactElement } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';

function automationToFormValues(automation: AutomationWithVariables): AutomationFormValues {
  const { triggerType, triggerConfig } = automation;

  const base = {
    name: automation.name,
    description: automation.description,
    repoId: automation.repoId,
    promptTemplate: automation.promptTemplate,
    model: automation.model,
    enabled: automation.enabled,
    variables: [] as {
      key: string;
      value: string;
      source: 'static' | 'event_payload';
      required: boolean;
    }[],
  };

  switch (triggerType) {
    case 'event': {
      const eventConfig = triggerConfig as EventTriggerConfig;
      return {
        ...base,
        triggerType: 'event',
        triggerConfig: {
          events: [...eventConfig.events],
          conditionGroups: eventConfig.conditionGroups
            ? eventConfig.conditionGroups.map((g) => ({
                conditions: g.conditions.map((c) => ({ ...c })),
              }))
            : [],
        },
      };
    }
    case 'cron': {
      const cronConfig = triggerConfig as CronTriggerConfig;
      return {
        ...base,
        triggerType: 'cron',
        triggerConfig: {
          schedule: cronConfig.schedule,
          timezone: cronConfig.timezone,
        },
      };
    }
    case 'manual':
      return {
        ...base,
        triggerType: 'manual',
        triggerConfig: {},
      };
  }
}

function EditFormSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-1/3" />
    </div>
  );
}

/**
 * Inner form component — only mounted once automation data is available.
 * This ensures `useForm` receives real data as `defaultValues` from the start,
 * avoiding the stale-default-then-reset cycle that breaks controlled components.
 */
interface AutomationEditFormProps {
  readonly automation: AutomationWithVariables;
  readonly orgId: number;
  readonly automationId: number;
}

function AutomationEditForm({
  automation,
  orgId,
  automationId,
}: AutomationEditFormProps): ReactElement {
  const navigate = useNavigate();
  const updateMutation = useUpdateAutomation({ orgId, automationId });

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(
      automationFormSchema as unknown as Parameters<typeof zodResolver>[0],
    ) as unknown as Resolver<AutomationFormValues>,
    defaultValues: automationToFormValues(automation),
  });

  const { isDirty, isSubmitting } = form.formState;
  const blocker = useBlocker(isDirty && !isSubmitting && !updateMutation.isPending);

  const handleSubmit = useCallback(
    (values: AutomationFormValues): void => {
      updateMutation.mutate(values, {
        onSuccess: () => {
          form.reset(values);
          void navigate(`/orgs/${orgId}/automations/${automationId}`);
        },
      });
    },
    [updateMutation, form, navigate, orgId, automationId],
  );

  return (
    <>
      <Form {...form}>
        <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} className="space-y-6">
          <Tabs defaultValue="basics">
            <TabsList>
              <TabsTrigger value="basics">Basics</TabsTrigger>
              <TabsTrigger value="trigger">Trigger</TabsTrigger>
              <TabsTrigger value="prompt">Prompt</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="mt-6 flex-none">
              <AutomationBasicsStep
                control={form.control}
                watch={form.watch}
                setValue={form.setValue}
                orgId={orgId}
              />
            </TabsContent>

            <TabsContent value="trigger" className="mt-6 flex-none">
              <AutomationTriggerStep
                control={form.control}
                watch={form.watch}
                setValue={form.setValue}
              />
            </TabsContent>

            <TabsContent value="prompt" className="mt-6 flex-none">
              <AutomationPromptStep control={form.control} watch={form.watch} />
            </TabsContent>

            <TabsContent value="workflow" className="mt-6 flex-none">
              <AutomationWorkflowStep
                control={form.control}
                watch={form.watch}
                isSubmitting={isSubmitting}
                onSubmit={() => void form.handleSubmit(handleSubmit)()}
                mode="edit"
              />
            </TabsContent>
          </Tabs>
        </form>
      </Form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') {
            blocker.reset();
          }
        }}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave this page? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          if (blocker.state === 'blocked') {
            blocker.proceed();
          }
        }}
      />
    </>
  );
}

export function AutomationEditPage(): ReactElement {
  const { orgId: orgIdParam, automationId: automationIdParam } = useParams<{
    orgId: string;
    automationId: string;
  }>();

  const orgId = Number(orgIdParam);
  const automationId = Number(automationIdParam);

  const { automation, isLoading, isError, error } = useAutomationDetail({
    orgId,
    automationId,
  });

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Automation" />
        <p className="text-destructive text-sm">
          Failed to load automation: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  const detailPath = `/orgs/${orgId}/automations/${automationId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Automation"
        description={automation?.name}
        actions={
          <Button variant="outline" asChild>
            <Link to={detailPath}>
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      {isLoading && <EditFormSkeleton />}

      {!isLoading && automation && (
        <AutomationEditForm
          key={automationId}
          automation={automation}
          orgId={orgId}
          automationId={automationId}
        />
      )}
    </div>
  );
}
