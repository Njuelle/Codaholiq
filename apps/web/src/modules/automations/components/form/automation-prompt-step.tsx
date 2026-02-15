import { PromptEditor, type PromptEditorRef } from '@/common/components/prompt-editor';
import { Button } from '@/common/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/ui/form';
import { Label } from '@/common/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { useGitHubEvents } from '@/modules/automations/hooks/use-github-events';
import { useSupportedModels } from '@/modules/automations/hooks/use-supported-models';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useSharedVariables } from '@/modules/variables/hooks/use-shared-variables';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { getAvailableVariables } from '@/modules/variables/lib/variable-catalog';
import { useCallback, useMemo, useRef, type ReactElement } from 'react';
import type { Control, UseFormWatch } from 'react-hook-form';

const DEFAULT_MODEL_SENTINEL = '__default__';

interface AutomationPromptStepProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
}

export function AutomationPromptStep({ control, watch }: AutomationPromptStepProps): ReactElement {
  const editorRef = useRef<PromptEditorRef>(null);
  const { events: allEvents } = useGitHubEvents();
  const { models, defaultModelName } = useSupportedModels();
  const { org } = useOrg();
  const orgId = org?.id ?? 0;
  const { variables: allSharedVariables } = useSharedVariables({ orgId });

  const triggerType = watch('triggerType');
  const triggerConfig = watch('triggerConfig');
  const repoId = watch('repoId');

  const selectedEvents = useMemo((): readonly string[] => {
    if (triggerType === 'event' && 'events' in triggerConfig) {
      return triggerConfig.events;
    }
    return [];
  }, [triggerType, triggerConfig]);

  const applicableSharedVariables = useMemo(
    () => allSharedVariables.filter((v) => v.repoId === null || v.repoId === repoId),
    [allSharedVariables, repoId],
  );

  const variableGroups = useMemo(
    () =>
      getAvailableVariables({
        triggerType,
        selectedEvents,
        allEvents,
        sharedVariables: applicableSharedVariables,
      }),
    [triggerType, selectedEvents, allEvents, applicableSharedVariables],
  );

  const insertVariable = useCallback((variable: string): void => {
    editorRef.current?.insertText(`{{${variable}}}`);
  }, []);

  return (
    <div className="space-y-8">
      <FormField
        control={control}
        name="model"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Model</FormLabel>
            <Select
              value={field.value ?? DEFAULT_MODEL_SENTINEL}
              onValueChange={(value: string) =>
                field.onChange(value === DEFAULT_MODEL_SENTINEL ? null : value)
              }
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={DEFAULT_MODEL_SENTINEL}>{defaultModelName}</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>Select the Claude model to use for this automation.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Insert Variables</Label>
          <p className="text-muted-foreground text-sm mt-1">
            Click to insert a variable placeholder at cursor position.
          </p>
        </div>

        <div className="space-y-3">
          {variableGroups.map((group) => (
            <div key={group.label}>
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {group.variables.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="font-mono"
                    title={variable.description}
                    onClick={() => insertVariable(variable.key)}
                  >
                    {`{{${variable.key}}}`}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <FormField
          control={control}
          name="promptTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt Template</FormLabel>
              <FormControl>
                <PromptEditor ref={editorRef} value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormDescription>
                Use {'{{variable}}'} syntax to reference dynamic values in your prompt.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
