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
import { useMemo, type ReactElement } from 'react';
import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';

const DEFAULT_MODEL_SENTINEL = '__default__';

interface ProviderModelSelectorProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly setValue: UseFormSetValue<AutomationFormValues>;
}

export function ProviderModelSelector({
  control,
  watch,
  setValue,
}: ProviderModelSelectorProps): ReactElement {
  const { providers, getModelsForProvider, getDefaultModelId } = useProviders();
  const selectedProvider = watch('provider');

  const models = useMemo(
    () => getModelsForProvider(selectedProvider),
    [getModelsForProvider, selectedProvider],
  );

  const defaultModelName = useMemo(() => {
    const defaultId = getDefaultModelId(selectedProvider);
    if (!defaultId) return 'Default';
    const model = models.find((m) => m.id === defaultId);
    return model ? `Default (${model.name})` : 'Default';
  }, [getDefaultModelId, selectedProvider, models]);

  return (
    <div className="grid max-w-lg gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="provider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Provider</FormLabel>
            <Select
              value={field.value}
              onValueChange={(value: string) => {
                field.onChange(value);
                setValue('model', null);
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {providers.map((provider) => (
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
