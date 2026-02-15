import { Button } from '@/common/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/common/components/ui/form';
import { Switch } from '@/common/components/ui/switch';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { useSupportedModels } from '@/modules/automations/hooks/use-supported-models';
import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';
import type { Control, UseFormWatch } from 'react-hook-form';

interface AutomationWorkflowStepProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
  readonly mode: 'create' | 'edit';
}

function ReviewSummary({
  watch,
}: Readonly<{
  watch: UseFormWatch<AutomationFormValues>;
}>): ReactElement {
  const { defaultModelName } = useSupportedModels();
  const name = watch('name');
  const repoId = watch('repoId');
  const triggerType = watch('triggerType');
  const triggerConfig = watch('triggerConfig');
  const promptTemplate = watch('promptTemplate');
  const model = watch('model');

  const triggerDetail = (): string => {
    switch (triggerType) {
      case 'event': {
        const events = 'events' in triggerConfig ? triggerConfig.events : [];
        return events.length > 0 ? events.join(', ') : 'No events selected';
      }
      case 'cron': {
        const schedule = 'schedule' in triggerConfig ? triggerConfig.schedule : '';
        return schedule || 'No schedule set';
      }
      case 'manual':
        return 'Triggered manually';
    }
  };

  const conditionSummary = (): string | null => {
    if (triggerType !== 'event') return null;
    const groups =
      'conditionGroups' in triggerConfig && Array.isArray(triggerConfig.conditionGroups)
        ? (triggerConfig.conditionGroups as Array<{ conditions: unknown[] }>)
        : [];
    if (groups.length === 0) return null;
    const totalConditions = groups.reduce((sum, g) => sum + g.conditions.length, 0);
    if (totalConditions === 0) return null;
    return `${totalConditions} condition${totalConditions !== 1 ? 's' : ''} in ${groups.length} group${groups.length !== 1 ? 's' : ''}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground font-medium">Name</dt>
          <dd>{name || '-'}</dd>

          <dt className="text-muted-foreground font-medium">Repository ID</dt>
          <dd>{repoId || '-'}</dd>

          <dt className="text-muted-foreground font-medium">Trigger Type</dt>
          <dd className="capitalize">{triggerType}</dd>

          <dt className="text-muted-foreground font-medium">
            {triggerType === 'event' ? 'Events' : triggerType === 'cron' ? 'Schedule' : 'Trigger'}
          </dt>
          <dd className="break-all">{triggerDetail()}</dd>

          {(() => {
            const summary = conditionSummary();
            return summary ? (
              <>
                <dt className="text-muted-foreground font-medium">Conditions</dt>
                <dd>{summary}</dd>
              </>
            ) : null;
          })()}

          <dt className="text-muted-foreground font-medium">Model</dt>
          <dd>{model ?? defaultModelName}</dd>

          <dt className="text-muted-foreground font-medium">Prompt Length</dt>
          <dd>{promptTemplate.length} characters</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

export function AutomationWorkflowStep({
  control,
  watch,
  isSubmitting,
  onSubmit,
  mode,
}: AutomationWorkflowStepProps): ReactElement {
  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="enabled"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-md border p-4">
            <div>
              <FormLabel>Enabled</FormLabel>
              <FormDescription>Enable this automation immediately after creation.</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <ReviewSummary watch={watch} />

      <Button type="button" className="w-full" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {mode === 'create' ? 'Create Automation' : 'Save Changes'}
      </Button>
    </div>
  );
}
