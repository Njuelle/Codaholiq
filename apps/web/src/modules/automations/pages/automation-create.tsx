import { AutomationBasicsStep } from '@/modules/automations/components/form/automation-basics-step';
import { AutomationPromptStep } from '@/modules/automations/components/form/automation-prompt-step';
import { AutomationTriggerStep } from '@/modules/automations/components/form/automation-trigger-step';
import { AutomationWorkflowStep } from '@/modules/automations/components/form/automation-workflow-step';
import { Form } from '@/common/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/common/components/ui/tabs';
import { useCreateAutomation } from '@/modules/automations/hooks/use-create-automation';
import {
  automationFormSchema,
  DEFAULT_FORM_VALUES,
  type AutomationFormValues,
} from '@/modules/automations/lib/automation-schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';

type StepTab = 'basics' | 'trigger' | 'prompt' | 'review';

const STEP_ORDER: readonly StepTab[] = ['basics', 'trigger', 'prompt', 'review'];

const STEP_FIELDS: Readonly<Record<StepTab, ReadonlyArray<string>>> = {
  basics: ['name', 'repoId'],
  trigger: ['triggerType', 'triggerConfig'],
  prompt: ['promptTemplate'],
  review: [],
};

export function AutomationCreatePage(): ReactElement {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  const orgId = Number(orgIdParam);

  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const createAutomation = useCreateAutomation({ orgId });
  const [activeTab, setActiveTab] = useState<StepTab>('basics');

  const handleTabChange = useCallback(
    async (newTab: string): Promise<void> => {
      const currentIndex = STEP_ORDER.indexOf(activeTab);
      const newIndex = STEP_ORDER.indexOf(newTab as StepTab);

      // Only validate when moving forward
      if (newIndex > currentIndex) {
        const fieldsToValidate = STEP_FIELDS[activeTab];
        if (fieldsToValidate.length > 0) {
          const isValid = await form.trigger(fieldsToValidate as Array<keyof AutomationFormValues>);
          if (!isValid) return;
        }
      }

      setActiveTab(newTab as StepTab);
    },
    [activeTab, form],
  );

  const handleSubmit = useCallback((): void => {
    void form.handleSubmit((data) => createAutomation.mutateAsync(data))();
  }, [form, createAutomation]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Automation</h1>
        <p className="text-muted-foreground mt-1">
          Configure a new automation for your repository.
        </p>
      </div>

      <Form {...form}>
        <Tabs value={activeTab} onValueChange={(v) => void handleTabChange(v)}>
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="trigger">Trigger</TabsTrigger>
            <TabsTrigger value="prompt">Prompt</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
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
            <AutomationPromptStep
              control={form.control}
              watch={form.watch}
              setValue={form.setValue}
            />
          </TabsContent>

          <TabsContent value="review" className="mt-6 flex-none">
            <AutomationWorkflowStep
              control={form.control}
              watch={form.watch}
              isSubmitting={createAutomation.isPending}
              onSubmit={handleSubmit}
              mode="create"
            />
          </TabsContent>
        </Tabs>
      </Form>
    </div>
  );
}
