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
import { ProviderModelSelector } from '@/modules/automations/components/form/provider-model-selector';
import { useGitHubEvents } from '@/modules/automations/hooks/use-github-events';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useSetupStatus } from '@/modules/repositories/hooks/use-setup-status';
import { useModelPolicies } from '@/modules/repositories/hooks/use-model-policies';
import { useSharedVariables } from '@/modules/variables/hooks/use-shared-variables';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { getAvailableVariables } from '@/modules/variables/lib/variable-catalog';
import { useCallback, useMemo, useRef, type ReactElement } from 'react';
import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';

interface AutomationPromptStepProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly setValue: UseFormSetValue<AutomationFormValues>;
}

export function AutomationPromptStep({
  control,
  watch,
  setValue,
}: AutomationPromptStepProps): ReactElement {
  const editorRef = useRef<PromptEditorRef>(null);
  const { events: allEvents } = useGitHubEvents();
  const { org } = useOrg();
  const orgId = org?.id ?? 0;
  const { variables: allSharedVariables } = useSharedVariables({ orgId });

  const triggerType = watch('triggerType');
  const triggerConfig = watch('triggerConfig');
  const repoId = watch('repoId');

  const { providerSecrets, isLoading: isLoadingSetupStatus } = useSetupStatus({
    orgId,
    repoId,
  });

  const { policies: modelPolicies } = useModelPolicies({ orgId, repoId });

  const configuredProviderIds = useMemo(
    () => providerSecrets?.filter((p) => p.configured).map((p) => p.providerId),
    [providerSecrets],
  );

  const availableSecretNames = useMemo(() => {
    if (!providerSecrets) return undefined;
    const names = new Set<string>();
    for (const ps of providerSecrets) {
      for (const s of ps.secrets) {
        if (s.exists) names.add(s.name);
      }
    }
    return names;
  }, [providerSecrets]);

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
      <ProviderModelSelector
        control={control}
        watch={watch}
        setValue={setValue}
        configuredProviderIds={configuredProviderIds}
        availableSecretNames={availableSecretNames}
        isLoadingSetupStatus={isLoadingSetupStatus}
        modelPolicies={modelPolicies.length > 0 ? modelPolicies : undefined}
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
