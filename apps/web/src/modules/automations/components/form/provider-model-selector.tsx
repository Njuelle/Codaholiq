import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { useProviders } from '@/modules/automations/hooks/use-providers';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_MODEL_SENTINEL } from '@/modules/automations/lib/constants';
import type { ModelPolicyEntry } from '@/modules/repositories/types';
import { useEffect, useMemo, type ReactElement } from 'react';
import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';

interface ProviderModelSelectorProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly setValue: UseFormSetValue<AutomationFormValues>;
  readonly configuredProviderIds?: readonly string[];
  readonly availableSecretNames?: ReadonlySet<string>;
  readonly isLoadingSetupStatus?: boolean;
  readonly modelPolicies?: readonly Pick<ModelPolicyEntry, 'provider' | 'model'>[];
}

export function ProviderModelSelector({
  control,
  watch,
  setValue,
  configuredProviderIds,
  availableSecretNames,
  isLoadingSetupStatus,
  modelPolicies,
}: ProviderModelSelectorProps): ReactElement {
  const { providers, getModelsForProvider, getDefaultModelId } = useProviders();
  const selectedProvider = watch('provider');

  const policySet = useMemo(() => {
    if (!modelPolicies || modelPolicies.length === 0) return null;
    return new Set(modelPolicies.map((p) => `${p.provider}:${p.model}`));
  }, [modelPolicies]);

  const availableProviders = useMemo(() => {
    const byConfig = configuredProviderIds
      ? providers.filter((p) => configuredProviderIds.includes(p.id))
      : providers;
    return policySet
      ? byConfig.filter((p) => p.models.some((m) => policySet.has(`${p.id}:${m.id}`)))
      : byConfig;
  }, [providers, configuredProviderIds, policySet]);

  useEffect(() => {
    if (!configuredProviderIds) return;
    const isCurrentProviderAvailable = availableProviders.some((p) => p.id === selectedProvider);
    const firstProvider = availableProviders[0];
    if (!isCurrentProviderAvailable && firstProvider && firstProvider.id !== selectedProvider) {
      setValue('provider', firstProvider.id);
      setValue('model', null);
    }
  }, [availableProviders, configuredProviderIds, selectedProvider, setValue]);

  const allModels = useMemo(
    () => getModelsForProvider(selectedProvider),
    [getModelsForProvider, selectedProvider],
  );

  const models = useMemo(() => {
    const bySecret = availableSecretNames
      ? allModels.filter((m) => !m.requiredSecret || availableSecretNames.has(m.requiredSecret))
      : allModels;
    return policySet
      ? bySecret.filter((m) => policySet.has(`${selectedProvider}:${m.id}`))
      : bySecret;
  }, [allModels, availableSecretNames, policySet, selectedProvider]);

  const defaultModelName = useMemo(() => {
    const defaultId = getDefaultModelId(selectedProvider);
    if (!defaultId) return 'Default';
    const model = allModels.find((m) => m.id === defaultId);
    return model ? `Default (${model.name})` : 'Default';
  }, [getDefaultModelId, selectedProvider, allModels]);

  if (configuredProviderIds && !isLoadingSetupStatus && availableProviders.length === 0) {
    return (
      <p className="max-w-lg text-sm text-destructive">
        No providers are configured on this repository. Please add the required API keys as
        repository secrets before creating an automation.
      </p>
    );
  }

  return (
    <div className="grid max-w-lg gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="provider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Provider</FormLabel>
            <Select
              disabled={isLoadingSetupStatus}
              value={field.value}
              onValueChange={(value: string) => {
                field.onChange(value);
                setValue('model', null);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue
                    placeholder={isLoadingSetupStatus ? 'Loading...' : 'Select a provider'}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {availableProviders.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>The AI coding agent to use for this automation.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

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
            <FormDescription>Select the model to use for this automation.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
